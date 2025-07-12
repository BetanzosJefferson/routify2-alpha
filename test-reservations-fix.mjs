import fetch from 'node-fetch';
import { CookieJar } from 'tough-cookie';
import { wrapper } from 'axios-cookiejar-support';
import axios from 'axios';

// Configurar cookies
const jar = new CookieJar();
const client = wrapper(axios.create({ jar }));

const baseURL = 'http://localhost:5000';

async function testReservations() {
  console.log('🔍 PROBANDO OPTIMIZACIÓN DE RESERVACIONES');
  console.log('==========================================');
  
  try {
    // 1. Login
    console.log('\n1. Iniciando sesión...');
    const loginResponse = await client.post(`${baseURL}/api/auth/login`, {
      email: 'bahena@example.com',
      password: 'admin123'
    });
    
    if (loginResponse.status === 200) {
      console.log('✅ Login exitoso');
      console.log('Usuario:', loginResponse.data.user.firstName, loginResponse.data.user.lastName);
      console.log('Rol:', loginResponse.data.user.role);
    } else {
      console.log('❌ Error en login:', loginResponse.status);
      return;
    }
    
    // 2. Probar reservaciones
    console.log('\n2. Probando endpoint de reservaciones...');
    const startTime = Date.now();
    
    const reservationsResponse = await client.get(`${baseURL}/api/reservations`);
    
    const endTime = Date.now();
    const duration = endTime - startTime;
    
    if (reservationsResponse.status === 200) {
      console.log('✅ Reservaciones obtenidas exitosamente');
      console.log(`⏱️ Tiempo de respuesta: ${duration}ms`);
      console.log(`📊 Cantidad de reservaciones: ${reservationsResponse.data.length}`);
      
      // Mostrar una muestra de los datos
      if (reservationsResponse.data.length > 0) {
        console.log('\n📋 Muestra de datos:');
        const sample = reservationsResponse.data[0];
        console.log('- ID:', sample.id);
        console.log('- Status:', sample.status);
        console.log('- Total:', sample.totalAmount);
        console.log('- Creado por:', sample.createdByUser?.firstName || 'Sin datos');
        console.log('- Trip origin:', sample.trip?.origin || 'Sin datos');
        console.log('- Trip destination:', sample.trip?.destination || 'Sin datos');
        console.log('- Passengers:', sample.passengers?.length || 0);
      }
      
      // Verificar optimización
      if (duration < 2000) {
        console.log('🚀 OPTIMIZACIÓN EXITOSA: Tiempo de respuesta < 2 segundos');
      } else {
        console.log('⚠️  OPTIMIZACIÓN PARCIAL: Tiempo de respuesta > 2 segundos');
      }
      
    } else {
      console.log('❌ Error en reservaciones:', reservationsResponse.status);
      console.log('Detalles:', reservationsResponse.data);
    }
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
    if (error.response) {
      console.error('Status:', error.response.status);
      console.error('Data:', error.response.data);
    }
  }
}

testReservations();