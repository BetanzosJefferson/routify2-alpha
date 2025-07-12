import fetch from 'node-fetch';

const baseURL = 'http://localhost:5000';

// Datos falsos para generar reservaciones
const fakeNames = [
  'Carlos', 'María', 'José', 'Ana', 'Luis', 'Carmen', 'Miguel', 'Laura', 'Pedro', 'Isabel',
  'Antonio', 'Rosa', 'Manuel', 'Patricia', 'Francisco', 'Dolores', 'David', 'Pilar', 'Jesús', 'Teresa',
  'Alejandro', 'Antonia', 'Daniel', 'Francisca', 'Adrián', 'Cristina', 'Fernando', 'Dolores', 'Pablo', 'Mercedes',
  'Álvaro', 'Lucía', 'Sergio', 'Marta', 'Javier', 'Elena', 'Rafael', 'Nuria', 'Marcos', 'Silvia'
];

const fakeLastNames = [
  'García', 'Rodríguez', 'González', 'Fernández', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
  'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez',
  'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Suárez'
];

const fakePhones = [
  '7441234567', '7441234568', '7441234569', '7441234570', '7441234571', '7441234572', '7441234573', '7441234574',
  '7441234575', '7441234576', '7441234577', '7441234578', '7441234579', '7441234580', '7441234581', '7441234582',
  '7441234583', '7441234584', '7441234585', '7441234586', '7441234587', '7441234588', '7441234589', '7441234590'
];

const paymentMethods = ['efectivo', 'tarjeta', 'transferencia'];
const statuses = ['confirmada', 'pendiente', 'cancelada'];

// Función para generar datos falsos
function generateFakeReservation(index) {
  const firstName = fakeNames[Math.floor(Math.random() * fakeNames.length)];
  const lastName = fakeLastNames[Math.floor(Math.random() * fakeLastNames.length)];
  const phone = fakePhones[Math.floor(Math.random() * fakePhones.length)];
  const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${index}@fake.com`;
  
  // Generar fechas aleatorias para los próximos 30 días
  const today = new Date();
  const futureDate = new Date(today.getTime() + (Math.random() * 30 * 24 * 60 * 60 * 1000));
  const departureDate = futureDate.toISOString().split('T')[0];
  
  const totalAmount = Math.floor(Math.random() * 800) + 200; // Entre 200 y 1000
  const advancePayment = Math.floor(totalAmount * (Math.random() * 0.5 + 0.5)); // 50-100% del total
  
  return {
    companyId: 'bamo-350045',
    status: statuses[Math.floor(Math.random() * statuses.length)],
    tripDetails: JSON.stringify({
      tripId: Math.floor(Math.random() * 3) + 214, // 214, 215, o 216
      recordId: Math.floor(Math.random() * 3) + 214,
      seats: Math.floor(Math.random() * 3) + 1 // 1, 2, o 3 asientos
    }),
    totalAmount: totalAmount,
    email: email,
    phone: phone,
    paymentMethod: paymentMethods[Math.floor(Math.random() * paymentMethods.length)],
    paymentStatus: 'paid',
    advancePayment: advancePayment,
    remainingBalance: totalAmount - advancePayment,
    seatNumbers: JSON.stringify([Math.floor(Math.random() * 40) + 1]),
    passengers: [
      {
        name: firstName,
        lastName: lastName,
        phone: phone,
        email: email,
        documentType: 'cedula',
        documentNumber: `${Math.floor(Math.random() * 90000000) + 10000000}`,
        dateOfBirth: `${Math.floor(Math.random() * 50) + 1950}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
        gender: Math.random() > 0.5 ? 'masculino' : 'femenino',
        seatNumber: Math.floor(Math.random() * 40) + 1
      }
    ]
  };
}

