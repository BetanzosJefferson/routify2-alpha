import { drizzle } from 'drizzle-orm/node-postgres';
import pg from 'pg';
import { eq } from 'drizzle-orm';

const { Pool } = pg;

// Configurar conexión a la base de datos
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Definir esquema básico
const schema = {
  trips: {
    id: 'id',
    tripData: 'trip_data',
    capacity: 'capacity'
  },
  reservations: {
    id: 'id',
    tripDetails: 'trip_details',
    status: 'status'
  }
};

async function fixAvailableSeats() {
  try {
    console.log('🔧 Iniciando corrección de asientos disponibles...');
    
    // Obtener el viaje 1228
    const result = await pool.query('SELECT * FROM trips WHERE id = 1228');
    const trip = result.rows[0];
    
    if (!trip) {
      console.error('❌ Viaje 1228 no encontrado');
      return;
    }
    
    console.log(`📊 Viaje 1228: Capacidad ${trip.capacity}`);
    console.log(`📊 Segmentos: ${trip.trip_data.length}`);
    
    // Obtener reservas activas para este viaje
    const reservationsResult = await pool.query(`
      SELECT * FROM reservations 
      WHERE trip_details->>'recordId' = '1228' 
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
      
      console.log(`🔄 Segmento ${index + 1} (${segment.tripId}): ${occupiedSeats} ocupados → ${correctAvailableSeats} disponibles (era ${segment.availableSeats})`);
      
      return {
        ...segment,
        capacity: trip.capacity,
        availableSeats: Math.max(0, correctAvailableSeats)
      };
    });
    
    // Actualizar en la base de datos
    await pool.query(
      'UPDATE trips SET trip_data = $1 WHERE id = $2',
      [JSON.stringify(correctedTripData), 1228]
    );
    
    console.log('✅ Corrección completada');
    
    // Verificar resultado
    const verifyResult = await pool.query('SELECT trip_data->0->\'availableSeats\' as first_segment_available FROM trips WHERE id = 1228');
    console.log(`✅ Verificación: Primer segmento ahora tiene ${verifyResult.rows[0].first_segment_available} asientos disponibles`);
    
  } catch (error) {
    console.error('❌ Error durante la corrección:', error);
  } finally {
    pool.end();
  }
}

fixAvailableSeats();