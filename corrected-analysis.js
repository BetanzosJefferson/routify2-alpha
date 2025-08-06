import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 ANÁLISIS CORREGIDO - USANDO GREP PARA VERIFICACIÓN');
console.log('===================================================\n');

// Función para buscar transacciones por reservation ID usando grep
function findTransactionsByReservationId(reservationId) {
  try {
    const { execSync } = require('child_process');
    const result = execSync(`grep -n "\"id\":${reservationId}" attached_assets/transactions_rows_1754518175583.csv`, {
      encoding: 'utf8',
      cwd: __dirname
    });
    
    return result.trim().split('\n').filter(line => line.length > 0);
  } catch (error) {
    // No se encontraron coincidencias
    return [];
  }
}

// Leer reservaciones
const reservationsContent = fs.readFileSync(path.join(__dirname, 'attached_assets', 'reservations_rows_1754518127934.csv'), 'utf-8');

function parseCSVSimple(content) {
  const lines = content.split('\n').filter(line => line.trim());
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = line.split(',');
    const obj = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = values[index] ? values[index].trim().replace(/^"/, '').replace(/"$/, '') : '';
    });
    return obj;
  });
}

const reservations = parseCSVSimple(reservationsContent);

// Filtrar reservaciones pagadas
const paidReservations = reservations.filter(res => res.payment_status === 'pagado');

console.log(`Total reservaciones: ${reservations.length}`);
console.log(`Reservaciones pagadas: ${paidReservations.length}\n`);

console.log('🧪 VERIFICANDO CASOS ESPECÍFICOS:');
console.log('=================================');

// Verificar caso específico mencionado por el usuario
console.log('\n1. Verificando Reservación 1739:');
const reservation1739 = reservations.find(r => r.id === '1739');
if (reservation1739) {
  console.log(`   - Estado: ${reservation1739.payment_status}`);
  console.log(`   - Monto: $${reservation1739.total_amount}`);
  
  const transactions1739 = findTransactionsByReservationId(1739);
  console.log(`   - Transacciones encontradas: ${transactions1739.length}`);
  
  transactions1739.forEach(line => {
    const parts = line.split(':');
    const lineNumber = parts[0];
    const content = parts.slice(1).join(':');
    const transactionId = content.split(',')[0];
    console.log(`     * Línea ${lineNumber}: Transacción #${transactionId}`);
    
    // Extraer monto de la transacción
    const montoMatch = content.match(/"monto":(\d+)/);
    if (montoMatch) {
      console.log(`     * Monto: $${montoMatch[1]}`);
    }
  });
} else {
  console.log('   - Reservación 1739 no encontrada');
}

// Verificar algunos otros casos del reporte anterior
const testCases = [10, 26, 30, 31, 132, 823, 894];

testCases.forEach(resId => {
  console.log(`\n${testCases.indexOf(resId) + 2}. Verificando Reservación ${resId}:`);
  
  const reservation = reservations.find(r => parseInt(r.id) === resId);
  if (!reservation) {
    console.log(`   - Reservación ${resId} no encontrada`);
    return;
  }
  
  console.log(`   - Estado: ${reservation.payment_status}`);
  console.log(`   - Monto: $${reservation.total_amount}`);
  
  const transactions = findTransactionsByReservationId(resId);
  console.log(`   - Transacciones encontradas: ${transactions.length}`);
  
  if (transactions.length > 0) {
    transactions.forEach(line => {
      const parts = line.split(':');
      const lineNumber = parts[0];
      const content = parts.slice(1).join(':');
      const transactionId = content.split(',')[0];
      console.log(`     * Línea ${lineNumber}: Transacción #${transactionId}`);
      
      const montoMatch = content.match(/"monto":(\d+)/);
      if (montoMatch) {
        console.log(`       - Monto: $${montoMatch[1]}`);
      }
    });
  } else {
    console.log('     * NO SE ENCONTRARON TRANSACCIONES');
  }
});

// Ahora hacer análisis completo con método corregido
console.log('\n\n🔍 ANÁLISIS COMPLETO CON MÉTODO CORREGIDO:');
console.log('==========================================\n');

const reservationsWithoutTransactions = [];
const reservationsWithTransactions = [];

console.log('Procesando todas las reservaciones pagadas...');

paidReservations.forEach((res, index) => {
  if (index % 100 === 0) {
    console.log(`Progreso: ${index}/${paidReservations.length}`);
  }
  
  const reservationId = parseInt(res.id);
  const transactions = findTransactionsByReservationId(reservationId);
  
  if (transactions.length === 0) {
    reservationsWithoutTransactions.push({
      id: reservationId,
      amount: parseFloat(res.total_amount) || 0,
      paidBy: res.paid_by || null,
      createdBy: res.created_by || null,
      status: res.payment_status,
      createdAt: res.created_at
    });
  } else {
    reservationsWithTransactions.push({
      id: reservationId,
      transactions: transactions.length
    });
  }
});

console.log('\n📊 RESULTADOS FINALES CORREGIDOS:');
console.log('=================================');
console.log(`✅ Reservaciones con transacciones: ${reservationsWithTransactions.length}`);
console.log(`❌ Reservaciones SIN transacciones: ${reservationsWithoutTransactions.length}`);

const integrityPercentage = ((reservationsWithTransactions.length) / paidReservations.length) * 100;
console.log(`🎯 Integridad real del sistema: ${integrityPercentage.toFixed(2)}%`);

if (reservationsWithoutTransactions.length > 0) {
  const totalAtRisk = reservationsWithoutTransactions.reduce((sum, res) => sum + res.amount, 0);
  console.log(`💰 Monto real en riesgo: $${totalAtRisk.toFixed(2)}`);
  
  console.log('\nPrimeras 20 reservaciones SIN transacciones:');
  reservationsWithoutTransactions.slice(0, 20).forEach((res, index) => {
    console.log(`${index + 1}. Reservación #${res.id} - $${res.amount} (Usuario ${res.paidBy})`);
  });
} else {
  console.log('\n🎉 ¡EXCELENTE! Todas las reservaciones pagadas tienen transacciones asociadas.');
}

// Guardar los resultados corregidos
fs.writeFileSync('corrected-reservations-without-transactions.json', JSON.stringify({
  timestamp: new Date().toISOString(),
  method: 'grep-based-verification',
  totalPaidReservations: paidReservations.length,
  reservationsWithTransactions: reservationsWithTransactions.length,
  reservationsWithoutTransactions: reservationsWithoutTransactions.length,
  integrityPercentage: integrityPercentage,
  details: reservationsWithoutTransactions
}, null, 2));

console.log('\n📄 Reporte corregido guardado en: corrected-reservations-without-transactions.json');