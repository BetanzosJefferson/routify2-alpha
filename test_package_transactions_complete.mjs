#!/usr/bin/env node

/**
 * Prueba completa de los 3 escenarios de transacciones en paqueterías
 * Verifica las correcciones implementadas
 */

import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BASE_URL = 'http://localhost:5000';

// Configuración de prueba
const TEST_CONFIG = {
  // Usuario para pruebas (debe existir en la base de datos)
  userId: 3,
  // Viaje para pruebas (debe existir)
  tripId: "29_0_0_0", 
  // Datos de paquetería de prueba
  packageData: {
    tripDetails: {
      tripId: "29_0_0_0",
      recordId: 29,
      segmentOrigin: "León",
      segmentDestination: "Guadalajara",
      departureDate: "2025-01-10",
      price: 150.00
    },
    senderName: "Juan",
    senderLastName: "Pérez",
    senderPhone: "4411234567",
    recipientName: "María",
    recipientLastName: "González",
    recipientPhone: "3311234567",
    packageDescription: "Documentos importantes",
    price: 150.00,
    paymentMethod: "Efectivo",
    isPaid: true,
    usesSeats: false,
    seatsQuantity: 0
  }
};

/**
 * Función para hacer login y obtener cookies de sesión
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
      password: 'test123'
    })
  });

  if (!loginResponse.ok) {
    throw new Error(`Error en login: ${loginResponse.status}`);
  }

  const cookies = loginResponse.headers.raw()['set-cookie'];
  console.log('✅ Sesión iniciada correctamente');
  return cookies;
}

/**
 * Consultar transacciones en la base de datos
 */
async function queryTransactions(cookies) {
  try {
    const response = await fetch(`${BASE_URL}/api/transactions/current`, {
      headers: {
        'Cookie': cookies.join('; ')
      }
    });

    if (response.ok) {
      return await response.json();
    } else {
      console.warn('⚠️ No se pudieron obtener transacciones:', response.status);
      return [];
    }
  } catch (error) {
    console.warn('⚠️ Error consultando transacciones:', error.message);
    return [];
  }
}

/**
 * Buscar transacciones de tipo "package" por ID de paquetería
 */
function findPackageTransactions(transactions, packageId) {
  return transactions.filter(t => 
    t.details?.type === 'package' && 
    t.details?.details?.id === packageId
  );
}

/**
 * ESCENARIO 1: Crear paquetería con "Pago realizado" = true
 */
async function testScenario1(cookies) {
  console.log('\n🧪 ESCENARIO 1: Creación de paquetería con pago realizado');
  console.log('================================================');
  
  try {
    // Obtener transacciones antes de crear paquetería
    const transactionsBefore = await queryTransactions(cookies);
    console.log(`📊 Transacciones antes: ${transactionsBefore.length}`);
    
    // Crear paquetería con isPaid: true
    const createResponse = await fetch(`${BASE_URL}/api/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies.join('; ')
      },
      body: JSON.stringify(TEST_CONFIG.packageData)
    });

    if (!createResponse.ok) {
      throw new Error(`Error creando paquetería: ${createResponse.status}`);
    }

    const createdPackage = await createResponse.json();
    console.log(`✅ Paquetería creada con ID: ${createdPackage.id}`);
    
    // Esperar un momento para que se procese la transacción
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar transacciones después de crear paquetería
    const transactionsAfter = await queryTransactions(cookies);
    console.log(`📊 Transacciones después: ${transactionsAfter.length}`);
    
    // Buscar transacciones relacionadas con esta paquetería
    const packageTransactions = findPackageTransactions(transactionsAfter, createdPackage.id);
    
    if (packageTransactions.length > 0) {
      console.log(`✅ ÉXITO: Se crearon ${packageTransactions.length} transacción(es) para la paquetería`);
      packageTransactions.forEach((t, index) => {
        console.log(`   💰 Transacción ${index + 1}: ID ${t.id}, Monto $${t.details.details.price}`);
      });
    } else {
      console.log('❌ ERROR: No se crearon transacciones para la paquetería');
    }
    
    return { packageId: createdPackage.id, transactionIds: packageTransactions.map(t => t.id) };
    
  } catch (error) {
    console.error('❌ Error en Escenario 1:', error.message);
    throw error;
  }
}

/**
 * ESCENARIO 2: Marcar paquetería como pagada posteriormente
 */
async function testScenario2(cookies) {
  console.log('\n🧪 ESCENARIO 2: Marcar paquetería como pagada posteriormente');
  console.log('====================================================');
  
  try {
    // Crear paquetería con isPaid: false
    const unpaidPackageData = {
      ...TEST_CONFIG.packageData,
      isPaid: false,
      senderName: "Carlos",
      senderLastName: "Ruiz"
    };
    
    const createResponse = await fetch(`${BASE_URL}/api/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': cookies.join('; ')
      },
      body: JSON.stringify(unpaidPackageData)
    });

    if (!createResponse.ok) {
      throw new Error(`Error creando paquetería: ${createResponse.status}`);
    }

    const createdPackage = await createResponse.json();
    console.log(`✅ Paquetería no pagada creada con ID: ${createdPackage.id}`);
    
    // Obtener transacciones antes de marcar como pagada
    const transactionsBefore = await queryTransactions(cookies);
    const packageTransactionsBefore = findPackageTransactions(transactionsBefore, createdPackage.id);
    console.log(`📊 Transacciones relacionadas antes: ${packageTransactionsBefore.length}`);
    
    // Marcar como pagada usando el endpoint público
    const markPaidResponse = await fetch(`${BASE_URL}/api/public/packages/${createdPackage.id}/mark-paid`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        userId: TEST_CONFIG.userId,
        paymentMethod: 'Efectivo'
      })
    });

    if (!markPaidResponse.ok) {
      throw new Error(`Error marcando como pagada: ${markPaidResponse.status}`);
    }

    console.log('✅ Paquetería marcada como pagada');
    
    // Esperar un momento para que se procese la transacción
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar transacciones después de marcar como pagada
    const transactionsAfter = await queryTransactions(cookies);
    const packageTransactionsAfter = findPackageTransactions(transactionsAfter, createdPackage.id);
    
    if (packageTransactionsAfter.length > packageTransactionsBefore.length) {
      console.log(`✅ ÉXITO: Se creó transacción al marcar como pagada`);
      const newTransactions = packageTransactionsAfter.filter(t => 
        !packageTransactionsBefore.some(tb => tb.id === t.id)
      );
      newTransactions.forEach((t, index) => {
        console.log(`   💰 Nueva transacción: ID ${t.id}, Monto $${t.details.details.price}`);
      });
    } else {
      console.log('❌ ERROR: No se creó transacción al marcar como pagada');
    }
    
    return { packageId: createdPackage.id, transactionIds: packageTransactionsAfter.map(t => t.id) };
    
  } catch (error) {
    console.error('❌ Error en Escenario 2:', error.message);
    throw error;
  }
}

