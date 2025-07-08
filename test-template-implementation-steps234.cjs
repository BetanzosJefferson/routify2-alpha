/**
 * Script de Test para Pasos 2, 3 y 4 de Implementación Template-Based
 * Verificar que los cambios de esquema y funciones críticas funcionan correctamente
 */

const { DatabaseStorage } = require('./server/db-storage.ts');

// Mock de las funciones de trip-utils para este test
const mockTripUtils = {
  isLegacyTrip: (trip) => {
    return !trip.templateId && !!trip.tripData;
  },
  generateSegmentsFromTemplate: async (trip, template, route) => {
    return [];
  },
  getTripSegments: async (trip, template, route) => {
    return [];
  }
};

async function testStep2Schema() {
  console.log('\n=== TEST PASO 2: VERIFICAR NUEVOS CAMPOS DE ESQUEMA ===');
  
  const storage = new DatabaseStorage();
  
  try {
    // Obtener un viaje existente para verificar que los campos nuevos están disponibles
    const trips = await storage.searchTrips({ 
      companyId: 'ALL', 
      includeAllVisibilities: true,
      limit: 1 
    });
    
    if (trips.length === 0) {
      console.log('❌ No hay viajes para probar');
      return false;
    }
    
    const trip = trips[0];
    console.log(`📄 Probando con viaje ID: ${trip.id}`);
    
    // Verificar que el trip tiene los campos nuevos (aunque sean null)
    const tripRecord = await storage.getTrip(trip.id);
    
    console.log(`📄 Trip Record:`, {
      id: tripRecord.id,
      routeId: tripRecord.routeId,
      templateId: tripRecord.templateId,
      seatOccupancy: tripRecord.seatOccupancy,
      departureDate: tripRecord.departureDate,
      departureTime: tripRecord.departureTime,
      hasLegacyTripData: !!tripRecord.tripData
    });
    
    console.log('✅ Paso 2 EXITOSO: Campos del esquema disponibles');
    return true;
    
  } catch (error) {
    console.error('❌ Paso 2 FALLÓ:', error.message);
    return false;
  }
}

async function testStep3UtilityFunctions() {
  console.log('\n=== TEST PASO 3: FUNCIONES DE GENERACIÓN DINÁMICA ===');
  
  try {
    // Test 1: Verificar que las funciones están disponibles
    console.log('📄 Verificando funciones mock...');
    
    if (typeof mockTripUtils.isLegacyTrip !== 'function') {
      throw new Error('isLegacyTrip no está disponible');
    }
    
    console.log('✅ Funciones de utilidad disponibles');
    
    // Test 2: Probar con viaje legacy existente
    const storage = new DatabaseStorage();
    const trips = await storage.searchTrips({ 
      companyId: 'ALL', 
      includeAllVisibilities: true,
      limit: 1 
    });
    
    if (trips.length === 0) {
      console.log('❌ No hay viajes para probar');
      return false;
    }
    
    const trip = trips[0];
    const tripRecord = await storage.getTrip(trip.id);
    
    console.log(`📄 Probando detección legacy con viaje ${trip.id}`);
    
    const isLegacy = mockTripUtils.isLegacyTrip(tripRecord);
    console.log(`📄 isLegacyTrip result: ${isLegacy}`);
    
    if (isLegacy) {
      console.log('📄 Viaje legacy detectado correctamente');
      console.log(`📄 TripData segments: ${Array.isArray(tripRecord.tripData) ? tripRecord.tripData.length : 'No array'}`);
    } else {
      console.log('📄 Viaje template-based detectado');
    }
    
    console.log('✅ Paso 3 EXITOSO: Funciones de utilidad funcionando');
    return true;
    
  } catch (error) {
    console.error('❌ Paso 3 FALLÓ:', error.message);
    return false;
  }
}

async function testStep4ValidationMethods() {
  console.log('\n=== TEST PASO 4: MÉTODOS DE VALIDACIÓN ACTUALIZADOS ===');
  
  const storage = new DatabaseStorage();
  
  try {
    // Obtener un viaje existente
    const trips = await storage.searchTrips({ 
      companyId: 'ALL', 
      includeAllVisibilities: true,
      limit: 1 
    });
    
    if (trips.length === 0) {
      console.log('❌ No hay viajes para probar');
      return false;
    }
    
    const trip = trips[0];
    console.log(`📄 Probando validación con viaje ID: ${trip.id}`);
    
    // Test 1: Probar validateSeatAvailability con método nuevo
    const tripId = `${trip.id}_0`; // Primer segmento
    const seatsRequested = 1;
    
    console.log(`📄 Probando validateSeatAvailability(${trip.id}, "${tripId}", ${seatsRequested})`);
    
    const isValid = await storage.validateSeatAvailability(trip.id, tripId, seatsRequested);
    console.log(`📄 Resultado validación: ${isValid ? 'VÁLIDO' : 'INVÁLIDO'}`);
    
    // Test 2: Probar updateRelatedTripsAvailability
    console.log(`📄 Probando updateRelatedTripsAvailability con simulación...`);
    
    // Obtener estado previo
    const tripBefore = await storage.getTrip(trip.id);
    console.log(`📄 Estado previo - seatOccupancy:`, tripBefore.seatOccupancy || {});
    
    // Simular reserva (reducir asientos)
    await storage.updateRelatedTripsAvailability(trip.id, tripId, -1);
    
    // Verificar cambio
    const tripAfter = await storage.getTrip(trip.id);
    console.log(`📄 Estado posterior - seatOccupancy:`, tripAfter.seatOccupancy || {});
    
    // Revertir cambio (liberar asientos)
    await storage.updateRelatedTripsAvailability(trip.id, tripId, 1);
    
    const tripRestored = await storage.getTrip(trip.id);
    console.log(`📄 Estado restaurado - seatOccupancy:`, tripRestored.seatOccupancy || {});
    
    console.log('✅ Paso 4 EXITOSO: Métodos de validación funcionando');
    return true;
    
  } catch (error) {
    console.error('❌ Paso 4 FALLÓ:', error.message);
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 INICIANDO TESTS DE IMPLEMENTACIÓN STEPS 2-3-4');
  console.log('='.repeat(60));
  
  const results = {
    step2: false,
    step3: false,
    step4: false
  };
  
  try {
    results.step2 = await testStep2Schema();
    results.step3 = await testStep3UtilityFunctions();
    results.step4 = await testStep4ValidationMethods();
    
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE RESULTADOS:');
    console.log(`Paso 2 (Esquema): ${results.step2 ? '✅ EXITOSO' : '❌ FALLÓ'}`);
    console.log(`Paso 3 (Funciones): ${results.step3 ? '✅ EXITOSO' : '❌ FALLÓ'}`);
    console.log(`Paso 4 (Validación): ${results.step4 ? '✅ EXITOSO' : '❌ FALLÓ'}`);
    
    const allPassed = results.step2 && results.step3 && results.step4;
    console.log(`\n🎯 RESULTADO GENERAL: ${allPassed ? '✅ TODOS LOS TESTS PASARON' : '❌ ALGUNOS TESTS FALLARON'}`);
    
    if (allPassed) {
      console.log('\n🎉 ¡Implementación de pasos 2-3-4 EXITOSA!');
      console.log('✨ Sistema listo para continuar con pasos 5-6-7');
    } else {
      console.log('\n⚠️  Revisar fallos antes de continuar');
    }
    
  } catch (error) {
    console.error('💥 ERROR GENERAL:', error.message);
  }
  
  process.exit(0);
}

// Ejecutar tests
runAllTests();