#!/usr/bin/env node

/**
 * Prueba directa de creación de transacciones para paqueterías
 * Verifica las correcciones implementadas sin requerir autenticación
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:5000';

/**
 * Crear paquetería con pago realizado (Escenario 1)
 */
async function testPackageCreationWithPayment() {
  console.log('ESCENARIO 1: Creando paquetería con pago realizado');
  console.log('================================================');
  
  const packageData = {
    tripDetails: {
      tripId: "29_0_0_0",
      recordId: 29,
      segmentOrigin: "León",
      segmentDestination: "Guadalajara",
      departureDate: "2025-01-10",
      price: 150.00
    },
    senderName: "TestSender",
    senderLastName: "TestLastName",
    senderPhone: "4411234567",
    recipientName: "TestRecipient",
    recipientLastName: "TestRecipientLast",
    recipientPhone: "3311234567",
    packageDescription: "Documento de prueba",
    price: 150.00,
    paymentMethod: "Efectivo",
    isPaid: true,
    usesSeats: false,
    seatsQuantity: 0
  };

  try {
    const response = await fetch(`${BASE_URL}/api/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(packageData)
    });

    if (response.ok) {
      const result = await response.json();
      console.log(`Paquetería creada con ID: ${result.id}`);
      return result.id;
    } else {
      const error = await response.text();
      console.log(`Error: ${response.status} - ${error}`);
      return null;
    }
  } catch (error) {
    console.log(`Error de conexión: ${error.message}`);
    return null;
  }
}

/**
 * Marcar paquetería como pagada (Escenario 2)
 */
async function testMarkPackageAsPaid() {
  console.log('\nESCENARIO 2: Marcando paquetería como pagada');
  console.log('==========================================');
  
  // Primero crear una paquetería sin pago
  const packageData = {
    tripDetails: {
      tripId: "29_0_0_0",
      recordId: 29,
      segmentOrigin: "León",
      segmentDestination: "Guadalajara",
      departureDate: "2025-01-10",
      price: 200.00
    },
    senderName: "TestSender2",
    senderLastName: "TestLastName2",
    senderPhone: "4411234568",
    recipientName: "TestRecipient2",
    recipientLastName: "TestRecipientLast2",
    recipientPhone: "3311234568",
    packageDescription: "Documento de prueba 2",
    price: 200.00,
    paymentMethod: "Efectivo",
    isPaid: false,
    usesSeats: false,
    seatsQuantity: 0
  };

  try {
    // Crear paquetería sin pago
    const createResponse = await fetch(`${BASE_URL}/api/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(packageData)
    });

    if (!createResponse.ok) {
      console.log(`Error creando paquetería: ${createResponse.status}`);
      return null;
    }

    const createdPackage = await createResponse.json();
    console.log(`Paquetería sin pago creada con ID: ${createdPackage.id}`);

    // Marcar como pagada
    const markPaidResponse = await fetch(`${BASE_URL}/api/public/packages/${createdPackage.id}/mark-paid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: 3,
        paymentMethod: 'Efectivo'
      })
    });

    if (markPaidResponse.ok) {
      console.log(`Paquetería ${createdPackage.id} marcada como pagada`);
      return createdPackage.id;
    } else {
      const error = await markPaidResponse.text();
      console.log(`Error marcando como pagada: ${markPaidResponse.status} - ${error}`);
      return createdPackage.id;
    }
  } catch (error) {
    console.log(`Error: ${error.message}`);
    return null;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('VERIFICANDO CORRECCIONES EN TRANSACCIONES DE PAQUETERÍAS');
  console.log('======================================================\n');
  
  // Ejecutar escenarios
  const packageId1 = await testPackageCreationWithPayment();
  const packageId2 = await testMarkPackageAsPaid();
  
  console.log('\nPRUEBAS COMPLETADAS');
  console.log('==================');
  
  if (packageId1) console.log(`- Paquetería 1 (con pago): ${packageId1}`);
  if (packageId2) console.log(`- Paquetería 2 (marcada como pagada): ${packageId2}`);
  
  console.log('\nPara verificar las transacciones creadas, consulta la base de datos:');
  console.log('SELECT * FROM transactions ORDER BY created_at DESC LIMIT 10;');
}

main().catch(console.error);