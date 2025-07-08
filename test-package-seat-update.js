const { neon } = await import('@neondatabase/serverless');

const sql = neon(process.env.DATABASE_URL);

async function testPackageSeatUpdates() {
  console.log('\n=== TEST: ACTUALIZACIÓN DE ASIENTOS EN PAQUETERÍAS ===\n');

  try {
    // 1. Buscar un viaje con asientos disponibles
    const trips = await sql`
      SELECT id, trip_data, capacity 
      FROM trips 
      WHERE trip_data IS NOT NULL 
      AND capacity > 5
      AND company_id = 'bamo-350045'
      LIMIT 1
    `;

    if (trips.length === 0) {
      console.log('❌ No se encontraron viajes disponibles para la prueba');
      return;
    }

    const trip = trips[0];
    // Verificar que trip_data es realmente un array
    let tripData;
    if (typeof trip.trip_data === 'string') {
      tripData = JSON.parse(trip.trip_data);
    } else if (Array.isArray(trip.trip_data)) {
      tripData = trip.trip_data;
    } else {
      console.log('❌ trip_data no es un array válido:', typeof trip.trip_data);
      return;
    }
    
    console.log(`✓ Viaje seleccionado: ID ${trip.id}, Capacidad: ${trip.capacity}`);
    console.log(`✓ Segmentos disponibles: ${tripData.length}`);

    // Mostrar asientos disponibles antes de la paquetería
    console.log('\n--- ASIENTOS ANTES DE CREAR PAQUETERÍA ---');
    tripData.forEach((segment, index) => {
      console.log(`  Segmento ${index}: ${segment.origin} → ${segment.destination} (${segment.availableSeats} asientos)`);
    });

    // 2. Crear una paquetería que ocupe 2 asientos
    const testPackage = {
      senderName: 'Test Sender',
      senderLastName: 'Test Last',
      senderPhone: '1234567890',
      recipientName: 'Test Recipient',
      recipientLastName: 'Test Recipient Last',
      recipientPhone: '0987654321',
      packageDescription: 'Paquete de prueba - Actualización de asientos',
      price: 100.00,
      paymentMethod: 'efectivo',
      isPaid: false,
      usesSeats: true,
      seatsQuantity: 2,
      tripDetails: {
        tripId: `${trip.id}_1`, // Usar segundo segmento
        recordId: trip.id,
        origin: tripData[1].origin,
        destination: tripData[1].destination,
        departureDate: '2025-07-08',
        departureTime: tripData[1].departureTime || '10:00 AM',
        arrivalTime: tripData[1].arrivalTime || '12:00 PM'
      },
      companyId: 'bamo-350045'
    };

    console.log('\n--- CREANDO PAQUETERÍA QUE OCUPA ASIENTOS ---');
    console.log(`Paquetería ocupará: ${testPackage.seatsQuantity} asientos`);
    console.log(`Segmento objetivo: ${testPackage.tripDetails.tripId}`);

    // Hacer POST request para crear la paquetería
    const createResponse = await fetch('http://localhost:5000/api/packages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=s%3AeTLaVpLvxUxqjXLSMhxb0H1jOdJWyeJL.4fIWWgK6dJLhJV4SLqJU0pJf3LVEK%2BBXnE%2FNs%2FuNJlg' // Cookie de sesión válida
      },
      body: JSON.stringify(testPackage)
    });

    console.log(`Status de creación: ${createResponse.status}`);

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log('❌ Error al crear paquetería:', errorText);
      return;
    }

    const newPackage = await createResponse.json();
    console.log(`✓ Paquetería creada: ID ${newPackage.id}`);

    // 3. Verificar que los asientos se redujeron
    console.log('\n--- VERIFICANDO ACTUALIZACIÓN DE ASIENTOS ---');
    const updatedTrips = await sql`
      SELECT id, trip_data, capacity 
      FROM trips 
      WHERE id = ${trip.id}
    `;

    const updatedTripData = JSON.parse(updatedTrips[0].trip_data);
    
    let seatUpdateWorking = false;
    updatedTripData.forEach((segment, index) => {
      const originalSeats = tripData[index].availableSeats;
      const currentSeats = segment.availableSeats;
      const difference = originalSeats - currentSeats;
      
      console.log(`  Segmento ${index}: ${segment.origin} → ${segment.destination}`);
      console.log(`    Antes: ${originalSeats} → Después: ${currentSeats} (Δ${difference})`);
      
      if (difference > 0) {
        seatUpdateWorking = true;
        console.log(`    ✓ Asientos reducidos: -${difference}`);
      }
    });

    if (seatUpdateWorking) {
      console.log('\n🎉 ¡ÉXITO! La actualización de asientos está funcionando correctamente');
    } else {
      console.log('\n❌ PROBLEMA: Los asientos no se redujeron. La función updateRelatedTripsAvailability no está funcionando');
    }

    // 4. Limpiar - eliminar la paquetería de prueba
    console.log('\n--- LIMPIANDO DATOS DE PRUEBA ---');
    await sql`DELETE FROM packages WHERE id = ${newPackage.id}`;
    console.log('✓ Paquetería de prueba eliminada');

    // Restaurar asientos si se redujeron
    if (seatUpdateWorking) {
      await sql`
        UPDATE trips 
        SET trip_data = ${JSON.stringify(tripData)}
        WHERE id = ${trip.id}
      `;
      console.log('✓ Asientos restaurados al estado original');
    }

  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
}

// Ejecutar el test
testPackageSeatUpdates().then(() => {
  console.log('\n--- TEST COMPLETADO ---');
}).catch(console.error);