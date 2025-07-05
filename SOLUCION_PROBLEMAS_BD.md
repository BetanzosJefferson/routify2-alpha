# Solución de Problemas de Base de Datos - Producción

## Problema Identificado
Tu aplicación en producción tiene errores relacionados con campos JSON en PostgreSQL. El problema principal es que algunos campos están definidos como `json` pero deberían ser `jsonb` para mejor compatibilidad.

## Archivos Creados para Solución

### 1. `production-db-diagnostic.sql`
Script SQL que puedes ejecutar directamente en tu base de datos Supabase para diagnosticar problemas.

**Cómo usar:**
```bash
# Conectar a tu base de datos Supabase y ejecutar:
psql "tu_string_de_conexion_aqui" -f production-db-diagnostic.sql
```

### 2. `production-server-fix.js`
Script Node.js para ejecutar en tu servidor de producción.

**Cómo usar:**
```bash
# En tu servidor de producción:
export DATABASE_URL="tu_string_de_conexion_aqui"
node production-server-fix.js
```

### 3. `emergency-db-fix.js`
Script de emergencia para corregir automáticamente los problemas.

**Cómo usar:**
```bash
# Solo si los problemas persisten:
export DATABASE_URL="tu_string_de_conexion_aqui"
node emergency-db-fix.js
```

## Pasos Recomendados

### Paso 1: Diagnóstico
1. Ejecuta `production-server-fix.js` para identificar problemas específicos
2. Revisa la salida para entender qué campos necesitan corrección

### Paso 2: Corrección
1. Si hay campos `json` que deben ser `jsonb`, el script los convertirá automáticamente
2. Si hay datos corruptos, usa `emergency-db-fix.js` para limpiarlos

### Paso 3: Verificación
1. Reinicia tu aplicación después de ejecutar los scripts
2. Verifica que los errores hayan desaparecido
3. Prueba las funcionalidades principales

## Problemas Comunes y Soluciones

### Error: "invalid input syntax for type json"
**Causa:** Datos corruptos en campos JSON
**Solución:** Ejecutar `emergency-db-fix.js` para limpiar datos corruptos

### Error: "column type json not supported"
**Causa:** Drizzle ORM prefiere `jsonb` sobre `json`
**Solución:** Los scripts convierten automáticamente `json` a `jsonb`

### Error de conexión
**Causa:** String de conexión incorrecto o problemas de red
**Solución:** Verificar DATABASE_URL y conectividad

## Backup de Seguridad

Antes de ejecutar cualquier script de corrección, realiza un backup:

```bash
# Crear backup de tu base de datos
pg_dump "tu_string_de_conexion_aqui" > backup_$(date +%Y%m%d_%H%M%S).sql
```

## Contacto de Emergencia

Si los problemas persisten después de ejecutar todos los scripts:

1. Verifica que tu string de conexión sea correcto
2. Revisa los logs de Supabase para errores específicos
3. Contacta soporte de Supabase si es necesario
4. Considera restaurar desde el backup más reciente

## Notas Importantes

- Los scripts están diseñados para ser seguros y no eliminar datos importantes
- Siempre hacen verificaciones antes de realizar cambios
- Proporcionan salida detallada para diagnosticar problemas
- Son compatibles con la estructura actual de tu base de datos

## Prevención Futura

Para evitar estos problemas en el futuro:

1. Usar siempre `jsonb` en lugar de `json` en PostgreSQL
2. Validar datos JSON antes de insertar en la base de datos
3. Realizar backups regulares
4. Probar cambios en entorno de desarrollo antes de producción