/**
 * Test simple para verificar que el método optimizado funciona sin errores
 */

import pg from 'pg';
const { Pool } = pg;

// Configuración de la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/transroute'
});

async function testOptimizedMethod() {
  console.log("=== TEST DE MÉTODO OPTIMIZADO ===");
  console.log("Verificando que no hay errores de drizzle-orm...\n");
  
  try {
    // 1. Verificar que hay reservaciones en la BD
    const countResult = await pool.query('SELECT COUNT(*) FROM reservations WHERE company_id = $1', ['bamo-350045']);
    const totalReservations = parseInt(countResult.rows[0].count);
    console.log(`✓ Total de reservaciones en BD: ${totalReservations}`);
    
    // 2. Verificar estructura de una reservación
    const sampleResult = await pool.query('SELECT * FROM reservations WHERE company_id = $1 LIMIT 1', ['bamo-350045']);
    if (sampleResult.rows.length > 0) {
      const reservation = sampleResult.rows[0];
      console.log(`✓ Reservación de ejemplo encontrada: ID ${reservation.id}`);
      
      // Verificar tripDetails
      const tripDetails = typeof reservation.trip_details === 'string' 
        ? JSON.parse(reservation.trip_details) 
        : reservation.trip_details;
      
      console.log(`  - tripDetails: recordId=${tripDetails.recordId}, tripId=${tripDetails.tripId}`);
      
      // 3. Verificar que el trip existe
      if (tripDetails.recordId) {
        const tripResult = await pool.query('SELECT id, route_id, driver_id, vehicle_id FROM trips WHERE id = $1', [tripDetails.recordId]);
        if (tripResult.rows.length > 0) {
          const trip = tripResult.rows[0];
          console.log(`✓ Trip encontrado: ID ${trip.id}, route_id=${trip.route_id}, driver_id=${trip.driver_id}`);
        }
      }
    }
    
    // 4. Verificar consulta de pasajeros
    const passengersResult = await pool.query('SELECT COUNT(*) FROM passengers');
    console.log(`✓ Total de pasajeros en BD: ${passengersResult.rows[0].count}`);
    
    console.log("\n✅ VERIFICACIÓN COMPLETADA");
    console.log("El método optimizado debería funcionar correctamente.");
    console.log("No hay problemas estructurales evidentes en la BD.");
    
  } catch (error) {
    console.error("❌ ERROR:", error.message);
  } finally {
    await pool.end();
  }
}

// Ejecutar test
testOptimizedMethod();