async function createFakeReservations() {
  console.log('🚀 CREANDO 100 RESERVACIONES FALSAS PARA PRUEBAS DE RENDIMIENTO');
  console.log('================================================================');
  
  try {
    // 1. Crear usuario temporal y hacer login
    console.log('\n1. Creando usuario temporal...');
    const createUserResponse = await fetch(`${baseURL}/api/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'test-performance@test.com',
        password: 'test123',
        firstName: 'Test',
        lastName: 'Performance',
        role: 'admin',
        companyId: 'bamo-350045'
      })
    });
    
    if (!createUserResponse.ok) {
      console.log('⚠️ Usuario ya existe o error al crear:', createUserResponse.status);
    } else {
      console.log('✅ Usuario temporal creado');
    }
    
    // 2. Login
    console.log('\n2. Iniciando sesión...');
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
      const errorData = await loginResponse.json();
      console.log('Detalles:', errorData);
      return;
    }
    
    const loginData = await loginResponse.json();
    console.log('✅ Login exitoso');
    console.log('Usuario:', loginData.firstName, loginData.lastName);
    
    // Extraer cookies
    const cookies = loginResponse.headers.raw()['set-cookie'];
    const cookieHeader = cookies.map(cookie => cookie.split(';')[0]).join('; ');
    
    // 3. Crear 100 reservaciones falsas
    console.log('\n3. Creando 100 reservaciones falsas...');
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 1; i <= 100; i++) {
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
          if (i % 10 === 0) {
            console.log(`✅ Creadas ${i}/100 reservaciones...`);
          }
        } else {
          errorCount++;
          if (errorCount <= 3) {
            console.log(`❌ Error creando reservación ${i}:`, createResponse.status);
          }
        }
        
        // Pequeña pausa para no sobrecargar el servidor
        await new Promise(resolve => setTimeout(resolve, 50));
        
      } catch (error) {
        errorCount++;
        if (errorCount <= 3) {
          console.log(`❌ Error creando reservación ${i}:`, error.message);
        }
      }
    }
    
    const creationTime = Date.now() - startTime;
    console.log(`\n📊 Resultado de creación:`);
    console.log(`✅ Exitosas: ${successCount}/100`);
    console.log(`❌ Fallidas: ${errorCount}/100`);
    console.log(`⏱️ Tiempo total: ${creationTime}ms`);
    
    // 4. Probar velocidad de carga
    console.log('\n4. Probando velocidad de carga con las nuevas reservaciones...');
    
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
      console.log(`📊 Total de reservaciones cargadas: ${reservationsData.length}`);
      console.log(`⏱️ Tiempo de carga: ${loadDuration}ms`);
      console.log(`🚀 Velocidad promedio: ${(reservationsData.length / loadDuration * 1000).toFixed(2)} reservaciones/segundo`);
      
      // Análisis de rendimiento
      if (loadDuration < 1000) {
        console.log('🟢 EXCELENTE: Tiempo de carga < 1 segundo');
      } else if (loadDuration < 2000) {
        console.log('🟡 BUENO: Tiempo de carga < 2 segundos');
      } else if (loadDuration < 5000) {
        console.log('🟠 ACEPTABLE: Tiempo de carga < 5 segundos');
      } else {
        console.log('🔴 LENTO: Tiempo de carga > 5 segundos');
      }
      
      // Mostrar muestra de datos
      if (reservationsData.length > 0) {
        console.log('\n📋 Muestra de datos cargados:');
        const sample = reservationsData[Math.floor(Math.random() * reservationsData.length)];
        console.log(`- ID: ${sample.id}`);
        console.log(`- Status: ${sample.status}`);
        console.log(`- Total: $${sample.totalAmount}`);
        console.log(`- Email: ${sample.email}`);
        console.log(`- Trip: ${sample.trip?.origin || 'Sin datos'} → ${sample.trip?.destination || 'Sin datos'}`);
      }
      
    } else {
      console.log('❌ Error cargando reservaciones:', reservationsResponse.status);
    }
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
  }
}

createFakeReservations();