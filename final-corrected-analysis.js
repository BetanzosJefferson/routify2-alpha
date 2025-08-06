import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 ANÁLISIS FINAL CORREGIDO');
console.log('===========================\n');

// Función para buscar transacciones usando grep
function hasTransactionForReservation(reservationId) {
  try {
    const result = execSync(`grep -c "\"id\":${reservationId}" attached_assets/transactions_rows_1754518175583.csv`, {
      encoding: 'utf8',
      cwd: __dirname
    });
    return parseInt(result.trim()) > 0;
  } catch (error) {
    return false;
  }
}

function getTransactionDetails(reservationId) {
  try {
    const result = execSync(`grep "\"id\":${reservationId}" attached_assets/transactions_rows_1754518175583.csv`, {
      encoding: 'utf8',
      cwd: __dirname
    });
    return result.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    return [];
  }
}

// Obtener todas las líneas de reservaciones pagadas usando grep
console.log('Obteniendo reservaciones pagadas...');
const paidReservationsLines = execSync(`grep ",pagado," attached_assets/reservations_rows_1754518127934.csv`, {
  encoding: 'utf8',
  cwd: __dirname
}).trim().split('\n').filter(line => line.length > 0);

console.log(`Reservaciones marcadas como pagadas: ${paidReservationsLines.length}`);

// Verificar el caso específico mencionado por el usuario
console.log('\n🧪 VERIFICACIÓN DEL CASO ESPECÍFICO:');
console.log('====================================');

const hasTransaction1739 = hasTransactionForReservation(1739);
const transactionDetails1739 = getTransactionDetails(1739);

console.log(`Reservación 1739 tiene transacciones: ${hasTransaction1739}`);
console.log(`Número de transacciones: ${transactionDetails1739.length}`);

if (transactionDetails1739.length > 0) {
  console.log('Detalles de transacciones:');
  transactionDetails1739.forEach((line, index) => {
    const parts = line.split(',');
    const transactionId = parts[0];
    console.log(`  ${index + 1}. Transacción #${transactionId}`);
    
    // Extraer monto
    const montoMatch = line.match(/"monto":(\d+)/);
    if (montoMatch) {
      console.log(`     Monto: $${montoMatch[1]}`);
    }
  });
}

// Ahora procesar todas las reservaciones pagadas
console.log('\n🔍 PROCESANDO TODAS LAS RESERVACIONES PAGADAS:');
console.log('===============================================');

const reservationsWithoutTransactions = [];
const reservationsWithTransactions = [];

paidReservationsLines.forEach((line, index) => {
  if (index % 100 === 0 && index > 0) {
    console.log(`Progreso: ${index}/${paidReservationsLines.length}`);
  }
  
  // Extraer ID de la reservación (primer campo)
  const firstComma = line.indexOf(',');
  const reservationId = parseInt(line.substring(0, firstComma));
  
  if (isNaN(reservationId)) return;
  
  const hasTransaction = hasTransactionForReservation(reservationId);
  
  if (hasTransaction) {
    reservationsWithTransactions.push(reservationId);
  } else {
    // Extraer más detalles de la reservación
    const parts = line.split(',');
    let amount = 0;
    
    // El monto está en la tercera columna (índice 2)
    if (parts.length > 2) {
      amount = parseFloat(parts[2]) || 0;
    }
    
    reservationsWithoutTransactions.push({
      id: reservationId,
      amount: amount,
      rawLine: line
    });
  }
});

console.log('\n📊 RESULTADOS FINALES:');
console.log('======================');
console.log(`✅ Reservaciones CON transacciones: ${reservationsWithTransactions.length}`);
console.log(`❌ Reservaciones SIN transacciones: ${reservationsWithoutTransactions.length}`);

const totalPaid = reservationsWithTransactions.length + reservationsWithoutTransactions.length;
const integrityPercentage = (reservationsWithTransactions.length / totalPaid) * 100;
console.log(`🎯 Integridad real del sistema: ${integrityPercentage.toFixed(2)}%`);

if (reservationsWithoutTransactions.length > 0) {
  const totalAtRisk = reservationsWithoutTransactions.reduce((sum, res) => sum + res.amount, 0);
  console.log(`💰 Monto en riesgo: $${totalAtRisk.toFixed(2)}`);
  
  console.log('\n❌ RESERVACIONES SIN TRANSACCIONES (primeras 30):');
  console.log('================================================');
  
  reservationsWithoutTransactions.slice(0, 30).forEach((res, index) => {
    console.log(`${index + 1}. Reservación #${res.id} - $${res.amount}`);
  });
  
  if (reservationsWithoutTransactions.length > 30) {
    console.log(`... y ${reservationsWithoutTransactions.length - 30} más`);
  }
  
  // Verificar algunas manualmente para confirmar
  console.log('\n🔍 VERIFICACIÓN MANUAL DE ALGUNOS CASOS:');
  console.log('========================================');
  
  const samplesToVerify = reservationsWithoutTransactions.slice(0, 5);
  samplesToVerify.forEach(res => {
    const hasTransaction = hasTransactionForReservation(res.id);
    const transactionDetails = getTransactionDetails(res.id);
    
    console.log(`Reservación #${res.id}:`);
    console.log(`  - Tiene transacciones: ${hasTransaction}`);
    console.log(`  - Número de transacciones: ${transactionDetails.length}`);
    
    if (transactionDetails.length > 0) {
      console.log('  - ⚠️ INCONSISTENCIA DETECTADA - SÍ tiene transacciones pero fue marcada como sin ellas');
      transactionDetails.forEach(line => {
        const transactionId = line.split(',')[0];
        const montoMatch = line.match(/"monto":(\d+)/);
        console.log(`    * Transacción #${transactionId} - $${montoMatch ? montoMatch[1] : 'N/A'}`);
      });
    }
  });
} else {
  console.log('\n🎉 ¡PERFECTA INTEGRIDAD! Todas las reservaciones pagadas tienen transacciones.');
}

// Guardar reporte final
const finalReport = {
  timestamp: new Date().toISOString(),
  method: 'grep-based-direct-search',
  verification: {
    reservation1739HasTransaction: hasTransaction1739,
    reservation1739TransactionCount: transactionDetails1739.length
  },
  summary: {
    totalPaidReservations: totalPaid,
    reservationsWithTransactions: reservationsWithTransactions.length,
    reservationsWithoutTransactions: reservationsWithoutTransactions.length,
    integrityPercentage: integrityPercentage,
    totalAmountAtRisk: reservationsWithoutTransactions.reduce((sum, res) => sum + res.amount, 0)
  },
  reservationsWithoutTransactions: reservationsWithoutTransactions.map(r => ({
    id: r.id,
    amount: r.amount
  }))
};

fs.writeFileSync('final-payment-integrity-analysis.json', JSON.stringify(finalReport, null, 2));
console.log('\n📄 Reporte final guardado en: final-payment-integrity-analysis.json');