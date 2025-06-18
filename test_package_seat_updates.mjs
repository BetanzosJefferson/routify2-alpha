/**
 * Test para verificar que las paqueterías que ocupan asientos
 * actualicen correctamente la disponibilidad de los viajes
 */

import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';

dotenv.config();

const sql = neon(process.env.DATABASE_URL);

async function testPackageSeatUpdates() {
  console.log('\n=== TEST: ACTUALIZACIÓN DE ASIENTOS EN PAQUETERÍAS ===\n');

  try {
    // 1. Buscar un viaje existente con asientos disponibles
    const trips = await sql`
      SELECT id, "tripData", capacity 
      FROM trips 
      WHERE "tripData" IS NOT NULL 
      AND capacity > 5
      LIMIT 1
    `;

    if (trips.length === 0) {
      console.log('❌ No se encontraron viajes disponibles para la prueba');
      return;
    }

    const trip = trips[0];
    const tripData = JSON.parse(trip.tripData);
    
    console.log(`✓ Viaje seleccionado: ID ${trip.id}, Capacidad: ${trip.capacity}`);
    console.log(`✓ Segmentos disponibles: ${tripData.length}`);

    // Mostrar asientos disponibles iniciales
    tripData.forEach((segment, index) => {
      console.log(`  Segmento ${index}: ${segment.origin} → ${segment.destination} (${segment.availableSeats} asientos)`);
    });

    // 2. Crear una paquetería que ocupe asientos
    const testPackage = {
      senderName: 'Test',
      senderLastName: 'Sender',
      recipientName: 'Test',
      recipientLastName: 'Recipient',
      packageDescription: 'Test Package - Seat Update',
      price: 50.00,
      paymentMethod: 'efectivo',
      usesSeats: true,
      seatsQuantity: 2,
      tripDetails: {
        tripId: `${trip.id}_1`, // Usar segundo segmento
        recordId: trip.id
      },
      companyId: 'test-company',
      createdBy: 1
    };

    console.log('\n--- CREANDO PAQUETERÍA QUE OCUPA ASIENTOS ---');
    console.log(`Paquetería ocupa: ${testPackage.seatsQuantity} asientos`);
    console.log(`Segmento objetivo: ${testPackage.tripDetails.tripId}`);

    // Hacer POST request para crear la paquetería
    const createResponse = await fetch('http://localhost:5000/api/packages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=test-session' // Simular autenticación
      },
      body: JSON.stringify(testPackage)
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.log('❌ Error al crear paquetería:', errorText);
      return;
    }

    const newPackage = await createResponse.json();
    console.log(`✓ Paquetería creada: ID ${newPackage.id}`);

    // 3. Verificar que los asientos se redujeron
    const updatedTrips = await sql`
      SELECT id, "tripData", capacity 
      FROM trips 
      WHERE id = ${trip.id}
    `;

    const updatedTripData = JSON.parse(updatedTrips[0].tripData);
    
    console.log('\n--- VERIFICANDO ACTUALIZACIÓN DE ASIENTOS ---');
    updatedTripData.forEach((segment, index) => {
      const originalSeats = tripData[index].availableSeats;
      const currentSeats = segment.availableSeats;
      const difference = originalSeats - currentSeats;
      
      console.log(`  Segmento ${index}: ${segment.origin} → ${segment.destination}`);
      console.log(`    Antes: ${originalSeats} → Después: ${currentSeats} (Δ${difference})`);
      
      if (index === 1) { // Segmento donde se ocuparon asientos
        if (difference === testPackage.seatsQuantity) {
          console.log(`    ✓ Asientos reducidos correctamente: -${difference}`);
        } else {
          console.log(`    ❌ Error: Se esperaba reducción de ${testPackage.seatsQuantity}, pero fue ${difference}`);
        }
      }
    });

    // 4. Modificar la paquetería (cambiar cantidad de asientos)
    console.log('\n--- MODIFICANDO CANTIDAD DE ASIENTOS ---');
    const updateData = { seatsQuantity: 3 }; // Cambiar de 2 a 3 asientos
    
    const updateResponse = await fetch(`http://localhost:5000/api/packages/${newPackage.id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=test-session'
      },
      body: JSON.stringify(updateData)
    });

    if (updateResponse.ok) {
      console.log(`✓ Paquetería modificada: ${testPackage.seatsQuantity} → ${updateData.seatsQuantity} asientos`);
      
      // Verificar nueva actualización
      const modifiedTrips = await sql`
        SELECT "tripData" FROM trips WHERE id = ${trip.id}
      `;
      
      const modifiedTripData = JSON.parse(modifiedTrips[0].tripData);
      const segmentSeats = modifiedTripData[1].availableSeats;
      const expectedSeats = tripData[1].availableSeats - updateData.seatsQuantity;
      
      console.log(`  Asientos en segmento 1: ${segmentSeats} (esperado: ${expectedSeats})`);
      
      if (segmentSeats === expectedSeats) {
        console.log('  ✓ Modificación de asientos exitosa');
      } else {
        console.log('  ❌ Error en modificación de asientos');
      }
    }

    // 5. Eliminar la paquetería y verificar liberación de asientos
    console.log('\n--- ELIMINANDO PAQUETERÍA ---');
    
    const deleteResponse = await fetch(`http://localhost:5000/api/packages/${newPackage.id}`, {
      method: 'DELETE',
      headers: {
        'Cookie': 'connect.sid=test-session'
      }
    });

    if (deleteResponse.ok) {
      console.log('✓ Paquetería eliminada');
      
      // Verificar liberación de asientos
      const finalTrips = await sql`
        SELECT "tripData" FROM trips WHERE id = ${trip.id}
      `;
      
      const finalTripData = JSON.parse(finalTrips[0].tripData);
      const finalSeats = finalTripData[1].availableSeats;
      const originalSeats = tripData[1].availableSeats;
      
      console.log(`  Asientos finales: ${finalSeats} (original: ${originalSeats})`);
      
      if (finalSeats === originalSeats) {
        console.log('  ✓ Asientos liberados correctamente');
      } else {
        console.log('  ❌ Error: Asientos no fueron liberados completamente');
      }
    }

    console.log('\n🎉 TEST COMPLETADO');

  } catch (error) {
    console.error('❌ Error en el test:', error);
  }
}

// Ejecutar el test
testPackageSeatUpdates();