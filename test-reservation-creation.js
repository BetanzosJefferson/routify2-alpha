import fetch from 'node-fetch';

async function testReservationCreation() {
  const baseUrl = 'http://localhost:5000';
  
  try {
    // 1. Autenticarse como comisionista
    console.log('🔐 Autenticándose como comisionista (Rosita)...');
    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'rosita@gmail.com',
        password: '12345678'
      })
    });
    
    if (!loginResponse.ok) {
      throw new Error('Error al iniciar sesión');
    }
    
    const cookies = loginResponse.headers.get('set-cookie');
    const user = await loginResponse.json();
    console.log('✅ Autenticado como:', user.firstName, user.lastName);
    
    // 2. Crear una solicitud de reserva
    console.log('\n📝 Creando solicitud de reserva...');
    const reservationData = {
      trip_details: {
        recordId: 214,
        tripId: "1752133473116", // ID del viaje principal
        seats: 1,
        origin: "Acapulco de Juarez, Guerrero - Terminal condesa",
        destination: "Coyoacan, Ciudad de Mexico - Taxqueña",
        price: 450,
        departureDate: "2025-07-10",
        departureTime: "23:50 PM",
        arrivalTime: "05:20 AM"
      },
      passengers: [
        {
          firstName: "Test",
          lastName: "Passenger",
          age: 25,
          seat: "1"
        }
      ],
      email: "test@example.com",
      phone: "5551234567",
      notes: "Solicitud de prueba",
      total_amount: 450,
      advance_amount: 200,
      payment_method: "efectivo",
      advance_payment_method: "efectivo",
      payment_status: "adelanto",
      company_id: "bamo-350045",
      created_by: user.id
    };
    
    console.log('📋 Datos de la solicitud:', JSON.stringify(reservationData, null, 2));
    
    const createResponse = await fetch(`${baseUrl}/api/reservation-requests`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies
      },
      body: JSON.stringify(reservationData)
    });
    
    if (!createResponse.ok) {
      const error = await createResponse.text();
      throw new Error(`Error al crear solicitud: ${error}`);
    }
    
    const createdRequest = await createResponse.json();
    console.log('✅ Solicitud creada:', createdRequest.id);
    
    // 3. Autenticarse como administrador para aprobar
    console.log('\n🔐 Autenticándose como administrador...');
    const adminLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'bahenawilliamjefferson@gmail.com',
        password: '12345678'
      })
    });
    
    if (!adminLoginResponse.ok) {
      throw new Error('Error al iniciar sesión como admin');
    }
    
    const adminCookies = adminLoginResponse.headers.get('set-cookie');
    const adminUser = await adminLoginResponse.json();
    console.log('✅ Autenticado como:', adminUser.firstName, adminUser.lastName);
    
    // 4. Aprobar la solicitud
    console.log('\n✅ Aprobando solicitud...');
    const approveResponse = await fetch(`${baseUrl}/api/reservation-requests/${createdRequest.id}/update-status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': adminCookies
      },
      body: JSON.stringify({
        status: 'aprobada',
        reviewNotes: 'Aprobada mediante script de prueba'
      })
    });
    
    if (!approveResponse.ok) {
      const error = await approveResponse.text();
      throw new Error(`Error al aprobar solicitud: ${error}`);
    }
    
    const approvedRequest = await approveResponse.json();
    console.log('✅ Solicitud aprobada exitosamente');
    
    // 5. Verificar transacción creada
    console.log('\n💰 Verificando transacción...');
    const transactionResponse = await fetch(`${baseUrl}/api/transactions/current`, {
      method: 'GET',
      headers: {
        'Cookie': cookies // Volver a usar las cookies del comisionista
      }
    });
    
    if (transactionResponse.ok) {
      const transactions = await transactionResponse.json();
      console.log('💰 Transacciones del comisionista:', transactions.length);
      
      // Mostrar la transacción más reciente
      if (transactions.length > 0) {
        const lastTransaction = transactions[transactions.length - 1];
        console.log('📄 Última transacción:');
        console.log(`   - ID: ${lastTransaction.id}`);
        console.log(`   - Monto: $${lastTransaction.amount}`);
        console.log(`   - Origen: ${lastTransaction.details?.details?.origen || 'No especificado'}`);
        console.log(`   - Destino: ${lastTransaction.details?.details?.destino || 'No especificado'}`);
        console.log(`   - Pasajeros: ${lastTransaction.details?.details?.pasajeros || 'No especificado'}`);
      }
    }
    
    console.log('\n🎉 Prueba completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error.message);
  }
}

testReservationCreation();