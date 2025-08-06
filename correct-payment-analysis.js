import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 ANÁLISIS CORRECTO DE INTEGRIDAD DE PAGOS');
console.log('==========================================\n');

// Leer archivos CSV con parsing correcto
const reservationsContent = fs.readFileSync(path.join(__dirname, 'attached_assets', 'reservations_rows_1754518127934.csv'), 'utf-8');
const transactionsContent = fs.readFileSync(path.join(__dirname, 'attached_assets', 'transactions_rows_1754518175583.csv'), 'utf-8');

// Función mejorada para parsear CSV con manejo correcto de comillas
function parseCSVLine(line, headers) {
  const values = [];
  let current = '';
  let inQuotes = false;
  let i = 0;
  
  while (i < line.length) {
    const char = line[i];
    const nextChar = line[i + 1];
    
    if (char === '"') {
      if (!inQuotes) {
        inQuotes = true;
      } else if (nextChar === '"') {
        // Escape de comillas dobles
        current += '"';
        i++; // Skip next quote
      } else {
        inQuotes = false;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
    i++;
  }
  values.push(current); // Add last value
  
  const obj = {};
  headers.forEach((header, index) => {
    obj[header.trim()] = values[index] ? values[index].trim() : '';
  });
  return obj;
}

function parseCSV(content) {
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  
  return lines.slice(1).map(line => parseCSVLine(line, headers));
}

// Parsear datos
const reservations = parseCSV(reservationsContent);
const transactions = parseCSV(transactionsContent);

console.log(`Total reservaciones: ${reservations.length}`);
console.log(`Total transacciones: ${transactions.length}`);

// Filtrar reservaciones pagadas
const paidReservations = reservations.filter(res => 
  res.payment_status === 'pagado'
);

console.log(`Reservaciones marcadas como pagadas: ${paidReservations.length}\n`);

// Crear mapa de transacciones por reservation ID
const transactionsByReservation = new Map();

transactions.forEach(t => {
  let details;
  try {
    // Limpiar las comillas escapadas
    const cleanDetails = t.details.replace(/""/g, '"');
    details = JSON.parse(cleanDetails);
  } catch (e) {
    console.log(`Error parsing transaction ${t.id}: ${e.message}`);
    return;
  }
  
  if (details && details.type === 'reservation' && details.details && details.details.id) {
    const reservationId = details.details.id;
    if (!transactionsByReservation.has(reservationId)) {
      transactionsByReservation.set(reservationId, []);
    }
    transactionsByReservation.get(reservationId).push({
      transactionId: t.id,
      amount: parseFloat(details.details.monto) || 0,
      notes: details.details.notas || '',
      createdAt: t.created_at,
      userId: t.user_id
    });
  }
});

console.log(`Transacciones de reservaciones procesadas: ${transactionsByReservation.size}\n`);

// Analizar integridad
const problems = [];
let totalIntegrityIssues = 0;
let totalAmountAtRisk = 0;

paidReservations.forEach(res => {
  const reservationId = parseInt(res.id);
  const reservationAmount = parseFloat(res.total_amount) || 0;
  const transactions = transactionsByReservation.get(reservationId) || [];
  
  const totalTransactionAmount = transactions.reduce((sum, t) => sum + t.amount, 0);
  
  // Verificar si hay problemas
  if (transactions.length === 0) {
    problems.push({
      reservationId,
      type: 'NO_TRANSACTIONS',
      reservationAmount,
      transactionAmount: 0,
      difference: reservationAmount,
      paidBy: res.paid_by,
      createdBy: res.created_by,
      phone: res.phone
    });
    totalIntegrityIssues++;
    totalAmountAtRisk += reservationAmount;
  } else if (Math.abs(totalTransactionAmount - reservationAmount) > 0.01) {
    problems.push({
      reservationId,
      type: 'AMOUNT_MISMATCH',
      reservationAmount,
      transactionAmount: totalTransactionAmount,
      difference: Math.abs(totalTransactionAmount - reservationAmount),
      paidBy: res.paid_by,
      createdBy: res.created_by,
      phone: res.phone,
      transactions: transactions.length
    });
    totalIntegrityIssues++;
    totalAmountAtRisk += Math.abs(totalTransactionAmount - reservationAmount);
  }
});

// Mostrar resultados
console.log('📊 RESULTADOS DEL ANÁLISIS CORRECTO:');
console.log('====================================');

console.log(`✅ Reservaciones pagadas con integridad correcta: ${paidReservations.length - problems.length}`);
console.log(`❌ Reservaciones con problemas: ${problems.length}`);
console.log(`📈 Porcentaje de integridad: ${((paidReservations.length - problems.length) / paidReservations.length * 100).toFixed(2)}%`);
console.log(`💰 Monto en riesgo: $${totalAmountAtRisk.toFixed(2)}\n`);

// Agrupar problemas por tipo
const noTransactions = problems.filter(p => p.type === 'NO_TRANSACTIONS');
const amountMismatch = problems.filter(p => p.type === 'AMOUNT_MISMATCH');

if (noTransactions.length > 0) {
  console.log(`🚨 RESERVACIONES SIN TRANSACCIONES: ${noTransactions.length}`);
  console.log('=======================================');
  
  noTransactions.slice(0, 10).forEach((problem, index) => {
    console.log(`${index + 1}. Reservación #${problem.reservationId}`);
    console.log(`   • Monto: $${problem.reservationAmount}`);
    console.log(`   • Pagado por: ${problem.paidBy || 'N/A'}`);
    console.log(`   • Creado por: ${problem.createdBy || 'N/A'}`);
    console.log(`   • Teléfono: ${problem.phone || 'N/A'}`);
  });
  
  if (noTransactions.length > 10) {
    console.log(`   ... y ${noTransactions.length - 10} más`);
  }
}

if (amountMismatch.length > 0) {
  console.log(`\n⚠️  RESERVACIONES CON MONTOS DIFERENTES: ${amountMismatch.length}`);
  console.log('==========================================');
  
  amountMismatch.slice(0, 10).forEach((problem, index) => {
    console.log(`${index + 1}. Reservación #${problem.reservationId}`);
    console.log(`   • Monto reservación: $${problem.reservationAmount}`);
    console.log(`   • Monto transacciones: $${problem.transactionAmount}`);
    console.log(`   • Diferencia: $${problem.difference.toFixed(2)}`);
    console.log(`   • Número de transacciones: ${problem.transactions}`);
    console.log(`   • Pagado por: ${problem.paidBy || 'N/A'}`);
  });
  
  if (amountMismatch.length > 10) {
    console.log(`   ... y ${amountMismatch.length - 10} más`);
  }
}

// Verificar algunas reservaciones manualmente para confirmar
console.log('\n🔍 VERIFICACIÓN MANUAL DE RESERVACIONES ESPECÍFICAS:');
console.log('===================================================');

const testIds = [10, 26, 30, 31, 32, 35, 42];
testIds.forEach(id => {
  const transactions = transactionsByReservation.get(id) || [];
  const reservation = reservations.find(r => parseInt(r.id) === id);
  
  console.log(`\nReservación #${id}:`);
  console.log(`  Estado: ${reservation?.payment_status || 'N/A'}`);
  console.log(`  Monto: $${reservation?.total_amount || 'N/A'}`);
  console.log(`  Transacciones: ${transactions.length}`);
  
  if (transactions.length > 0) {
    transactions.forEach(t => {
      console.log(`    - Transacción #${t.transactionId}: $${t.amount} (${t.notes || 'Sin notas'})`);
    });
    const total = transactions.reduce((sum, t) => sum + t.amount, 0);
    console.log(`  Total transacciones: $${total}`);
  }
});

// Guardar reporte corregido
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    totalPaidReservations: paidReservations.length,
    problemReservations: problems.length,
    integrityPercentage: ((paidReservations.length - problems.length) / paidReservations.length * 100),
    totalAmountAtRisk: totalAmountAtRisk
  },
  problems: problems
};

fs.writeFileSync('corrected-payment-integrity-report.json', JSON.stringify(report, null, 2));

console.log(`\n📄 Reporte corregido guardado en: corrected-payment-integrity-report.json`);