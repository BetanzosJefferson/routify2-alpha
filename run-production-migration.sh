#!/bin/bash

# Script para ejecutar migración en producción
# Uso: chmod +x run-production-migration.sh && ./run-production-migration.sh

echo "🚀 Iniciando migración en producción..."

# Verificar que DATABASE_URL esté configurada
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL no está configurada"
    echo "Configura la variable de entorno:"
    echo "export DATABASE_URL=\"postgresql://postgres:PASSWORD@HOST:5432/DATABASE\""
    exit 1
fi

echo "✅ DATABASE_URL configurada"

# Verificar que el directorio migrations existe
if [ ! -d "./migrations" ]; then
    echo "📁 Creando directorio de migraciones..."
    mkdir -p migrations
fi

# Ejecutar diagnóstico previo
echo "🔍 Ejecutando diagnóstico previo..."
node production-migration-fix.js

# Aplicar migraciones con drizzle-kit
echo "🔄 Aplicando migraciones con drizzle-kit..."

# Intentar con npx drizzle-kit
if command -v npx &> /dev/null; then
    echo "📦 Usando npx drizzle-kit..."
    npx drizzle-kit push:pg --config=drizzle.config.ts
else
    echo "📦 Usando drizzle-kit global..."
    drizzle-kit push:pg --config=drizzle.config.ts
fi

# Verificar estado después de migración
echo "🔍 Verificando estado después de migración..."

# Crear script de verificación rápida
cat > verify-migration.js << 'EOF'
const { neon } = require('@neondatabase/serverless');

async function verifyMigration() {
  try {
    const sql = neon(process.env.DATABASE_URL);
    
    // Verificar metadata type
    const metadataType = await sql`
      SELECT data_type 
      FROM information_schema.columns 
      WHERE table_name = 'invitations' 
      AND column_name = 'metadata'
    `;
    
    if (metadataType.length > 0) {
      console.log(`✅ metadata tipo: ${metadataType[0].data_type}`);
    } else {
      console.log('⚠️ Campo metadata no encontrado');
    }
    
    // Contar registros
    const counts = await sql`
      SELECT COUNT(*) as count FROM invitations
    `;
    
    console.log(`📊 Invitaciones: ${counts[0].count}`);
    
    console.log('🎉 Verificación completada');
    
  } catch (error) {
    console.error('❌ Error en verificación:', error.message);
  }
}

verifyMigration();
EOF

node verify-migration.js

# Limpiar archivo temporal
rm verify-migration.js

echo "🎉 Migración completada"
echo "💡 Reinicia tu aplicación para aplicar todos los cambios"
echo ""
echo "📋 Siguiente paso: pm2 restart ecosystem.config.js"