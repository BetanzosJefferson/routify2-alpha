import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function fixTrip1325() {
  console.log('🔗 Conectado a la base de datos');
  
  // Obtener información del viaje 1325
  const trips = await sql`
    SELECT id, trip_data, capacity, company_id
    FROM trips 
    WHERE id = 1325
  `;
  
  if (trips.length === 0) {
    console.log('❌ Viaje 1325 no encontrado');
    return;
  }
  
  const trip = trips[0];
  console.log(`📊 Viaje ${trip.id}: Capacidad ${trip.capacity}, Segmentos: ${trip.trip_data.length}`);
  
  // Obtener reservas activas para este viaje
  const reservations = await sql`
    SELECT id, trip_details, status
    FROM reservations 
    WHERE company_id = ${trip.company_id}
    AND status NOT IN ('cancelled', 'canceledAndRefund')
  `;
  
  // Filtrar reservas que corresponden al viaje 1325
  const tripReservations = reservations.filter(r => {
    const tripDetails = r.trip_details;
    if (!tripDetails) return false;
    
    const recordId = tripDetails.recordId;
    const tripId = tripDetails.tripId;
    
    return recordId === trip.id || tripId === trip.id;
  });
  
  console.log(`📋 Reservas activas encontradas: ${tripReservations.length}`);
  
  // Calcular asientos ocupados total
  const totalOccupiedSeats = tripReservations.reduce((sum, r) => {
    const seats = r.trip_details?.seats || r.trip_details?.seatCount || r.trip_details?.passengersData?.length || 0;
    return sum + seats;
  }, 0);
  
  const correctAvailableSeats = trip.capacity - totalOccupiedSeats;
  
  console.log(`🪑 Asientos ocupados: ${totalOccupiedSeats}`);
  console.log(`🎯 Capacidad: ${trip.capacity}`);
  console.log(`📊 Asientos disponibles correctos: ${correctAvailableSeats}`);
  console.log(`📊 Asientos disponibles actuales: ${trip.trip_data[0]?.availableSeats}`);
  
  // Corregir todos los segmentos
  const correctedTripData = trip.trip_data.map(segment => ({
    ...segment,
    capacity: trip.capacity,
    availableSeats: correctAvailableSeats
  }));
  
  console.log('\n🔧 Aplicando corrección...');
  
  // Actualizar el viaje en la base de datos
  await sql`
    UPDATE trips 
    SET trip_data = ${JSON.stringify(correctedTripData)}
    WHERE id = 1325
  `;
  
  console.log('✅ Viaje 1325 corregido exitosamente');
  console.log(`   Todos los ${correctedTripData.length} segmentos ahora tienen:`);
  console.log(`   - Capacidad: ${trip.capacity}`);
  console.log(`   - Asientos disponibles: ${correctAvailableSeats}`);
}

fixTrip1325().catch(console.error);