/**
 * ESCENARIO 3: Eliminar paquetería y verificar eliminación en cascada de transacciones
 */
async function testScenario3(cookies, packageData) {
  console.log('\n🧪 ESCENARIO 3: Eliminación en cascada de transacciones');
  console.log('==================================================');
  
  try {
    const { packageId, transactionIds } = packageData;
    
    // Verificar que las transacciones existen antes de eliminar
    const transactionsBefore = await queryTransactions(cookies);
    const packageTransactionsBefore = findPackageTransactions(transactionsBefore, packageId);
    console.log(`📊 Transacciones relacionadas antes de eliminar: ${packageTransactionsBefore.length}`);
    
    if (packageTransactionsBefore.length === 0) {
      console.log('⚠️ No hay transacciones para probar la eliminación en cascada');
      return;
    }
    
    // Eliminar la paquetería
    const deleteResponse = await fetch(`${BASE_URL}/api/packages/${packageId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': cookies.join('; ')
      }
    });

    if (!deleteResponse.ok) {
      throw new Error(`Error eliminando paquetería: ${deleteResponse.status}`);
    }

    console.log(`✅ Paquetería ${packageId} eliminada`);
    
    // Esperar un momento para que se procese la eliminación
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verificar transacciones después de eliminar
    const transactionsAfter = await queryTransactions(cookies);
    const packageTransactionsAfter = findPackageTransactions(transactionsAfter, packageId);
    
    if (packageTransactionsAfter.length === 0) {
      console.log(`✅ ÉXITO: Se eliminaron todas las transacciones relacionadas (${packageTransactionsBefore.length} eliminadas)`);
    } else {
      console.log(`❌ ERROR: Aún quedan ${packageTransactionsAfter.length} transacciones huérfanas`);
      packageTransactionsAfter.forEach(t => {
        console.log(`   💀 Transacción huérfana: ID ${t.id}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error en Escenario 3:', error.message);
    throw error;
  }
}

/**
 * Función principal
 */
async function main() {
  console.log('🚀 INICIANDO PRUEBAS COMPLETAS DE TRANSACCIONES EN PAQUETERÍAS');
  console.log('===========================================================');
  
  try {
    // Iniciar sesión
    const cookies = await login();
    
    // Ejecutar Escenario 1
    const scenario1Result = await testScenario1(cookies);
    
    // Ejecutar Escenario 2
    const scenario2Result = await testScenario2(cookies);
    
    // Ejecutar Escenario 3 con el resultado del Escenario 1
    await testScenario3(cookies, scenario1Result);
    
    // También probar eliminación del Escenario 2
    await testScenario3(cookies, scenario2Result);
    
    console.log('\n🎉 TODAS LAS PRUEBAS COMPLETADAS');
    console.log('================================');
    
  } catch (error) {
    console.error('💥 Error general:', error.message);
    process.exit(1);
  }
}

// Ejecutar si es llamado directamente
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}

function pathToFileURL(path) {
  return new URL(`file://${path}`);
}