/**
 * Prueba de sincronización de asientos entre viajes template-based
 */

const { exec } = require('child_process');
const util = require('util');

async function testSeatSynchronization() {
  console.log('🧪 PRUEBA DE SINCRONIZACIÓN DE ASIENTOS');
  console.log('==========================================');
  
  const storage = new DatabaseStorage();
  
  try {
    // 1. Buscar viajes template-based con la misma fecha
    const allTrips = await storage.getTrips();
    const templateTrips = allTrips.filter(trip => trip.templateId);
    
    console.log(`\n📊 Viajes template-based encontrados: ${templateTrips.length}`);
    templateTrips.forEach(trip => {
      console.log(`   - ID: ${trip.id}, Template: ${trip.templateId}, Fecha: ${trip.departureDate}`);
    });
    
    if (templateTrips.length === 0) {
      console.log('❌ No hay viajes template-based para probar');
      return;
    }
    
    // 2. Crear una reservación de prueba
    const testTrip = templateTrips[0];
    console.log(`\n🎯 Creando reservación de prueba en viaje ${testTrip.id}`);
    
    const testReservation = {
      tripId: testTrip.id,
      status: 'confirmed',
      pickupLocation: 'Test Location',
      dropoffLocation: 'Test Destination',
      paymentMethod: 'cash',
      totalAmount: 100,
      seatNumbers: [1, 2], // Reservar asientos 1 y 2
      companyId: testTrip.companyId,
      tripDetails: JSON.stringify({
        recordId: testTrip.id,
        tripId: `${testTrip.id}_0`, // Primer segmento
        seats: [1, 2]
      })
    };
    
    const newReservation = await storage.createReservation(testReservation);
    console.log(`✅ Reservación creada: ID ${newReservation.id}`);
    
    // 3. Verificar que la sincronización funcionó
    console.log('\n🔍 Verificando sincronización...');
    
    // Buscar todos los viajes con la misma plantilla y fecha
    const relatedTrips = templateTrips.filter(trip => 
      trip.templateId === testTrip.templateId && 
      trip.departureDate === testTrip.departureDate
    );
    
    console.log(`\n📋 Viajes relacionados encontrados: ${relatedTrips.length}`);
    
    for (const trip of relatedTrips) {
      const updatedTrip = await storage.getTrip(trip.id);
      console.log(`\n🚌 Viaje ${trip.id}:`);
      console.log(`   - Ocupación actual: ${JSON.stringify(updatedTrip.seatOccupancy)}`);
      
      // Verificar si los asientos están marcados como ocupados
      const segmentOccupancy = updatedTrip.seatOccupancy;
      if (segmentOccupancy && segmentOccupancy['0']) {
        const occupiedSeats = segmentOccupancy['0'];
        console.log(`   - Asientos ocupados en segmento 0: [${occupiedSeats.join(', ')}]`);
        
        if (occupiedSeats.includes(1) && occupiedSeats.includes(2)) {
          console.log('   ✅ Sincronización exitosa - asientos marcados como ocupados');
        } else {
          console.log('   ❌ Sincronización fallida - asientos no marcados');
        }
      } else {
        console.log('   ❌ No hay datos de ocupación de asientos');
      }
    }
    
    // 4. Contar reservaciones totales
    const allReservations = await storage.getReservations();
    const activeReservations = allReservations.filter(res => res.status !== 'cancelled');
    console.log(`\n📊 Total de reservaciones activas: ${activeReservations.length}`);
    
    console.log('\n🎉 Prueba completada');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

// Ejecutar prueba
testSeatSynchronization().catch(console.error);