/**
 * Test de rendimiento para el método getReservations()
 * Antes y después de la optimización
 */

import { neonConfig } from "@neondatabase/serverless";
import { DatabaseStorage } from "./server/db-storage.js";
import fs from 'fs';

// Configurar Neon para Node.js
neonConfig.fetchConnectionCache = true;

async function testReservationsPerformance() {
  console.log("=== TEST DE RENDIMIENTO - GETRESERVATIONS ===");
  
  try {
    // Inicializar storage
    const storage = new DatabaseStorage();
    
    // Test 1: Medir rendimiento actual
    console.log("\n📊 TEST 1: Rendimiento actual del método getReservations()");
    
    const startTime = Date.now();
    const reservations = await storage.getReservations();
    const endTime = Date.now();
    
    const duration = endTime - startTime;
    
    console.log(`✅ Resultado:`);
    console.log(`   - Tiempo total: ${duration}ms`);
    console.log(`   - Reservaciones obtenidas: ${reservations.length}`);
    console.log(`   - Promedio por reservación: ${Math.round(duration / reservations.length)}ms`);
    
    // Analizar estructura de datos
    console.log("\n🔍 Análisis de datos obtenidos:");
    if (reservations.length > 0) {
      const firstReservation = reservations[0];
      console.log(`   - Campos disponibles: ${Object.keys(firstReservation).join(', ')}`);
      console.log(`   - Tiene información de usuario: ${firstReservation.createdByUser ? 'Sí' : 'No'}`);
      console.log(`   - Tiene información de viaje: ${firstReservation.tripDetails ? 'Sí' : 'No'}`);
      
      // Verificar si hay N+1 queries analizando la estructura
      const hasNestedQueries = firstReservation.createdByUser || firstReservation.tripDetails;
      console.log(`   - Detectadas consultas anidadas: ${hasNestedQueries ? 'Sí (N+1 pattern)' : 'No'}`);
    }
    
    // Test 2: Análisis de performance por categorías
    console.log("\n📈 Análisis detallado de performance:");
    
    // Simular múltiples llamadas para obtener promedio
    const iterations = 3;
    let totalTime = 0;
    let totalReservations = 0;
    
    for (let i = 1; i <= iterations; i++) {
      const iterationStart = Date.now();
      const iterationReservations = await storage.getReservations();
      const iterationEnd = Date.now();
      
      const iterationTime = iterationEnd - iterationStart;
      totalTime += iterationTime;
      totalReservations += iterationReservations.length;
      
      console.log(`   Iteración ${i}: ${iterationTime}ms (${iterationReservations.length} reservaciones)`);
    }
    
    const averageTime = Math.round(totalTime / iterations);
    const averageReservations = Math.round(totalReservations / iterations);
    
    console.log(`\n📊 Promedio de ${iterations} iteraciones:`);
    console.log(`   - Tiempo promedio: ${averageTime}ms`);
    console.log(`   - Reservaciones promedio: ${averageReservations}`);
    console.log(`   - Tiempo por reservación: ${Math.round(averageTime / averageReservations)}ms`);
    
    // Guardar resultados para comparación posterior
    const results = {
      timestamp: new Date().toISOString(),
      method: "getReservations",
      status: "ANTES_OPTIMIZACION",
      averageTime,
      averageReservations,
      timePerReservation: Math.round(averageTime / averageReservations),
      totalIterations: iterations,
      analysis: {
        hasNestedQueries: reservations.length > 0 && (reservations[0].createdByUser || reservations[0].tripDetails),
        availableFields: reservations.length > 0 ? Object.keys(reservations[0]) : [],
        hasUserInfo: reservations.length > 0 && !!reservations[0].createdByUser,
        hasTripInfo: reservations.length > 0 && !!reservations[0].tripDetails
      }
    };
    
    // Guardar en archivo para comparación
    fs.writeFileSync('test-reservations-before-optimization.json', JSON.stringify(results, null, 2));
    
    console.log("\n💾 Resultados guardados en: test-reservations-before-optimization.json");
    
    // Identificar oportunidades de optimización
    console.log("\n🎯 Oportunidades de optimización identificadas:");
    if (results.analysis.hasNestedQueries) {
      console.log("   ❌ Patrón N+1 detectado: Se realizan consultas adicionales por cada reservación");
      console.log("   ✅ Solución: Usar LEFT JOIN para obtener toda la información en una sola consulta");
    }
    
    if (averageTime > 1000) {
      console.log("   ❌ Tiempo de respuesta alto (>1000ms)");
      console.log("   ✅ Objetivo: Reducir a <500ms");
    }
    
    console.log("\n=== FIN DEL TEST ===");
    
  } catch (error) {
    console.error("❌ Error en el test:", error);
  }
}

// Ejecutar test
testReservationsPerformance().catch(console.error);