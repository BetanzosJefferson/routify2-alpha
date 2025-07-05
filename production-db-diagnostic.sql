-- Script de diagnóstico y corrección para base de datos de producción
-- Ejecutar este script directamente en tu servidor de producción

-- 1. Verificar estructura de tabla invitations
SELECT 'Estructura de tabla invitations:' as info;
SELECT column_name, data_type, is_nullable, column_default 
FROM information_schema.columns 
WHERE table_name = 'invitations' 
ORDER BY ordinal_position;

-- 2. Verificar datos existentes en invitations
SELECT 'Datos en invitations:' as info;
SELECT id, role, email, 
       CASE 
         WHEN metadata IS NULL THEN 'NULL'
         ELSE metadata::text
       END as metadata_content,
       created_at
FROM invitations 
ORDER BY id;

-- 3. Verificar si hay columnas JSON que deberían ser JSONB
SELECT 'Columnas JSON en el schema:' as info;
SELECT table_name, column_name, data_type 
FROM information_schema.columns 
WHERE data_type = 'json' AND table_schema = 'public' 
ORDER BY table_name, column_name;

-- 4. Convertir metadata de json a jsonb (si es necesario)
-- Primero verificar el tipo actual
DO $$
DECLARE
    metadata_type text;
BEGIN
    SELECT data_type INTO metadata_type
    FROM information_schema.columns 
    WHERE table_name = 'invitations' AND column_name = 'metadata';
    
    IF metadata_type = 'json' THEN
        RAISE NOTICE 'Convirtiendo metadata de json a jsonb...';
        ALTER TABLE invitations ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb;
        RAISE NOTICE 'Conversión completada exitosamente';
    ELSE
        RAISE NOTICE 'metadata ya es % (no necesita conversión)', metadata_type;
    END IF;
END $$;

-- 5. Verificar integridad de datos JSON/JSONB
SELECT 'Verificación de integridad JSON:' as info;
SELECT id, 
       CASE 
         WHEN metadata IS NULL THEN 'NULL - OK'
         WHEN jsonb_typeof(metadata) = 'object' THEN 'VALID JSON OBJECT'
         ELSE 'INVALID JSON: ' || metadata::text
       END as json_status
FROM invitations 
WHERE metadata IS NOT NULL;

-- 6. Verificar empresas y usuarios
SELECT 'Resumen de datos:' as info;
SELECT 
  'companies' as table_name,
  COUNT(*) as record_count
FROM companies
UNION ALL
SELECT 
  'users' as table_name,
  COUNT(*) as record_count
FROM users
UNION ALL
SELECT 
  'invitations' as table_name,
  COUNT(*) as record_count
FROM invitations
UNION ALL
SELECT 
  'trips' as table_name,
  COUNT(*) as record_count
FROM trips
UNION ALL
SELECT 
  'reservations' as table_name,
  COUNT(*) as record_count
FROM reservations
ORDER BY table_name;

-- 7. Verificar problemas específicos en reservations
SELECT 'Verificando reservations trip_details:' as info;
SELECT id, 
       CASE 
         WHEN trip_details IS NULL THEN 'NULL - OK'
         WHEN jsonb_typeof(trip_details) = 'object' THEN 'VALID JSON OBJECT'
         ELSE 'INVALID JSON: ' || trip_details::text
       END as trip_details_status
FROM reservations 
WHERE trip_details IS NOT NULL
LIMIT 10;

-- 8. Limpiar datos corruptos (solo si es necesario)
-- CUIDADO: Esto eliminará registros con JSON inválido
-- SELECT 'Limpiando datos corruptos...' as info;
-- DELETE FROM invitations WHERE metadata IS NOT NULL AND NOT (metadata::text ~ '^[\{\[].*[\}\]]$');

SELECT 'Diagnóstico completado. Revisa los resultados arriba.' as final_message;