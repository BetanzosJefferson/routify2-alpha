const { neon } = await import('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function checkSeatUpdates() {
  console.log('\n=== VERIFICACIÓN DIRECTA DE ASIENTOS ===\n');

  try {
    // 1. Ver estado actual del viaje 84
    const trip = await sql`
      SELECT id, trip_data, capacity 
      FROM trips 
      WHERE id = 84
    `;

    if (trip.length === 0) {
      console.log('❌ Viaje 84 no encontrado');
      return;
    }

    const tripData = trip[0].trip_data;
    console.log(`✓ Viaje 84 - Capacidad: ${trip[0].capacity}`);
    console.log(`✓ Segmentos: ${tripData.length}`);
    
    // Mostrar algunos segmentos clave
    console.log('\n--- ASIENTOS ACTUALES (primeros 5 segmentos) ---');
    tripData.slice(0, 5).forEach((segment, index) => {
      console.log(`  Segmento ${index}: ${segment.origin} → ${segment.destination} (${segment.availableSeats} asientos)`);
    });

    // 2. Ver si hay paqueterías que usan asientos en este viaje
    const packages = await sql`
      SELECT id, uses_seats, seats_quantity, trip_details, created_at 
      FROM packages 
      WHERE uses_seats = true 
      AND seats_quantity > 0
      AND (trip_details->>'tripId' LIKE '84_%' OR trip_details->>'tripId' LIKE '%84%')
      ORDER BY created_at DESC
    `;

    console.log(`\n--- PAQUETERÍAS QUE USAN ASIENTOS EN VIAJE 84 ---`);
    console.log(`Total encontradas: ${packages.length}`);
    
    packages.forEach((pkg, index) => {
      const tripDetails = pkg.trip_details;
      console.log(`  ${index + 1}. ID: ${pkg.id}, Asientos: ${pkg.seats_quantity}, Segmento: ${tripDetails.tripId}, Fecha: ${pkg.created_at}`);
    });

    // 3. Calcular asientos que deberían estar ocupados
    const totalSeatsByPackages = packages.reduce((sum, pkg) => sum + (pkg.seats_quantity || 0), 0);
    console.log(`\nTotal asientos ocupados por paqueterías: ${totalSeatsByPackages}`);

    // 4. Ver reservaciones que ocupan asientos
    const reservations = await sql`
      SELECT COUNT(*) as count, SUM((trip_details->>'seats')::int) as total_seats
      FROM reservations 
      WHERE trip_details->>'tripId' LIKE '84_%'
      AND status != 'cancelada'
    `;

    const reservationSeats = reservations[0].total_seats || 0;
    console.log(`Total asientos ocupados por reservaciones: ${reservationSeats}`);

    // 5. Verificar la matemática
    const expectedAvailableSeats = trip[0].capacity - totalSeatsByPackages - reservationSeats;
    const actualAvailableSeats = tripData[0].availableSeats; // Usar primer segmento como referencia

    console.log(`\n--- VERIFICACIÓN MATEMÁTICA ---`);
    console.log(`Capacidad original: ${trip[0].capacity}`);
    console.log(`- Asientos por paqueterías: ${totalSeatsByPackages}`);
    console.log(`- Asientos por reservaciones: ${reservationSeats}`);
    console.log(`= Asientos esperados disponibles: ${expectedAvailableSeats}`);
    console.log(`Asientos reales en BD: ${actualAvailableSeats}`);

    if (expectedAvailableSeats === actualAvailableSeats) {
      console.log(`🎉 ¡CORRECTO! Los asientos coinciden - La función está funcionando`);
    } else {
      console.log(`❌ PROBLEMA: Los asientos no coinciden - La función no está actualizando correctamente`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

checkSeatUpdates().then(() => {
  console.log('\n--- VERIFICACIÓN COMPLETADA ---');
}).catch(console.error);