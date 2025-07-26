import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function debugTripReservations() {
  try {
    console.log('🔗 Conectado a la base de datos');
    
    const tripId = 1313;
    
    // 1. Obtener datos del viaje
    console.log('\n=== DATOS DEL VIAJE ===');
    const tripResult = await pool.query(`
      SELECT id, capacity, trip_data
      FROM trips 
      WHERE id = $1
    `, [tripId]);
    
    const trip = tripResult.rows[0];
    console.log(`📊 Viaje ${tripId}: Capacidad ${trip.capacity}, Segmentos: ${trip.trip_data.length}`);
    
    // Mostrar primeros 3 segmentos para debug
    for (let i = 0; i < Math.min(3, trip.trip_data.length); i++) {
      const segment = trip.trip_data[i];
      console.log(`  Segmento ${i}: tripId=${segment.tripId}, availableSeats=${segment.availableSeats}`);
    }
    
    // 2. Obtener reservas activas
    console.log('\n=== RESERVAS ACTIVAS ===');
    const reservationsResult = await pool.query(`
      SELECT 
        id,
        status,
        trip_details,
        trip_details->>'tripId' as trip_id,
        trip_details->>'recordId' as record_id,
        trip_details->>'seats' as seats
      FROM reservations 
      WHERE trip_details->>'recordId' = $1
        AND status NOT IN ('cancelled', 'canceledAndRefund')
      ORDER BY id
    `, [tripId.toString()]);
    
    const reservations = reservationsResult.rows;
    console.log(`📋 Reservas activas encontradas: ${reservations.length}`);
    
    reservations.forEach(r => {
      console.log(`  Reserva ${r.id}: tripId=${r.trip_id}, recordId=${r.record_id}, seats=${r.seats}, status=${r.status}`);
    });
    
    // 3. Probar lógica de filtrado para primeros 3 segmentos
    console.log('\n=== LÓGICA DE FILTRADO ===');
    
    for (let i = 0; i < Math.min(3, trip.trip_data.length); i++) {
      const segment = trip.trip_data[i];
      console.log(`\n📍 Segmento ${i} (tripId: ${segment.tripId}):`);
      
      const segmentBaseId = segment.tripId.toString().split('_')[0];
      console.log(`  Base ID extraído: ${segmentBaseId}`);
      
      let matchingReservations = [];
      
      reservations.forEach(r => {
        const reservationTripId = r.trip_id;
        const reservationRecordId = r.record_id;
        
        const matches = reservationTripId === segment.tripId || 
               reservationRecordId === segment.tripId ||
               reservationTripId === segmentBaseId ||
               reservationRecordId === segmentBaseId ||
               reservationTripId === tripId.toString() ||
               reservationRecordId === tripId.toString();
        
        console.log(`    Reserva ${r.id}: tripId=${reservationTripId}, recordId=${reservationRecordId} → matches=${matches}`);
        
        if (matches) {
          matchingReservations.push(r);
        }
      });
      
      const occupiedSeats = matchingReservations.reduce((sum, r) => {
        const seats = parseInt(r.seats) || 0;
        return sum + seats;
      }, 0);
      
      const expectedAvailableSeats = trip.capacity - occupiedSeats;
      
      console.log(`  Reservas coincidentes: ${matchingReservations.length}`);
      console.log(`  Asientos ocupados: ${occupiedSeats}`);
      console.log(`  Asientos disponibles esperados: ${expectedAvailableSeats}`);
      console.log(`  Asientos disponibles actuales: ${segment.availableSeats}`);
      
      if (expectedAvailableSeats !== segment.availableSeats) {
        console.log(`  ⚠️  DIFERENCIA DETECTADA: esperado ${expectedAvailableSeats}, actual ${segment.availableSeats}`);
      } else {
        console.log(`  ✅ COINCIDENCIA CORRECTA`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

debugTripReservations();