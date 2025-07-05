#!/bin/bash

echo "🚀 Iniciando aplicación en producción..."

# Verificar que los archivos necesarios existen
if [ ! -f "dist/index.js" ]; then
    echo "❌ Error: dist/index.js no encontrado. Ejecuta primero ./build-production.sh"
    exit 1
fi

if [ ! -f ".env" ]; then
    echo "❌ Error: Archivo .env no encontrado. Crea uno basado en .env.example"
    exit 1
fi

# Detener instancias previas
echo "🛑 Deteniendo instancias previas..."
pm2 stop transroute-app 2>/dev/null || true
pm2 delete transroute-app 2>/dev/null || true

# Opción 1: Iniciar directamente con PM2
echo "🔄 Iniciando con PM2..."
pm2 start dist/server-wrapper.js --name transroute-app --node-args="--experimental-modules" --env production

# Verificar estado
sleep 3
pm2 status

echo "✅ Aplicación iniciada!"
echo "Ver logs: pm2 logs transroute-app"
echo "Ver estado: pm2 status"