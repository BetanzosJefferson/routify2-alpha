# Solución de Problemas de Base de Datos - Producción

## Problema Identificado
Tu aplicación en producción tiene errores relacionados con campos JSON en PostgreSQL. El problema principal es que algunos campos están definidos como `json` pero deberían ser `jsonb` para mejor compatibilidad.

## Archivos Creados para Solución

### 1. `production-migration-fix.js` ⭐ **RECOMENDADO**
Script completo que ejecuta migración + corrección en un solo paso.

**Cómo usar:**
```bash
# En tu servidor de producción:
export DATABASE_URL="tu_string_de_conexion_aqui"
node production-migration-fix.js
```

### 2. `production-simple-migration.sh` ⭐ **MÁS SIMPLE**
Script bash que ejecuta corrección + migración usando npm.

**Cómo usar:**
```bash
# En tu servidor de producción:
export DATABASE_URL="tu_string_de_conexion_aqui"
chmod +x production-simple-migration.sh
./production-simple-migration.sh
```

### 3. `run-production-migration.sh`
Script completo con drizzle-kit y verificación.

**Cómo usar:**
```bash
# En tu servidor de producción:
export DATABASE_URL="tu_string_de_conexion_aqui"
chmod +x run-production-migration.sh
./run-production-migration.sh
```

### 4. `production-db-diagnostic.sql`
Script SQL manual para diagnóstico.

**Cómo usar:**
```bash
psql "tu_string_de_conexion_aqui" -f production-db-diagnostic.sql
```

### 5. `production-server-fix.js`
Script Node.js solo para diagnóstico.

**Cómo usar:**
```bash
export DATABASE_URL="tu_string_de_conexion_aqui"
node production-server-fix.js
```

### 6. `emergency-db-fix.js`
Script de emergencia solo para corrección.

**Cómo usar:**
```bash
export DATABASE_URL="tu_string_de_conexion_aqui"
node emergency-db-fix.js
```

## Pasos Recomendados

### Opción 1: Migración Completa (RECOMENDADO) ⭐
1. **En tu servidor de producción:**
   ```bash
   export DATABASE_URL="tu_string_de_conexion_supabase"
   node production-migration-fix.js
   pm2 restart ecosystem.config.js
   ```

### Opción 2: Migración Simple ⭐
1. **En tu servidor de producción:**
   ```bash
   export DATABASE_URL="tu_string_de_conexion_supabase"
   chmod +x production-simple-migration.sh
   ./production-simple-migration.sh
   ```

### Opción 3: Solo Diagnóstico
1. **Para ver qué problemas hay:**
   ```bash
   export DATABASE_URL="tu_string_de_conexion_supabase"
   node production-server-fix.js
   ```

### Opción 4: Solo Corrección de Emergencia
1. **Si hay datos corruptos:**
   ```bash
   export DATABASE_URL="tu_string_de_conexion_supabase"
   node emergency-db-fix.js
   ```

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