#!/bin/bash

# Script simple para migración en producción
# Uso: chmod +x production-simple-migration.sh && ./production-simple-migration.sh

echo "🚀 Migración simple en producción..."

# Verificar DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Configure DATABASE_URL primero:"
    echo "export DATABASE_URL=\"tu_string_de_conexion_supabase\""
    exit 1
fi

echo "✅ DATABASE_URL configurada"

# Correr el script de diagnóstico y corrección
echo "🔧 Ejecutando corrección previa..."
node production-migration-fix.js

# Ejecutar migración con npm
echo "🔄 Ejecutando migración..."

# Usar el comando npm que ya está configurado
npm run db:push

echo "🎉 Migración completada"
echo "💡 Reinicia tu aplicación: pm2 restart ecosystem.config.js"