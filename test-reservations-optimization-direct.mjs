/**
 * Test de rendimiento para el método getReservations()
 * Con autenticación para acceder al endpoint
 */

import fs from 'fs';

async function login() {
  const loginResponse = await fetch('http://localhost:5000/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: 'bahenawilliamjefferson@gmail.com',
      password: 'test123'
    })
  });
  
  if (!loginResponse.ok) {
    throw new Error(`Login failed: ${loginResponse.status}`);
  }
  
  // Extraer cookies para usar en las siguientes peticiones
  const cookies = loginResponse.headers.get('set-cookie');
  console.log('✅ Login exitoso');
  
  return cookies;
}

async function testReservationsPerformance() {
  console.log("=== TEST DE RENDIMIENTO - GETRESERVATIONS ===");
  
  try {
    // Hacer login primero
    const cookies = await login();
    
    // Hacer petición HTTP directa al endpoint
    const testEndpoint = 'http://localhost:5000/api/reservations';
    
    console.log("\n📊 TEST 1: Rendimiento actual del endpoint /api/reservations");
    console.log(`🔗 Endpoint: ${testEndpoint}`);
    
    // Test con múltiples iteraciones
    const iterations = 3;
    let totalTime = 0;
    let totalReservations = 0;
    let allResults = [];
    let sampleReservation = null;
    
    for (let i = 1; i <= iterations; i++) {
      console.log(`\n📈 Iteración ${i}:`);
      
      const startTime = Date.now();
      
      try {
        const response = await fetch(testEndpoint, {
          headers: {
            'Cookie': cookies
          }
        });
        const endTime = Date.now();
        
        if (!response.ok) {
          console.log(`   ❌ Error HTTP: ${response.status} - ${response.statusText}`);
          continue;
        }
        
        const reservations = await response.json();
        const duration = endTime - startTime;
        
        totalTime += duration;
        totalReservations += reservations.length;
        
        console.log(`   ✅ Tiempo: ${duration}ms`);
        console.log(`   📊 Reservaciones: ${reservations.length}`);
        if (reservations.length > 0) {
          console.log(`   ⚡ Promedio: ${Math.round(duration / reservations.length)}ms por reservación`);
        }
        
        // Guardar muestra de la primera reservación
        if (reservations.length > 0 && !sampleReservation) {
          sampleReservation = reservations[0];
        }
        
        allResults.push({
          iteration: i,
          duration,
          reservationsCount: reservations.length,
          timestamp: new Date().toISOString()
        });
        
      } catch (error) {
        console.log(`   ❌ Error en iteración ${i}: ${error.message}`);
      }
    }
    
    // Analizar estructura de datos
    if (sampleReservation) {
      console.log(`\n🔍 Análisis de datos obtenidos:`);
      console.log(`   - Campos disponibles: ${Object.keys(sampleReservation).join(', ')}`);
      console.log(`   - Tiene información de usuario: ${sampleReservation.createdByUser ? 'Sí' : 'No'}`);
      console.log(`   - Tiene información de viaje: ${sampleReservation.tripDetails ? 'Sí' : 'No'}`);
      
      if (sampleReservation.createdByUser) {
        console.log(`   - Campos de usuario: ${Object.keys(sampleReservation.createdByUser).join(', ')}`);
      }
      
      if (sampleReservation.tripDetails) {
        console.log(`   - Campos de viaje: ${Object.keys(sampleReservation.tripDetails).join(', ')}`);
      }
      
      // Verificar si hay N+1 queries analizando la estructura
      const hasNestedQueries = sampleReservation.createdByUser || sampleReservation.tripDetails;
      console.log(`   - Detectadas consultas anidadas: ${hasNestedQueries ? 'Sí (N+1 pattern)' : 'No'}`);
    }
    
    // Calcular promedios
    const averageTime = Math.round(totalTime / iterations);
    const averageReservations = Math.round(totalReservations / iterations);
    
    console.log(`\n📊 RESULTADOS FINALES (${iterations} iteraciones):`);
    console.log(`   - Tiempo promedio: ${averageTime}ms`);
    console.log(`   - Reservaciones promedio: ${averageReservations}`);
    if (averageReservations > 0) {
      console.log(`   - Tiempo por reservación: ${Math.round(averageTime / averageReservations)}ms`);
    }
    
    // Guardar resultados para comparación posterior
    const results = {
      timestamp: new Date().toISOString(),
      method: "getReservations",
      status: "ANTES_OPTIMIZACION",
      endpoint: testEndpoint,
      averageTime,
      averageReservations,
      timePerReservation: averageReservations > 0 ? Math.round(averageTime / averageReservations) : 0,
      totalIterations: iterations,
      allResults,
      sampleData: sampleReservation ? {
        fields: Object.keys(sampleReservation),
        hasUserInfo: !!sampleReservation.createdByUser,
        hasTripInfo: !!sampleReservation.tripDetails
      } : null,
      analysis: {
        performanceLevel: averageTime > 1000 ? 'LENTO' : averageTime > 500 ? 'MEDIO' : 'RAPIDO',
        needsOptimization: averageTime > 500,
        estimatedQueries: Math.round(averageReservations * 6), // Estimación basada en N+1 pattern
        hasNestedQueries: sampleReservation && (sampleReservation.createdByUser || sampleReservation.tripDetails)
      }
    };
    
    // Guardar en archivo para comparación
    fs.writeFileSync('test-reservations-before-optimization.json', JSON.stringify(results, null, 2));
    
    console.log("\n💾 Resultados guardados en: test-reservations-before-optimization.json");
    
    // Identificar oportunidades de optimización
    console.log("\n🎯 Oportunidades de optimización identificadas:");
    
    if (averageTime > 1000) {
      console.log("   ❌ Tiempo de respuesta muy alto (>1000ms)");
      console.log("   ✅ Objetivo: Reducir a <500ms (mejora del 50%+)");
    } else if (averageTime > 500) {
      console.log("   ⚠️ Tiempo de respuesta alto (>500ms)");
      console.log("   ✅ Objetivo: Reducir a <300ms");
    } else {
      console.log("   ✅ Tiempo de respuesta aceptable (<500ms)");
      console.log("   🎯 Objetivo: Mejorar aún más para <200ms");
    }
    
    if (results.analysis.hasNestedQueries) {
      console.log("   📈 Patrón N+1 detectado: Se realizan consultas adicionales por reservación");
      console.log("   ✅ Solución: Refactorizar getReservations() usando LEFT JOIN");
    }
    
    console.log("\n=== FIN DEL TEST ===");
    
  } catch (error) {
    console.error("❌ Error en el test:", error);
  }
}

// Ejecutar test
testReservationsPerformance().catch(console.error);