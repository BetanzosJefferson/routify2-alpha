import axios from 'axios';
import fs from 'fs';

const BASE_URL = 'http://localhost:5000';

// Función para realizar login
async function login() {
  try {
    const response = await axios.post(`${BASE_URL}/auth/login`, {
      email: 'ivan.bahena@example.com',
      password: 'password123'
    });
    
    const cookies = response.headers['set-cookie'];
    return cookies || [];
  } catch (error) {
    console.error('Error en login:', error.response?.data || error.message);
    throw error;
  }
}

// Función para probar endpoint original vs optimizado
async function testReservationsPerformance() {
  console.log('=== TESTING RESERVATIONS PERFORMANCE ===\n');
  
  try {
    // Hacer login
    console.log('1. Haciendo login...');
    const cookies = await login();
    
    const headers = {
      'Cookie': cookies.join('; ')
    };
    
    // Probar endpoint original
    console.log('\n2. Probando endpoint ORIGINAL /api/reservations...');
    const startOriginal = Date.now();
    const originalResponse = await axios.get(`${BASE_URL}/api/reservations`, { headers });
    const originalTime = Date.now() - startOriginal;
    console.log(`   ✓ Original completado en ${originalTime}ms`);
    console.log(`   ✓ Obtenidas ${originalResponse.data.length} reservaciones`);
    
    // Probar endpoint optimizado
    console.log('\n3. Probando endpoint OPTIMIZADO /api/reservations-optimized...');
    const startOptimized = Date.now();
    const optimizedResponse = await axios.get(`${BASE_URL}/api/reservations-optimized`, { headers });
    const optimizedTime = Date.now() - startOptimized;
    console.log(`   ✓ Optimizado completado en ${optimizedTime}ms`);
    console.log(`   ✓ Obtenidas ${optimizedResponse.data.length} reservaciones`);
    
    // Comparar resultados
    console.log('\n4. COMPARACIÓN DE RESULTADOS:');
    console.log(`   • Método original: ${originalTime}ms`);
    console.log(`   • Método optimizado: ${optimizedTime}ms`);
    
    if (optimizedTime < originalTime) {
      const improvement = ((originalTime - optimizedTime) / originalTime * 100).toFixed(1);
      console.log(`   ✓ MEJORA: ${improvement}% más rápido`);
    } else {
      const regression = ((optimizedTime - originalTime) / originalTime * 100).toFixed(1);
      console.log(`   ✗ REGRESIÓN: ${regression}% más lento`);
    }
    
    // Verificar que devuelvan los mismos datos
    console.log('\n5. VERIFICANDO CONSISTENCIA DE DATOS:');
    console.log(`   • Original: ${originalResponse.data.length} reservaciones`);
    console.log(`   • Optimizado: ${optimizedResponse.data.length} reservaciones`);
    
    if (originalResponse.data.length === optimizedResponse.data.length) {
      console.log('   ✓ Misma cantidad de resultados');
    } else {
      console.log('   ✗ Diferente cantidad de resultados');
    }
    
    // Guardar resultados en archivos para análisis
    fs.writeFileSync('reservations-original.json', JSON.stringify(originalResponse.data, null, 2));
    fs.writeFileSync('reservations-optimized.json', JSON.stringify(optimizedResponse.data, null, 2));
    
    console.log('\n6. RESULTADOS GUARDADOS:');
    console.log('   • reservations-original.json');
    console.log('   • reservations-optimized.json');
    
  } catch (error) {
    console.error('\n❌ Error durante las pruebas:', error.response?.data || error.message);
  }
}

// Ejecutar pruebas
testReservationsPerformance();