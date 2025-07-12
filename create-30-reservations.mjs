import fetch from 'node-fetch';
import bcrypt from 'bcryptjs';

const baseURL = 'http://localhost:5000';

// Datos básicos para generar reservaciones
const fakeNames = ['Carlos', 'María', 'José', 'Ana', 'Luis', 'Carmen', 'Miguel', 'Laura', 'Pedro', 'Isabel'];
const fakeLastNames = ['García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín'];
const fakePhones = ['7441234567', '7441234568', '7441234569', '7441234570', '7441234571', '7441234572', '7441234573', '7441234574'];
const paymentMethods = ['efectivo', 'transferencia'];
const statuses = ['confirmada', 'pendiente'];

// Función para generar datos falsos
function generateFakeReservation(index) {
  const firstName = fakeNames[Math.floor(Math.random() * fakeNames.length)];
  const lastName = fakeLastNames[Math.floor(Math.random() * fakeLastNames.length)];
  const phone = fakePhones[Math.floor(Math.random() * fakePhones.length)];
  const email = `${firstName.toLowerCase()}${index}@test.com`; // Email más simple
  
  const totalAmount = Math.floor(Math.random() * 600) + 300; // Entre 300 y 900
  const advancePayment = Math.floor(totalAmount * (Math.random() * 0.5 + 0.5)); // 50-100% del total
  
  return {
    companyId: 'bamo-350045',
    status: statuses[Math.floor(Math.random() * statuses.length)],
    tripDetails: {
      tripId: Math.floor(Math.random() * 3) + 214, // 214, 215, o 216
      recordId: Math.floor(Math.random() * 3) + 214,
      seats: 1
    },
    totalAmount: totalAmount,
    email: email,
    phone: phone,
    paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
    paymentStatus: 'pagado',
    advancePayment: advancePayment,
    remainingBalance: totalAmount - advancePayment,
    seatNumbers: [Math.floor(Math.random() * 30) + 1],
    numPassengers: 1,
    passengers: [
      {
        firstName: firstName,
        lastName: lastName,
        phone: phone,
        email: email,
        documentType: 'cedula',
        documentNumber: `${Math.floor(Math.random() * 90000000) + 10000000}`,
        dateOfBirth: `${Math.floor(Math.random() * 30) + 1970}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        gender: Math.random() > 0.5 ? 'masculino' : 'femenino',
        seatNumber: Math.floor(Math.random() * 30) + 1
      }
    ]
  };
}

async function createReservations() {
  console.log('🚀 CREANDO 30 RESERVACIONES PARA PRUEBA DE RENDIMIENTO');
  console.log('====================================================');
  
  try {
    // 1. Login con usuario existente
    console.log('\n1. Iniciando sesión...');
    const loginResponse = await fetch(`${baseURL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-performance@test.com',
        password: 'test123'
      })
    });
    
    if (!loginResponse.ok) {
      console.log('❌ Error en login:', loginResponse.status);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login exitoso - Usuario:', loginData.firstName, loginData.lastName);
    
    // Extraer cookies
    const cookies = loginResponse.headers.raw()['set-cookie'];
    const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
    
    // 2. Crear 30 reservaciones
    console.log('\n2. Creando 30 reservaciones...');
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 1; i <= 30; i++) {
      try {
        const fakeReservation = generateFakeReservation(i);
        
        const createResponse = await fetch(`${baseURL}/api/reservations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Cookie': cookieHeader
          },
          body: JSON.stringify(fakeReservation)
        });
        
        if (createResponse.ok) {
          successCount++;
          if (i % 5 === 0) {
            console.log(`✅ Creadas ${i}/30 reservaciones...`);
          }
        } else {
          errorCount++;
          if (errorCount <= 2) {
            console.log(`❌ Error creando reservación ${i}:`, createResponse.status);
          }
        }
        
        // Pausa pequeña
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        errorCount++;
        if (errorCount <= 2) {
          console.log(`❌ Error creando reservación ${i}:`, error.message);
        }
      }
    }
    
    const creationTime = Date.now() - startTime;
    console.log(`\n📊 Resultado de creación:`);
    console.log(`✅ Exitosas: ${successCount}/30`);
    console.log(`❌ Fallidas: ${errorCount}/30`);
    console.log(`⏱️ Tiempo total: ${creationTime}ms`);
    
    // 3. Probar velocidad de carga
    console.log('\n3. Probando velocidad de carga...');
    
    const loadStartTime = Date.now();
    const reservationsResponse = await fetch(`${baseURL}/api/reservations`, {
      method: 'GET',
      headers: {
        'Cookie': cookieHeader
      }
    });
    
    const loadEndTime = Date.now();
    const loadDuration = loadEndTime - loadStartTime;
    
    if (reservationsResponse.ok) {
      const reservationsData = await reservationsResponse.json();
      console.log('\n🎯 RESULTADOS DE RENDIMIENTO:');
      console.log(`📊 Total reservaciones: ${reservationsData.length}`);
      console.log(`⏱️ Tiempo de carga: ${loadDuration}ms`);
      console.log(`🚀 Velocidad: ${(reservationsData.length / loadDuration * 1000).toFixed(2)} reservaciones/segundo`);
      
      // Análisis de rendimiento
      if (loadDuration < 500) {
        console.log('🟢 EXCELENTE: Tiempo de carga < 500ms');
      } else if (loadDuration < 1000) {
        console.log('🟡 BUENO: Tiempo de carga < 1 segundo');
      } else if (loadDuration < 2000) {
        console.log('🟠 ACEPTABLE: Tiempo de carga < 2 segundos');
      } else {
        console.log('🔴 LENTO: Tiempo de carga > 2 segundos');
      }
      
    } else {
      console.log('❌ Error cargando reservaciones:', reservationsResponse.status);
    }
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
  }
}

createReservations();