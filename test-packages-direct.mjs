#!/usr/bin/env node

import { performance } from 'perf_hooks';
import { DbStorage } from './server/db-storage.js';
import { drizzle } from 'drizzle-orm/neon-serverless';
import { neon } from '@neondatabase/serverless';

// Configurar la conexión a la base de datos
const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5432/transroute';
const sql = neon(connectionString);
const db = drizzle(sql);

// Crear instancia de storage
const storage = new DbStorage(db);

console.log('🚀 INICIANDO TESTS DE RENDIMIENTO - PAQUETERÍAS (DIRECTO)');
console.log('=' .repeat(60));

/**
 * Test del método getPackages (básico)
 */
async function testGetPackages() {
  console.log('\n📦 TESTING: getPackages() - Método básico');
  console.log('=' .repeat(50));
  
  const startTime = performance.now();
  
  try {
    // Test sin filtros
    const packages = await storage.getPackages();
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    console.log(`⏱️  Tiempo de respuesta: ${responseTime.toFixed(2)}ms`);
    console.log(`📊 Total paquetes: ${packages.length}`);
    
    if (packages.length > 0) {
      console.log(`🔍 Campos del primer paquete: ${Object.keys(packages[0]).join(', ')}`);
    }
    
    return {
      method: 'getPackages',
      responseTime: responseTime,
      resultCount: packages.length,
      success: true
    };
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return {
      method: 'getPackages',
      responseTime: 0,
      resultCount: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Test del método getPackagesWithTripInfo (crítico)
 */
async function testGetPackagesWithTripInfo() {
  console.log('\n🚗 TESTING: getPackagesWithTripInfo() - Método con información de viaje');
  console.log('=' .repeat(50));
  
  const startTime = performance.now();
  
  try {
    // Test con filtros básicos - simular llamada de conductor
    const filters = {
      companyId: 'bamo-350045'
    };
    
    const packagesWithTrip = await storage.getPackagesWithTripInfo(filters, 4, 'comisionista');
    
    const endTime = performance.now();
    const responseTime = endTime - startTime;
    
    console.log(`⏱️  Tiempo de respuesta: ${responseTime.toFixed(2)}ms`);
    console.log(`📊 Paquetes con info de viaje: ${packagesWithTrip.length}`);
    
    if (packagesWithTrip.length > 0) {
      console.log(`🔍 Campos del primer paquete: ${Object.keys(packagesWithTrip[0]).join(', ')}`);
      console.log(`🚗 Info de viaje: ${packagesWithTrip[0].tripOrigin || 'N/A'} → ${packagesWithTrip[0].tripDestination || 'N/A'}`);
    }
    
    return {
      method: 'getPackagesWithTripInfo',
      responseTime: responseTime,
      resultCount: packagesWithTrip.length,
      success: true
    };
    
  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    return {
      method: 'getPackagesWithTripInfo',
      responseTime: 0,
      resultCount: 0,
      success: false,
      error: error.message
    };
  }
}

/**
 * Ejecutar todos los tests
 */
async function runTests() {
  try {
    console.log('🔗 Conectando a la base de datos...');
    
    // Ejecutar tests
    const test1 = await testGetPackages();
    const test2 = await testGetPackagesWithTripInfo();
    
    // Mostrar resumen
    console.log('\n📋 RESUMEN DE RESULTADOS ANTES DE OPTIMIZACIÓN');
    console.log('=' .repeat(60));
    
    console.log(`📦 ${test1.method}:`);
    console.log(`   ⏱️  Tiempo: ${test1.responseTime.toFixed(2)}ms`);
    console.log(`   📊 Resultados: ${test1.resultCount}`);
    console.log(`   ✅ Éxito: ${test1.success ? 'Sí' : 'No'}`);
    
    console.log(`\n🚗 ${test2.method}:`);
    console.log(`   ⏱️  Tiempo: ${test2.responseTime.toFixed(2)}ms`);
    console.log(`   📊 Resultados: ${test2.resultCount}`);
    console.log(`   ✅ Éxito: ${test2.success ? 'Sí' : 'No'}`);
    
    if (test1.success && test2.success) {
      const speedRatio = test2.responseTime / test1.responseTime;
      console.log(`\n🔄 Comparación de rendimiento:`);
      console.log(`   📈 Diferencia: ${(test2.responseTime - test1.responseTime).toFixed(2)}ms`);
      console.log(`   📊 Ratio: ${speedRatio.toFixed(2)}x más lento`);
    }
    
    // Guardar resultados
    const results = {
      timestamp: new Date().toISOString(),
      version: 'before-optimization',
      tests: { test1, test2 }
    };
    
    await import('fs').then(fs => {
      fs.default.writeFileSync('test-packages-before-optimization.json', JSON.stringify(results, null, 2));
      console.log('\n💾 Resultados guardados en: test-packages-before-optimization.json');
    });
    
  } catch (error) {
    console.error('❌ Error general:', error.message);
  }
}

// Ejecutar
runTests().then(() => process.exit(0)).catch(err => {
  console.error('❌ Error fatal:', err);
  process.exit(1);
});