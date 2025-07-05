#!/usr/bin/env node
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { mkdir, writeFile } from 'fs/promises';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function setupProduction() {
  console.log('🚀 Configurando archivos para producción...');
  
  try {
    // Crear directorio logs si no existe
    await mkdir(resolve(__dirname, '../logs'), { recursive: true });
    console.log('✅ Carpeta logs creada');
    
    // Crear server-wrapper.js
    const wrapperContent = `// Wrapper para ejecutar el servidor con CommonJS
const { createRequire } = require('module');
const path = require('path');

// Configurar variables de entorno
require('dotenv').config();

// Simular import.meta para el contexto CommonJS
global.import = {
  meta: {
    dirname: __dirname,
    url: \`file://\${__filename}\`
  }
};

// Ejecutar el servidor principal
async function startServer() {
  try {
    // Cargar el servidor principal usando dynamic import
    const serverModule = await import('./index.js');
    console.log('Servidor iniciado correctamente');
  } catch (error) {
    console.error('Error al iniciar el servidor:', error);
    process.exit(1);
  }
}

startServer();`;
    
    await writeFile(resolve(__dirname, '../dist/server-wrapper.js'), wrapperContent);
    console.log('✅ server-wrapper.js creado');
    
    // Crear ecosystem.config.js si no existe
    const ecosystemContent = `module.exports = {
  apps: [
    {
      name: 'transroute-app',
      script: 'dist/server-wrapper.js',
      instances: 1,
      exec_mode: 'fork',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      },
      env_file: '.env',
      log_file: 'logs/combined.log',
      out_file: 'logs/out.log',
      error_file: 'logs/error.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      merge_logs: true,
      restart_delay: 4000,
      max_restarts: 10,
      min_uptime: '10s',
      watch: false,
      ignore_watch: ['node_modules', 'logs', 'dist'],
      kill_timeout: 5000,
      wait_ready: true,
      listen_timeout: 10000
    }
  ]
};`;
    
    await writeFile(resolve(__dirname, '../ecosystem.config.js'), ecosystemContent);
    console.log('✅ ecosystem.config.js creado');
    
    // Crear .env.example
    const envExample = `# Configuración de producción
NODE_ENV=production
PORT=3000

# Base de datos Supabase
DATABASE_URL=postgresql://usuario:contraseña@db.supabase.co:5432/postgres

# Secretos de sesión (genera claves únicas para tu proyecto)
SESSION_SECRET=tu-clave-secreta-super-larga-y-segura-aqui

# Configuración opcional
PGHOST=db.supabase.co
PGPORT=5432
PGDATABASE=postgres
PGUSER=usuario
PGPASSWORD=contraseña`;
    
    await writeFile(resolve(__dirname, '../.env.example'), envExample);
    console.log('✅ .env.example creado');
    
    console.log('\n🎉 Configuración de producción completada!');
    console.log('\nPasos siguientes:');
    console.log('1. Crear archivo .env con tus variables reales');
    console.log('2. Ejecutar: pm2 start ecosystem.config.js');
    console.log('3. Verificar: pm2 status');
    
  } catch (error) {
    console.error('❌ Error configurando producción:', error);
    process.exit(1);
  }
}

setupProduction();