/**
 * Script de prueba para verificar que los datos del viaje se extraigan correctamente
 * desde tripDetails al crear transacciones de paqueterías
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000/api';

// Datos de prueba para crear un paquete con viaje
const testPackageData = {
  senderName: "Juan",
  senderLastName: "Pérez",
  senderPhone: "555-0123",
  recipientName: "María",
  recipientLastName: "González",
  recipientPhone: "555-0456",
  packageDescription: "Documentos importantes",
  price: 50.00,
  paymentMethod: "efectivo",
  isPaid: true, // Crear como pagado para generar transacción inmediatamente
  usesSeats: false,
  seatsQuantity: 0,
  notes: "Paquete de prueba para verificar extracción de datos de viaje",
  tripDetails: {
    tripId: "123_456_789", // ID del viaje simulado
    origin: "Ciudad A",
    destination: "Ciudad B",
    segmentOrigin: "Parada A1",
    segmentDestination: "Parada B2",
    date: "2025-06-22",
    time: "10:00",
    isSubTrip: true
  }
};

async function testPackageTripDataExtraction() {
  console.log('Iniciando prueba de extracción de datos de viaje en paqueterías...\n');

  try {
    // 1. Primero autenticarse como usuario de prueba
    console.log('Autenticando usuario...');
    const loginResponse = await fetch(`${BASE_URL}/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'bahenawilliamjefferson@gmail.com',
        password: 'password123'
      })
    });

    if (!loginResponse.ok) {
      throw new Error(`Error al autenticar: ${loginResponse.status} ${loginResponse.statusText}`);
    }

    // Extraer cookies de la respuesta de login
    const cookies = loginResponse.headers.get('set-cookie');
    console.log('Usuario autenticado exitosamente');

    // 2. Crear paquete con tripDetails y como pagado
    console.log('Creando paquete con datos de viaje...');
    const createResponse = await fetch(`${BASE_URL}/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      },
      body: JSON.stringify(testPackageData)
    });

    if (!createResponse.ok) {
      throw new Error(`Error al crear paquete: ${createResponse.status} ${createResponse.statusText}`);
    }

    const newPackage = await createResponse.json();
    console.log('✅ Paquete creado exitosamente:');
    console.log(`   - ID: ${newPackage.id}`);
    console.log(`   - Estado de pago: ${newPackage.isPaid}`);
    console.log(`   - Precio: $${newPackage.price}`);
    console.log(`   - TripDetails:`, JSON.stringify(newPackage.tripDetails, null, 2));

    // 2. Verificar que se creó una transacción asociada
    console.log('\nVerificando transacciones creadas...');
    const transactionsResponse = await fetch(`${BASE_URL}/transactions/current`, {
      headers: {
        'Cookie': cookies || ''
      }
    });
    
    if (!transactionsResponse.ok) {
      throw new Error(`Error al obtener transacciones: ${transactionsResponse.status}`);
    }

    const transactions = await transactionsResponse.json();
    console.log(`📋 Total de transacciones encontradas: ${transactions.length}`);

    // Buscar transacciones relacionadas con nuestro paquete
    const packageTransactions = transactions.filter(t => 
      t.details && 
      typeof t.details === 'object' && 
      t.details.type === 'package' && 
      t.details.details && 
      t.details.details.id === newPackage.id
    );

    console.log(`🎯 Transacciones del paquete ${newPackage.id}: ${packageTransactions.length}`);

    if (packageTransactions.length > 0) {
      packageTransactions.forEach((transaction, index) => {
        console.log(`\n📄 Transacción ${index + 1}:`);
        console.log(`   - ID: ${transaction.id}`);
        console.log(`   - Monto: $${transaction.details.details.monto}`);
        console.log(`   - TripId: "${transaction.details.details.tripId}"`);
        console.log(`   - Origen: "${transaction.details.details.origen}"`);
        console.log(`   - Destino: "${transaction.details.details.destino}"`);
        console.log(`   - Método de pago: ${transaction.details.details.metodoPago}`);
        console.log(`   - Remitente: ${transaction.details.details.remitente}`);
        console.log(`   - Destinatario: ${transaction.details.details.destinatario}`);
        
        // Verificar que los datos del viaje se extrajeron correctamente
        const details = transaction.details.details;
        const hasValidTripData = details.tripId && details.origen && details.destino;
        
        console.log(`   ✅ Datos de viaje extraídos: ${hasValidTripData ? 'SÍ' : 'NO'}`);
        
        if (hasValidTripData) {
          console.log(`   🎉 ÉXITO: Los datos del viaje se extrajeron correctamente`);
        } else {
          console.log(`   ❌ ERROR: Los datos del viaje NO se extrajeron correctamente`);
          console.log(`      - tripId: "${details.tripId}"`);
          console.log(`      - origen: "${details.origen}"`);
          console.log(`      - destino: "${details.destino}"`);
        }
      });
    } else {
      console.log('❌ ERROR: No se encontraron transacciones para el paquete creado');
    }

    // 3. Prueba adicional: Marcar un paquete como pagado después de crearlo
    console.log('\n🔄 Creando segundo paquete SIN pagar para probar "marcar como pagado"...');
    
    const unpaidPackageData = {
      ...testPackageData,
      isPaid: false, // Crear sin pagar
      senderName: "Carlos",
      recipientName: "Ana",
      tripDetails: {
        tripId: "789_101_112",
        origin: "Ciudad C",
        destination: "Ciudad D",
        segmentOrigin: "Parada C1",
        segmentDestination: "Parada D2",
        date: "2025-06-23",
        time: "14:00",
        isSubTrip: false
      }
    };

    const unpaidResponse = await fetch(`${BASE_URL}/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies || ''
      },
      body: JSON.stringify(unpaidPackageData)
    });

    if (!unpaidResponse.ok) {
      throw new Error(`Error al crear paquete sin pagar: ${unpaidResponse.status}`);
    }

    const unpaidPackage = await unpaidResponse.json();
    console.log(`✅ Paquete sin pagar creado: ID ${unpaidPackage.id}`);

    // Marcar como pagado
    console.log(`💳 Marcando paquete ${unpaidPackage.id} como pagado...`);
    const markPaidResponse = await fetch(`${BASE_URL}/public/packages/${unpaidPackage.id}/mark-paid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      }
    });

    if (!markPaidResponse.ok) {
      throw new Error(`Error al marcar como pagado: ${markPaidResponse.status}`);
    }

    // Verificar transacciones nuevamente
    console.log('\n🔍 Verificando transacciones después de marcar como pagado...');
    const finalTransactionsResponse = await fetch(`${BASE_URL}/transactions/current`, {
      headers: {
        'Cookie': cookies || ''
      }
    });
    const finalTransactions = await finalTransactionsResponse.json();
    
    const secondPackageTransactions = finalTransactions.filter(t => 
      t.details && 
      typeof t.details === 'object' && 
      t.details.type === 'package' && 
      t.details.details && 
      t.details.details.id === unpaidPackage.id
    );

    console.log(`🎯 Transacciones del segundo paquete ${unpaidPackage.id}: ${secondPackageTransactions.length}`);

    if (secondPackageTransactions.length > 0) {
      const transaction = secondPackageTransactions[0];
      const details = transaction.details.details;
      const hasValidTripData = details.tripId && details.origen && details.destino;
      
      console.log(`📄 Transacción del "marcar como pagado":`);
      console.log(`   - TripId: "${details.tripId}"`);
      console.log(`   - Origen: "${details.origen}"`);
      console.log(`   - Destino: "${details.destino}"`);
      console.log(`   ✅ Datos de viaje extraídos: ${hasValidTripData ? 'SÍ' : 'NO'}`);
    }

    console.log('\n🎉 Prueba completada exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
    console.error('Stack trace:', error.stack);
  }
}

// Ejecutar la prueba
testPackageTripDataExtraction();