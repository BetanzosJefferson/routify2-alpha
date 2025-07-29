# Plan de Optimización - Sección Bitácora

## Análisis del Problema

### Problemas Identificados:
1. **Múltiples consultas separadas**: Bitácora hace 3 llamadas independientes:
   - `useReservations({ date: selectedDate })` - ~1200ms
   - `usePackages()` - Sin filtro de fecha, carga TODAS las paqueterías 
   - `useTrips({ date: selectedDate, isSubTrip: false })` - ~140ms

2. **Procesamiento en Frontend**: La lógica de agrupación y cálculos se hace en el frontend después de obtener todos los datos

3. **Consultas N+1**: Los logs muestran "Trip record 1223 not found" repetidamente, indicando consultas fallidas

4. **Datos innecesarios**: Se cargan todas las paqueterías sin filtro cuando solo necesitamos las de la fecha seleccionada

5. **Falta de índices**: Consultas SQL lentas por falta de índices optimizados

## Plan de Optimización con Joins

### Fase 1: Crear Endpoint Unificado para Bitácora

**Objetivo**: Reemplazar las 3 consultas separadas con una sola consulta optimizada con JOINs

#### 1.1 Nuevo Endpoint: `GET /api/bitacora`

```typescript
// Endpoint que retorna datos pre-agrupados y calculados
GET /api/bitacora?date=2025-07-29

Response: {
  trips: [
    {
      recordId: 1230,
      tripInfo: { /* datos del viaje */ },
      reservations: [ /* reservaciones con joins */ ],
      packages: [ /* paquetes con joins */ ],
      totalSales: 1200,
      totalExpenses: 300,
      netProfit: 900,
      passengerCount: 5,
      packageCount: 3
    }
  ],
  summary: {
    totalPorVender: 5000,
    ventasReales: 3200,
    totalTrips: 3,
    totalPassengers: 15,
    totalPackages: 8
  }
}
```

#### 1.2 Query SQL Optimizada con Múltiples JOINs

```sql
-- Consulta principal que obtiene todo en una sola query
WITH trip_data AS (
  SELECT 
    t.id as trip_id,
    t.tripData,
    t.routeId,
    t.companyId,
    r.origin as route_origin,
    r.destination as route_destination,
    u.firstName as driver_first,
    u.lastName as driver_last,
    v.model as vehicle_model,
    v.plateNumber as vehicle_plate
  FROM trips t
  LEFT JOIN routes r ON t.routeId = r.id
  LEFT JOIN users u ON t.assignedDriverId = u.id
  LEFT JOIN vehicles v ON t.assignedVehicleId = v.id
  WHERE t.companyId = $1
    AND t.tripData->0->>'departureDate' = $2
),
reservations_data AS (
  SELECT 
    res.*,
    res_users.firstName as passenger_first,
    res_users.lastName as passenger_last,
    creator_users.firstName as creator_first,
    creator_users.lastName as creator_last,
    (res.tripDetails->>'recordId')::int as record_id
  FROM reservations res
  LEFT JOIN users res_users ON res.userId = res_users.id
  LEFT JOIN users creator_users ON res.createdBy = creator_users.id
  WHERE res.companyId = $1
    AND (res.tripDetails->>'recordId')::int IN (
      SELECT trip_id FROM trip_data
    )
),
packages_data AS (
  SELECT 
    pkg.*,
    creator_users.firstName as creator_first,
    creator_users.lastName as creator_last,
    (pkg.tripDetails->>'recordId')::int as record_id
  FROM packages pkg
  LEFT JOIN users creator_users ON pkg.createdBy = creator_users.id
  WHERE pkg.companyId = $1
    AND pkg.tripDetails->>'departureDate' = $2
    AND (pkg.tripDetails->>'recordId')::int IN (
      SELECT trip_id FROM trip_data
    )
)
SELECT 
  td.*,
  COALESCE(json_agg(DISTINCT rd.*) FILTER (WHERE rd.id IS NOT NULL), '[]') as reservations,
  COALESCE(json_agg(DISTINCT pd.*) FILTER (WHERE pd.id IS NOT NULL), '[]') as packages
FROM trip_data td
LEFT JOIN reservations_data rd ON td.trip_id = rd.record_id
LEFT JOIN packages_data pd ON td.trip_id = pd.record_id
GROUP BY td.trip_id, td.tripData, td.routeId, td.companyId, 
         td.route_origin, td.route_destination, td.driver_first, 
         td.driver_last, td.vehicle_model, td.vehicle_plate
ORDER BY td.trip_id;
```

