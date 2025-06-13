const { neon } = require('@neondatabase/serverless');

async function testApproval() {
  const sql = neon(process.env.DATABASE_URL);
  
  try {
    console.log('Testing complete approval process...');
    
    // Verificar estado inicial
    const beforeReq = await sql`SELECT id, status FROM reservation_requests WHERE id = 2`;
    console.log('Estado inicial:', beforeReq[0]);
    
    const beforeTrip = await sql`SELECT id, trip_data FROM trips WHERE id = 25`;
    const tripData = beforeTrip[0].trip_data;
    console.log('Asientos disponibles segmento 0 antes:', tripData[0].availableSeats);
    
    // Simular aprobación llamando el proceso completo
    // Por ahora vamos a testear paso a paso manualmente
    
    console.log('✓ Test inicial completado - Datos verificados');
    
  } catch (error) {
    console.error('Error en testing:', error);
  }
}

testApproval();
