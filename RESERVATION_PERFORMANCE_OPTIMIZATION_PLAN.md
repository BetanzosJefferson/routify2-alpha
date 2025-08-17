# Plan de Optimización de Performance - Reservaciones

## Objetivo: Carga <100ms en producción

## Fase 1: Backend Optimization (Crítico)

### 1.1 Paginación Inteligente
- **Implementar**: `limit=50&offset=0` por defecto
- **Filtro por fecha**: Por defecto solo últimos 7 días
- **Pagination**: Frontend paginado, backend eficiente

### 1.2 Filtros Servidor-Side
- **Fecha por defecto**: Solo reservaciones de hoy
- **Búsqueda**: Búsqueda en backend con índices optimizados  
- **Estado**: Filtrar reservaciones canceladas en backend

### 1.3 Endpoints Especializados
- `/api/reservations/recent` - Solo últimas 50
- `/api/reservations/today` - Solo de hoy
- `/api/reservations/search` - Búsqueda optimizada

## Fase 2: Cache Strategy

### 2.1 Cache Inteligente
- **TTL diferenciado**: 5min para datos frecuentes, 30min para datos estáticos
- **Cache keys específicos**: Por fecha, usuario, filtros
- **Invalidación selectiva**: Solo invalidar cache relevante

### 2.2 Prefetch Predictivo
- Pre-cargar reservaciones del día siguiente
- Cache warming para usuarios frecuentes

## Fase 3: Frontend Optimization

### 3.1 Query Strategy Optimizada
```typescript
// Estrategia: Solo cargar datos necesarios por defecto
const { data, isLoading } = useReservations({
  date: getCurrentDate(), // Solo hoy por defecto
  limit: 50,              // Paginación
  includeRelated: false   // No cargar relaciones por defecto
});
```

### 3.2 UI Virtualización
- Implementar `react-window` para tablas grandes
- Lazy loading de detalles de reservación
- Skeleton UI optimizado

### 3.3 Debounced Search
- Búsqueda con debounce 300ms
- Cancel requests anteriores
- Search mínimo 3 caracteres

## Fase 4: Data Structure Optimization

### 4.1 Response Optimization
- **Campos mínimos**: Solo datos esenciales en listado
- **Lazy details**: Cargar detalles solo cuando se requieren
- **Compression**: Gzip/Brotli en responses

### 4.2 Database Indexes
- **Index compuesto**: (company_id, created_at, status)
- **Index fecha**: Para filtros rápidos por fecha
- **Index búsqueda**: Para full-text search

## Métricas Target

- **Initial Load**: <100ms
- **Search**: <200ms  
- **Pagination**: <50ms
- **Filter Change**: <100ms

## Implementación Priority

1. **P0 (Crítico)**: Filtro por fecha por defecto + paginación
2. **P1 (Alto)**: Cache optimization + search debounce
3. **P2 (Medio)**: UI virtualization + prefetch
4. **P3 (Bajo)**: Advanced optimizations