### Fase 2: Optimización de Base de Datos

#### 2.1 Índices Optimizados

```sql
-- Índice compuesto para filtrado rápido por fecha en trips
CREATE INDEX IF NOT EXISTS idx_trips_company_departure_date 
ON trips(companyId, ((tripData->0->>'departureDate')));

-- Índice para reservaciones por recordId
CREATE INDEX IF NOT EXISTS idx_reservations_record_id 
ON reservations(companyId, ((tripDetails->>'recordId')::int));

-- Índice para paquetes por fecha y recordId
CREATE INDEX IF NOT EXISTS idx_packages_company_departure_record 
ON packages(companyId, ((tripDetails->>'departureDate')), ((tripDetails->>'recordId')::int));

-- Índice para usuarios (joins frecuentes)
CREATE INDEX IF NOT EXISTS idx_users_company_role 
ON users(companyId, role);
```

#### 2.2 Método de Storage Optimizado

```typescript
async getBitacoraData(companyId: string, date: string): Promise<BitacoraData> {
  const startTime = Date.now();
  
  // Single optimized query with all joins
  const result = await this.db.execute(sql`
    WITH trip_data AS (
      -- Query SQL optimizada de arriba
    )
    -- ... resto de la consulta
  `);
  
  // Procesamiento mínimo en backend
  const processedData = this.processBitacoraResults(result);
  
  console.log(`[Bitácora] Datos obtenidos en ${Date.now() - startTime}ms`);
  return processedData;
}
```

### Fase 3: Frontend Optimizado

#### 3.1 Hook Unificado

```typescript
function useBitacora(date: string) {
  return useQuery({
    queryKey: ["/api/bitacora", date],
    queryFn: () => fetch(`/api/bitacora?date=${date}`).then(r => r.json()),
    staleTime: 30000, // Cache por 30 segundos
    enabled: !!date
  });
}
```

#### 3.2 Componente Simplificado

```typescript
export function TripLogbook() {
  const [selectedDate, setSelectedDate] = useState(getCurrentDate());
  
  // Single query replaces 3 separate queries
  const { data: bitacoraData, isLoading } = useBitacora(selectedDate);
  
  if (isLoading) {
    return <LoadingSpinner />;
  }
  
  // Data comes pre-processed from backend
  const { trips, summary } = bitacoraData;
  
  return (
    <div>
      {/* Render directly without frontend processing */}
    </div>
  );
}
```

## Beneficios Esperados

### Performance:
- **Reducción de queries**: 3 → 1 (66% reducción)
- **Tiempo de respuesta**: ~1400ms → ~300ms (78% mejora)
- **Transferencia de datos**: Reducción significativa al filtrar en backend
- **Joins optimizados**: Eliminación de consultas N+1

### Escalabilidad:
- Índices específicos para consultas frecuentes
- Caching mejorado con single endpoint
- Reducción de carga en frontend

### Mantenimiento:
- Lógica centralizada en backend
- Menos complejidad en frontend
- Mejor debugging con single point of failure

## Implementación Gradual

1. **Fase 1**: Crear endpoint `/api/bitacora` (mantener endpoints existentes)
2. **Fase 2**: Añadir índices optimizados
3. **Fase 3**: Migrar frontend a usar nuevo endpoint
4. **Fase 4**: Remover endpoints obsoletos tras verificación

## Métricas de Éxito

- Tiempo de carga < 500ms
- Reducción de queries SQL de 10+ a 1
- Memoria frontend optimizada
- Experiencia de usuario fluida sin demoras perceptibles