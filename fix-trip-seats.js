import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { eq } from 'drizzle-orm';

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

async function fixTripSeats() {
  try {
    console.log('🔧 Iniciando corrección de asientos para todos los viajes...');
    
    // Obtener todos los viajes con problemas
    const result = await pool.query(`
      SELECT * FROM trips 
      WHERE (trip_data->0->>'availableSeats')::integer > capacity 
         OR trip_data->0->>'capacity' IS NULL
      ORDER BY id
    `);
    
    const trips = result.rows;
    console.log(`📊 Viajes que requieren corrección: ${trips.length}`);
    
    for (const trip of trips) {
      console.log(`\n🔄 Procesando viaje ${trip.id}: Capacidad ${trip.capacity}`);
      
      // Obtener reservas activas para este viaje
      const reservationsResult = await pool.query(`
        SELECT * FROM reservations 
        WHERE trip_details->>'recordId' = '${trip.id}' 
        AND status != 'cancelled'
      `);
      
      const reservations = reservationsResult.rows;
      console.log(`📋 Reservas activas: ${reservations.length}`);
      
      // Corregir cada segmento
      const correctedTripData = trip.trip_data.map((segment, index) => {
        // Contar reservas para este segmento específico
        const segmentReservations = reservations.filter(r => 
          r.trip_details?.tripId === segment.tripId
        );
        
        const occupiedSeats = segmentReservations.reduce((sum, r) => {
          const passengersCount = r.trip_details?.passengersData?.length || 0;
          return sum + passengersCount;
        }, 0);
        
        const correctAvailableSeats = trip.capacity - occupiedSeats;
        
        console.log(`  Segmento ${index + 1}: ${occupiedSeats} ocupados → ${correctAvailableSeats} disponibles`);
        
        return {
          ...segment,
          capacity: trip.capacity,
          availableSeats: Math.max(0, correctAvailableSeats)
        };
      });
      
      // Actualizar en la base de datos
      await pool.query(
        'UPDATE trips SET trip_data = $1 WHERE id = $2',
        [JSON.stringify(correctedTripData), trip.id]
      );
      
      console.log(`✅ Viaje ${trip.id} corregido`);
    }
    
    console.log('\n✅ Corrección completada para todos los viajes');
    
  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
  } finally {
    pool.end();
  }
}

fixTripSeats();