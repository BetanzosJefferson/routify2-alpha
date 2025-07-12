/**
 * Test de rendimiento para el método getReservations()
 * Antes y después de la optimización
 */

import fs from 'fs';

async function testReservationsPerformance() {
  console.log("=== TEST DE RENDIMIENTO - GETRESERVATIONS ===");
  
  try {
    // Hacer petición HTTP directa al endpoint
    const testEndpoint = 'http://localhost:5000/api/reservations';
    
    console.log("\n📊 TEST 1: Rendimiento actual del endpoint /api/reservations");
    console.log(`🔗 Endpoint: ${testEndpoint}`);
    
    // Test con múltiples iteraciones
    const iterations = 3;
    let totalTime = 0;
    let totalReservations = 0;
    let allResults = [];
    
    for (let i = 1; i <= iterations; i++) {
      console.log(`\n📈 Iteración ${i}:`);
      
      const startTime = Date.now();
      
      try {
        const response = await fetch(testEndpoint);
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
        console.log(`   ⚡ Promedio: ${Math.round(duration / reservations.length)}ms por reservación`);
        
        // Analizar estructura de la primera reservación
        if (reservations.length > 0 && i === 1) {
          const firstReservation = reservations[0];
          console.log(`\n🔍 Análisis de datos obtenidos:`);
          console.log(`   - Campos disponibles: ${Object.keys(firstReservation).join(', ')}`);
          console.log(`   - Tiene información de usuario: ${firstReservation.createdByUser ? 'Sí' : 'No'}`);
          console.log(`   - Tiene información de viaje: ${firstReservation.tripDetails ? 'Sí' : 'No'}`);
          
          // Verificar si hay N+1 queries analizando la estructura
          const hasNestedQueries = firstReservation.createdByUser || firstReservation.tripDetails;
          console.log(`   - Detectadas consultas anidadas: ${hasNestedQueries ? 'Sí (N+1 pattern)' : 'No'}`);
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
    
    // Calcular promedios
    const averageTime = Math.round(totalTime / iterations);
    const averageReservations = Math.round(totalReservations / iterations);
    
    console.log(`\n📊 RESULTADOS FINALES (${iterations} iteraciones):`);
    console.log(`   - Tiempo promedio: ${averageTime}ms`);
    console.log(`   - Reservaciones promedio: ${averageReservations}`);
    console.log(`   - Tiempo por reservación: ${Math.round(averageTime / averageReservations)}ms`);
    
    // Guardar resultados para comparación posterior
    const results = {
      timestamp: new Date().toISOString(),
      method: "getReservations",
      status: "ANTES_OPTIMIZACION",
      endpoint: testEndpoint,
      averageTime,
      averageReservations,
      timePerReservation: Math.round(averageTime / averageReservations),
      totalIterations: iterations,
      allResults,
      analysis: {
        performanceLevel: averageTime > 1000 ? 'LENTO' : averageTime > 500 ? 'MEDIO' : 'RAPIDO',
        needsOptimization: averageTime > 500,
        estimatedQueries: Math.round(averageReservations * 6), // Estimación basada en N+1 pattern
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
    }
    
    console.log("   📈 Patrón N+1 probable: ~6 consultas por reservación");
    console.log("   ✅ Solución: Refactorizar getReservations() usando LEFT JOIN");
    
    console.log("\n=== FIN DEL TEST ===");
    
  } catch (error) {
    console.error("❌ Error en el test:", error);
  }
}

// Ejecutar test
testReservationsPerformance().catch(console.error);