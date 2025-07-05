# Migración Limpia - Eliminar y Recrear Tablas

## Pasos Recomendados

### 1. Hacer Backup de Datos Importantes (CRÍTICO)
Antes de eliminar las tablas, respalda los datos que necesites conservar:

```sql
-- Conectar a tu base de datos y exportar datos críticos
SELECT * FROM users;
SELECT * FROM companies;
SELECT * FROM reservations;
SELECT * FROM trips;
-- etc.
```

### 2. Eliminar Todas las Tablas desde Supabase
1. Ve al panel de Supabase
2. En "Table Editor", elimina todas las tablas una por una:
   - `box_cutoff`
   - `commissions`
   - `companies`
   - `coupons`
   - `invitations`
   - `location_data`
   - `notifications`
   - `packages`
   - `passengers`
   - `reservation_requests`
   - `reservations`
   - `routes`
   - `transactions`
   - `trip_budgets`
   - `trip_expenses`
   - `trips`
   - `user_companies`
   - `users`
   - `vehicles`
   - `__drizzle_migrations` (si existe)

### 3. Ejecutar Migración Completa
Una vez eliminadas todas las tablas:

```bash
# En tu servidor de producción
export DATABASE_URL="tu_string_de_conexion_supabase"
npm run db:push
```

### 4. Verificar Migración
```bash
# Verificar que todas las tablas se crearon correctamente
node -e "
const { neon } = require('@neondatabase/serverless');
const sql = neon(process.env.DATABASE_URL);
sql\`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name\`.then(tables => {
  console.log('Tablas creadas:');
  tables.forEach(t => console.log('- ' + t.table_name));
});
"
```

### 5. Restaurar Datos Críticos (si es necesario)
Después de la migración exitosa, restaura los datos que respaldaste.

## Ventajas de este Enfoque

✅ **Sin conflictos de esquema** - Parte desde cero
✅ **Migración limpia** - No hay datos corruptos
✅ **Más rápido** - Evita resolver conflictos complejos
✅ **Garantiza consistencia** - El esquema final coincide exactamente con tu código

## Script de Verificación Post-Migración

```bash
# Crear y ejecutar script de verificación
cat > verify-clean-migration.js << 'EOF'
const { neon } = require('@neondatabase/serverless');

async function verifyMigration() {
  const sql = neon(process.env.DATABASE_URL);
  
  // Verificar tablas críticas
  const tables = await sql\`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    ORDER BY table_name
  \`;
  
  console.log('✅ Tablas creadas (' + tables.length + '):');
  tables.forEach(t => console.log('  - ' + t.table_name));
  
  // Verificar estructura de invitations
  const invitationsStructure = await sql\`
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_name = 'invitations' 
    ORDER BY ordinal_position
  \`;
  
  console.log('\\n✅ Estructura de invitations:');
  invitationsStructure.forEach(col => {
    console.log(\`  - \${col.column_name}: \${col.data_type}\`);
  });
  
  console.log('\\n🎉 Migración limpia completada exitosamente');
}

verifyMigration().catch(console.error);
EOF

node verify-clean-migration.js
rm verify-clean-migration.js
```

## Notas Importantes

⚠️ **Perderás todos los datos existentes** - Asegúrate de respaldar lo importante
📝 **Recrearás usuarios** - Tendrás que volver a crear cuentas de usuario
🏢 **Recrearás empresas** - Tendrás que configurar las empresas nuevamente

## ¿Cuándo Usar Este Enfoque?

- Cuando tienes pocos datos importantes que perder
- Cuando los conflictos de esquema son complejos de resolver
- Cuando quieres garantizar una base de datos limpia y consistente
- En desarrollo o staging antes de producción final