#!/usr/bin/env node

import { performance } from 'perf_hooks';
import fs from 'fs';

// Configuración de prueba
const BASE_URL = 'http://localhost:5000';
const TEST_COOKIES = [
  'connect.sid=s%3Ac6qKcRyEhgkOBWWd8J2HdGcI3VoSokyN.9ZKKKaZczOlvnKYiSzqfWbSLgmm9YQjOmkzIGVlGkJw' // Cookie del usuario comisionista
];

/**
 * Función para realizar login y obtener cookies válidas
 */
async function login() {
  console.log('🔐 Iniciando sesión...');
  
  const loginResponse = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: 'bahenawilliamjefferson@gmail.com',
      password: 'newpassword123'
    })
  });

  if (!loginResponse.ok) {
    throw new Error(`Error en login: ${loginResponse.status}`);
  }

  const cookies = loginResponse.headers.get('set-cookie');
  if (cookies) {
    const sessionCookie = cookies.split(';')[0];
    return [sessionCookie];
  }
  
  return TEST_COOKIES;
}

/**
 * Test de rendimiento para getPackages (método básico)
 */
async function testGetPackages(cookies) {
  console.log('\n📦 TESTING: getPackages() - Método básico');
  console.log('=' .repeat(50));
  
  const startTime = performance.now();
  
  const response = await fetch(`${BASE_URL}/api/packages`, {
    method: 'GET',
    headers: {
      'Cookie': cookies.join('; ')
    }
  });
  
  const endTime = performance.now();
  const responseTime = endTime - startTime;
  
  if (!response.ok) {
    throw new Error(`Error en getPackages: ${response.status} - ${response.statusText}`);
  }
  
  const packages = await response.json();
  
  console.log(`⏱️  Tiempo de respuesta: ${responseTime.toFixed(2)}ms`);
  console.log(`📊 Paquetes obtenidos: ${packages.length}`);
  console.log(`🔍 Estructura primer paquete:`, packages[0] ? Object.keys(packages[0]) : 'No hay paquetes');
  
  return {
    method: 'getPackages',
    responseTime,
    resultCount: packages.length,
    data: packages
  };
}

/**
 * Test de rendimiento para getPackagesWithTripInfo (método crítico)
 */
async function testGetPackagesWithTripInfo(cookies) {
  console.log('\n🚗 TESTING: getPackagesWithTripInfo() - Método con información de viaje');
  console.log('=' .repeat(50));
  
  const startTime = performance.now();
  
  // Probar con endpoint de taquilla (el que más consultas genera)
  const response = await fetch(`${BASE_URL}/api/taquilla/packages`, {
    method: 'GET',
    headers: {
      'Cookie': cookies.join('; ')
    }
  });
  
  const endTime = performance.now();
  const responseTime = endTime - startTime;
  
  if (!response.ok) {
    throw new Error(`Error en getPackagesWithTripInfo: ${response.status} - ${response.statusText}`);
  }
  
  const packagesWithTrip = await response.json();
  
  console.log(`⏱️  Tiempo de respuesta: ${responseTime.toFixed(2)}ms`);
  console.log(`📊 Paquetes con info de viaje: ${packagesWithTrip.length}`);
  console.log(`🔍 Estructura primer paquete:`, packagesWithTrip[0] ? Object.keys(packagesWithTrip[0]) : 'No hay paquetes');
  
  // Mostrar ejemplo de datos de viaje si existe
  if (packagesWithTrip[0]) {
    console.log(`🚗 Información de viaje del primer paquete:`, {
      tripOrigin: packagesWithTrip[0].tripOrigin,
      tripDestination: packagesWithTrip[0].tripDestination,
      tripId: packagesWithTrip[0].tripId
    });
  }
  
  return {
    method: 'getPackagesWithTripInfo',
    responseTime,
    resultCount: packagesWithTrip.length,
    data: packagesWithTrip
  };
}

/**
 * Función principal de testing
 */
async function runPerformanceTests() {
  console.log('🚀 INICIANDO TESTS DE RENDIMIENTO - PAQUETERÍAS');
  console.log('=' .repeat(60));
  
  try {
    // Obtener cookies válidas
    const cookies = await login();
    console.log('✅ Sesión iniciada correctamente');
    
    // Ejecutar tests
    const test1 = await testGetPackages(cookies);
    const test2 = await testGetPackagesWithTripInfo(cookies);
    
    // Resumen final
    console.log('\n📋 RESUMEN DE RESULTADOS');
    console.log('=' .repeat(60));
    console.log(`📦 ${test1.method}:`);
    console.log(`   ⏱️  Tiempo: ${test1.responseTime.toFixed(2)}ms`);
    console.log(`   📊 Resultados: ${test1.resultCount}`);
    
    console.log(`\n🚗 ${test2.method}:`);
    console.log(`   ⏱️  Tiempo: ${test2.responseTime.toFixed(2)}ms`);
    console.log(`   📊 Resultados: ${test2.resultCount}`);
    
    // Comparación
    const speedDifference = test2.responseTime - test1.responseTime;
    console.log(`\n🔄 Diferencia de rendimiento: ${speedDifference.toFixed(2)}ms`);
    console.log(`📈 El método con información de viaje es ${(test2.responseTime / test1.responseTime).toFixed(2)}x más lento`);
    
    // Guardar datos para comparación posterior
    const testResults = {
      timestamp: new Date().toISOString(),
      getPackages: test1,
      getPackagesWithTripInfo: test2
    };
    
    fs.writeFileSync('test-packages-before-optimization.json', JSON.stringify(testResults, null, 2));
    console.log('\n💾 Resultados guardados en: test-packages-before-optimization.json');
    
  } catch (error) {
    console.error('❌ Error en los tests:', error.message);
    process.exit(1);
  }
}

// Ejecutar tests
runPerformanceTests();