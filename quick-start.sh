#!/bin/bash

echo "🚀 Inicio rápido para producción..."

# Verificar archivos
if [ ! -f "dist/index.js" ]; then
    echo "❌ Ejecuta primero: ./build-production.sh"
    exit 1
fi

# Limpiar PM2
pm2 kill 2>/dev/null || true

# Iniciar directamente sin ecosystem.config.js
echo "🔄 Iniciando servidor..."
NODE_ENV=production pm2 start dist/index.js --name transroute-app

# Estado
pm2 status
echo "✅ Servidor iniciado en puerto 3000"