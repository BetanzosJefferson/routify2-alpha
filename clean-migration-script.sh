#!/bin/bash

# Script para migración limpia completa
# Uso: chmod +x clean-migration-script.sh && ./clean-migration-script.sh

echo "🧹 Migración Limpia - Recrear Base de Datos Completa"
echo "=================================================="

# Verificar DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Configure DATABASE_URL primero:"
    echo "export DATABASE_URL=\"tu_string_de_conexion_supabase\""
    exit 1
fi

echo "✅ DATABASE_URL configurada"

# Confirmar acción
echo ""
echo "⚠️  ADVERTENCIA: Este proceso eliminará TODOS los datos existentes"
echo "   - Se perderán todos los usuarios, empresas, reservaciones"
echo "   - Se recreará la base de datos desde cero"
echo "   - Solo continúa si tienes respaldos o es aceptable perder los datos"
echo ""
read -p "¿Continuar con la migración limpia? (escriba 'SI' para confirmar): " confirm

if [ "$confirm" != "SI" ]; then
    echo "❌ Migración cancelada por el usuario"
    exit 1
fi

echo ""
echo "🔄 Iniciando migración limpia..."

# Crear script para eliminar todas las tablas
echo "🗑️  Eliminando todas las tablas existentes..."

cat > drop-all-tables.js << 'EOF'
const { neon } = require('@neondatabase/serverless');

async function dropAllTables() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Obtener todas las tablas
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    `;
    
    console.log(`Encontradas ${tables.length} tablas para eliminar`);
    
    if (tables.length === 0) {
      console.log('✅ No hay tablas para eliminar');
      return;
    }
    
    // Eliminar todas las tablas con CASCADE
    for (const table of tables) {
      try {
        await sql`DROP TABLE IF EXISTS ${sql(table.table_name)} CASCADE`;
        console.log(`✅ Eliminada tabla: ${table.table_name}`);
      } catch (error) {
        console.log(`⚠️  Error eliminando ${table.table_name}:`, error.message);
      }
    }
    
    console.log('🎉 Todas las tablas eliminadas exitosamente');
    
  } catch (error) {
    console.error('❌ Error eliminando tablas:', error.message);
    process.exit(1);
  }
}

dropAllTables();
EOF

# Ejecutar eliminación de tablas
node drop-all-tables.js

# Verificar que no quedan tablas
echo ""
echo "🔍 Verificando que no quedan tablas..."

node -e "
const { neon } = require('@neondatabase/serverless');
neon(process.env.DATABASE_URL)\`
  SELECT COUNT(*) as count 
  FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_type = 'BASE TABLE'
\`.then(result => {
  const count = result[0].count;
  if (count === '0') {
    console.log('✅ Base de datos limpia - no quedan tablas');
  } else {
    console.log(\`⚠️  Aún quedan \${count} tablas\`);
  }
});
" || echo "⚠️  Error verificando tablas"

# Ejecutar migración completa
echo ""
echo "🚀 Ejecutando migración completa..."
npm run db:push

# Verificar migración exitosa
echo ""
echo "🔍 Verificando migración..."

cat > verify-migration.js << 'EOF'
const { neon } = require('@neondatabase/serverless');

async function verifyMigration() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Contar tablas creadas
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log(`✅ Migración exitosa - ${tables.length} tablas creadas:`);
    tables.forEach(table => {
      console.log(`  - ${table.table_name}`);
    });
    
    // Verificar estructura de tabla crítica
    const invitationsStructure = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'invitations' 
      ORDER BY ordinal_position
    `;
    
    if (invitationsStructure.length > 0) {
      console.log('\n✅ Estructura de invitations:');
      invitationsStructure.forEach(col => {
        console.log(`  - ${col.column_name}: ${col.data_type}`);
      });
    }
    
    console.log('\n🎉 Migración limpia completada exitosamente');
    console.log('💡 Ahora puedes reiniciar tu aplicación');
    
  } catch (error) {
    console.error('❌ Error verificando migración:', error.message);
  }
}

verifyMigration();
EOF

node verify-migration.js

# Limpiar archivos temporales
rm -f drop-all-tables.js verify-migration.js

echo ""
echo "🎉 Proceso de migración limpia completado"
echo "📋 Siguientes pasos:"
echo "   1. Reiniciar aplicación: pm2 restart ecosystem.config.js"
echo "   2. Crear usuario administrador inicial"
echo "   3. Configurar empresas según sea necesario"
echo "   4. Probar funcionalidades principales"