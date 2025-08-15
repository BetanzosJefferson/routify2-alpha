-- Optimización de índices de base de datos para mejorar performance
-- Enfocado en las consultas problemáticas identificadas en el análisis

-- 1. Índice compuesto para trips por company_id y visibility (586 calls, 363 segundos)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_company_visibility 
ON trips (company_id, visibility);

-- 2. Índice para trips por company_id solo (88 calls, 48 segundos)  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_company_id 
ON trips (company_id);

-- 3. Índice para users por company_id (881 calls, 166 segundos)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_company_id 
ON users (company_id);

-- 4. Índices para foreign keys más consultadas en batch queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_created_by 
ON reservations (created_by);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_passengers_reservation_id 
ON passengers (reservation_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_route_id 
ON trips (route_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_vehicle_id 
ON trips (vehicle_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_driver_id 
ON trips (driver_id);

-- 5. Índice para reservations por company_id para filtrado rápido
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_company_id 
ON reservations (company_id);

-- 6. Índice compuesto para reservations por company_id y commission_paid
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_company_commission 
ON reservations (company_id, commission_paid);

-- 7. Índice para dates en trip_data JSON (consultas de fecha frecuentes)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trips_departure_date 
ON trips USING gin ((trip_data::jsonb));

-- 8. Índice para status y payment_status en reservations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_reservations_status 
ON reservations (status, payment_status);

-- Verificar el estado de los índices
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes 
WHERE tablename IN ('trips', 'users', 'reservations', 'passengers', 'routes', 'vehicles')
ORDER BY tablename, indexname;