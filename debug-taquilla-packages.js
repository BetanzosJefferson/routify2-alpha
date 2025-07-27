import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function debugTaquillaPackages() {
  console.log('🔍 Investigando problema de filtrado de paquetes para taquilla');
  
  // Obtener todos los paquetes con fechas para análisis
  const packages = await sql`
    SELECT id, company_id, created_at, trip_details, is_paid, delivery_status
    FROM packages 
    ORDER BY created_at DESC 
    LIMIT 20
  `;
  
  console.log(`\n📦 Encontrados ${packages.length} paquetes recientes:`);
  
  packages.forEach(pkg => {
    const tripDetails = typeof pkg.trip_details === 'string' ? JSON.parse(pkg.trip_details) : pkg.trip_details;
    
    console.log(`\nPaquete ${pkg.id}:`);
    console.log(`  - Compañía: ${pkg.company_id}`);
    console.log(`  - Fecha creación: ${pkg.created_at.toISOString().split('T')[0]}`);
    console.log(`  - Trip ID: ${tripDetails?.tripId || 'No definido'}`);
    console.log(`  - Trip Date: ${tripDetails?.departureDate || 'No definida'}`);
    console.log(`  - Pagado: ${pkg.is_paid}`);
    console.log(`  - Estado entrega: ${pkg.delivery_status}`);
  });
  
  // Obtener información sobre usuarios taquilla y sus compañías
  console.log('\n👤 Usuarios taquilla en el sistema:');
  const taquillaUsers = await sql`
    SELECT id, first_name, last_name, email, role, company_id, company
    FROM users 
    WHERE role = 'taquilla'
  `;
  
  taquillaUsers.forEach(user => {
    console.log(`  - ${user.first_name} ${user.last_name} (${user.email})`);
    console.log(`    Company ID: ${user.company_id}`);
    console.log(`    Company: ${user.company}`);
  });
  
  // Saltar análisis detallado de viajes para evitar errores de esquema
  
  // Simular consulta problemática actual
  console.log('\n🔍 PROBLEMA: Filtro actual por fecha de creación');
  const testDate = '2025-07-15'; // Fecha donde sabemos que hay paquetes
  
  const packagesByCreationDate = await sql`
    SELECT id, company_id, created_at, trip_details
    FROM packages 
    WHERE DATE(created_at) = ${testDate}
  `;
  
  console.log(`📅 Paquetes CREADOS el ${testDate}: ${packagesByCreationDate.length}`);
  
  // Mostrar lo que debería ser: filtro por fecha del viaje
  console.log('\n✅ SOLUCIÓN: Filtro por fecha del viaje');
  
  const packagesByTripDate = await sql`
    SELECT id, company_id, created_at, trip_details
    FROM packages 
    WHERE trip_details->>'departureDate' = ${testDate}
  `;
  
  console.log(`🚗 Paquetes con VIAJES del ${testDate}: ${packagesByTripDate.length}`);
  
  packagesByTripDate.forEach(pkg => {
    const tripDetails = typeof pkg.trip_details === 'string' ? JSON.parse(pkg.trip_details) : pkg.trip_details;
    console.log(`  - Paquete ${pkg.id}: Creado ${pkg.created_at.toISOString().split('T')[0]}, Viaje ${tripDetails?.departureDate}`);
  });
}

debugTaquillaPackages().catch(console.error);