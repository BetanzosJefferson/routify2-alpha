#!/bin/bash
echo "🚀 Construyendo aplicación para producción..."

# Instalar dependencias
echo "📦 Instalando dependencias..."
npm install

# Construir frontend
echo "🏗️ Construyendo frontend..."
npm run build

# Construir backend
echo "⚙️ Construyendo backend..."
npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outfile=dist/index.js

# Configurar archivos de producción
echo "🔧 Configurando archivos de producción..."
node scripts/setup-production.js

echo "✅ Build completado!"
echo ""
echo "Para iniciar en producción:"
echo "1. Configura tu archivo .env (usa .env.example como referencia)"
echo "2. Ejecuta: pm2 start ecosystem.config.js"
echo "3. Verifica: pm2 status"