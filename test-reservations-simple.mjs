import fetch from 'node-fetch';

const baseURL = 'http://localhost:5000';

async function testReservations() {
  console.log('🔍 PROBANDO OPTIMIZACIÓN DE RESERVACIONES');
  console.log('==========================================');
  
  try {
    // 1. Login
    console.log('\n1. Iniciando sesión...');
    const loginResponse = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ivanbahenabetanzos@gmail.com',
        password: 'admin123'
      })
    });
    
    if (loginResponse.ok) {
      const loginData = await loginResponse.json();
      console.log('✅ Login exitoso');
      console.log('Usuario:', loginData.user.firstName, loginData.user.lastName);
      console.log('Rol:', loginData.user.role);
      
      // Extraer cookies
      const cookies = loginResponse.headers.raw()['set-cookie'];
      const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
      
      // 2. Probar reservaciones
      console.log('\n2. Probando endpoint de reservaciones...');
      const startTime = Date.now();
      
      const reservationsResponse = await fetch(`${baseURL}/api/reservations`, {
        method: 'GET',
        headers: {
          'Cookie': cookieHeader
        }
      });
      
      const endTime = Date.now();
      const duration = endTime - startTime;
      
      if (reservationsResponse.ok) {
        const reservationsData = await reservationsResponse.json();
        console.log('✅ Reservaciones obtenidas exitosamente');
        console.log(`⏱️ Tiempo de respuesta: ${duration}ms`);
        console.log(`📊 Cantidad de reservaciones: ${reservationsData.length}`);
        
        // Mostrar una muestra de los datos
        if (reservationsData.length > 0) {
          console.log('\n📋 Muestra de datos:');
          const sample = reservationsData[0];
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
        const errorData = await reservationsResponse.text();
        console.log('Detalles:', errorData);
      }
      
    } else {
      console.log('❌ Error en login:', loginResponse.status);
      const errorData = await loginResponse.text();
      console.log('Detalles:', errorData);
    }
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
  }
}

testReservations();