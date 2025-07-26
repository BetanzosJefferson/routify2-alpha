import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function debugTrip1325() {
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
  console.log('\n=== DATOS DEL VIAJE 1325 ===');
  console.log(`📊 Viaje ${trip.id}: Capacidad ${trip.capacity}, Segmentos: ${trip.trip_data.length}`);
  console.log(`🏢 Compañía: ${trip.company_id}`);
  
  // Mostrar primeros 3 segmentos
  trip.trip_data.slice(0, 3).forEach((segment, index) => {
    console.log(`  Segmento ${index}: tripId=${segment.tripId}, availableSeats=${segment.availableSeats}, capacity=${segment.capacity}`);
  });
  
  // Obtener reservas para este viaje
  const reservations = await sql`
    SELECT id, trip_details, status, created_by, company_id
    FROM reservations 
    WHERE company_id = ${trip.company_id}
    AND status NOT IN ('cancelled', 'canceledAndRefund')
    ORDER BY id DESC
  `;
  
  console.log(`\n=== RESERVAS ACTIVAS (${reservations.length} total) ===`);
  
  // Filtrar reservas que corresponden al viaje 1325
  const tripReservations = reservations.filter(r => {
    const tripDetails = r.trip_details;
    if (!tripDetails) return false;
    
    const recordId = tripDetails.recordId;
    const tripId = tripDetails.tripId;
    
    return recordId === trip.id || tripId === trip.id || 
           (typeof tripId === 'string' && tripId.startsWith(trip.id.toString()));
  });
  
  console.log(`📋 Reservas encontradas para viaje 1325: ${tripReservations.length}`);
  
  tripReservations.forEach(r => {
    const seats = r.trip_details?.seats || r.trip_details?.seatCount || r.trip_details?.passengersData?.length || 0;
    console.log(`  Reserva ${r.id}: tripId=${r.trip_details?.tripId}, recordId=${r.trip_details?.recordId}, seats=${seats}, status=${r.status}`);
  });
  
  // Calcular asientos ocupados total
  const totalOccupiedSeats = tripReservations.reduce((sum, r) => {
    const seats = r.trip_details?.seats || r.trip_details?.seatCount || r.trip_details?.passengersData?.length || 0;
    return sum + seats;
  }, 0);
  
  console.log(`\n=== CÁLCULO DE ASIENTOS ===`);
  console.log(`🪑 Asientos ocupados total: ${totalOccupiedSeats}`);
  console.log(`🎯 Capacidad actual: ${trip.capacity}`);
  console.log(`📊 Asientos disponibles esperados: ${trip.capacity - totalOccupiedSeats}`);
  console.log(`📊 Asientos disponibles en DB: ${trip.trip_data[0]?.availableSeats}`);
  
  if (trip.trip_data[0]?.availableSeats !== trip.capacity - totalOccupiedSeats) {
    console.log(`⚠️  PROBLEMA DETECTADO: Los asientos disponibles en la DB no coinciden con el cálculo`);
  } else {
    console.log(`✅ CÁLCULO CORRECTO`);
  }
  
  // Verificar si hay algo raro en los segmentos
  console.log(`\n=== ANÁLISIS DE SEGMENTOS ===`);
  const uniqueAvailableSeats = [...new Set(trip.trip_data.map(s => s.availableSeats))];
  console.log(`🔍 Valores únicos de availableSeats: ${uniqueAvailableSeats.join(', ')}`);
  
  if (uniqueAvailableSeats.length > 1) {
    console.log(`⚠️  ADVERTENCIA: Los segmentos tienen diferentes valores de asientos disponibles`);
    trip.trip_data.slice(0, 5).forEach((segment, index) => {
      console.log(`  Seg ${index}: availableSeats=${segment.availableSeats}, capacity=${segment.capacity}`);
    });
  }
}

debugTrip1325().catch(console.error);