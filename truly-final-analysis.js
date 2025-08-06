import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎯 ANÁLISIS FINAL DEFINITIVO');
console.log('============================\n');

// Función corregida para buscar transacciones
function getTransactionsByReservationId(reservationId) {
  try {
    // Buscar patrón exacto con comillas escapadas como aparecen en el CSV
    const result = execSync(`grep '""id"":${reservationId},' attached_assets/transactions_rows_1754518175583.csv`, {
      encoding: 'utf8',
      cwd: __dirname
    });
    
    return result.trim().split('\n').filter(line => line.length > 0).map(line => {
      const parts = line.split(',');
      const transactionId = parts[0];
      
      // Extraer monto del JSON
      const montoMatch = line.match(/""monto"":(\d+)/);
      const monto = montoMatch ? parseInt(montoMatch[1]) : 0;
      
      // Extraer notas
      const notasMatch = line.match(/""notas"":""([^"]*)""/) || line.match(/""notas"":null/);
      let notas = 'Sin notas';
      if (notasMatch && !notasMatch[0].includes('null')) {
        notas = notasMatch[1];
      }
      
      return {
        transactionId: parseInt(transactionId),
        monto,
        notas,
        rawLine: line
      };
    });
  } catch (error) {
    return [];
  }
}

// Verificar el caso específico del usuario
console.log('🧪 VERIFICACIÓN DEL CASO ESPECÍFICO (Reservación 1739):');
console.log('=======================================================');

const transactions1739 = getTransactionsByReservationId(1739);

console.log(`Reservación 1739:`);
console.log(`  • Número de transacciones: ${transactions1739.length}`);

if (transactions1739.length > 0) {
  console.log('  ✅ CONFIRMADO: SÍ tiene transacciones');
  
  let totalAmount = 0;
  transactions1739.forEach((t, index) => {
    console.log(`    ${index + 1}. Transacción #${t.transactionId}`);
    console.log(`       • Monto: $${t.monto}`);
    console.log(`       • Notas: ${t.notas}`);
    totalAmount += t.monto;
  });
  console.log(`  • Total transacciones: $${totalAmount}`);
  console.log('\n✅ EL USUARIO TENÍA RAZÓN. Mi metodología anterior estaba incorrecta.\n');
} else {
  console.log('  ❌ No se encontraron transacciones');
}

// Verificar otros casos
const testCases = [10, 26, 30, 31, 32, 35, 42];
console.log('🔍 VERIFICANDO OTROS CASOS:');
console.log('===========================');

let casesWithTransactions = 0;
let casesWithoutTransactions = 0;

testCases.forEach(reservationId => {
  const transactions = getTransactionsByReservationId(reservationId);
  
  console.log(`\nReservación #${reservationId}:`);
  console.log(`  • Transacciones encontradas: ${transactions.length}`);
  
  if (transactions.length > 0) {
    casesWithTransactions++;
    console.log('  ✅ SÍ tiene transacciones:');
    
    let total = 0;
    transactions.forEach((t, index) => {
      console.log(`    ${index + 1}. Transacción #${t.transactionId}: $${t.monto} (${t.notas})`);
      total += t.monto;
    });
    console.log(`  • Total: $${total}`);
  } else {
    casesWithoutTransactions++;
    console.log('  ❌ No tiene transacciones');
  }
});

console.log(`\n📊 RESULTADO DE VERIFICACIÓN DE CASOS DE PRUEBA:`);
console.log(`✅ Casos CON transacciones: ${casesWithTransactions}`);
console.log(`❌ Casos SIN transacciones: ${casesWithoutTransactions}`);

// Ahora hacer el análisis completo con la metodología corregida
console.log('\n🔍 ANÁLISIS COMPLETO CON METODOLOGÍA CORREGIDA:');
console.log('===============================================');

// Obtener todas las reservaciones pagadas
const reservationsContent = fs.readFileSync(path.join(__dirname, 'attached_assets', 'reservations_rows_1754518127934.csv'), 'utf-8');
const lines = reservationsContent.split('\n');
const header = lines[0];

console.log('Buscando reservaciones marcadas como "pagado"...');
const paidReservationLines = lines.filter(line => line.includes(',pagado,'));
console.log(`Reservaciones marcadas como pagadas: ${paidReservationLines.length}`);

const reservationsWithTransactions = [];
const reservationsWithoutTransactions = [];

console.log('Procesando cada reservación pagada...');

paidReservationLines.forEach((line, index) => {
  if (index % 100 === 0 && index > 0) {
    console.log(`  Progreso: ${index}/${paidReservationLines.length}`);
  }
  
  // Extraer ID (primer campo)
  const firstComma = line.indexOf(',');
  const reservationId = parseInt(line.substring(0, firstComma));
  
  if (isNaN(reservationId)) return;
  
  const transactions = getTransactionsByReservationId(reservationId);
  
  if (transactions.length > 0) {
    const totalTransactionAmount = transactions.reduce((sum, t) => sum + t.monto, 0);
    
    reservationsWithTransactions.push({
      id: reservationId,
      transactionCount: transactions.length,
      totalTransactionAmount,
      transactions: transactions.map(t => ({
        id: t.transactionId,
        amount: t.monto,
        notes: t.notas
      }))
    });
  } else {
    // Extraer monto de la reservación (campo 3)
    const fields = line.split(',');
    const amount = fields.length > 2 ? (parseFloat(fields[2]) || 0) : 0;
    
    reservationsWithoutTransactions.push({
      id: reservationId,
      amount: amount
    });
  }
});

console.log('\n📊 RESULTADOS FINALES CORRECTOS:');
console.log('================================');
console.log(`✅ Reservaciones CON transacciones: ${reservationsWithTransactions.length}`);
console.log(`❌ Reservaciones SIN transacciones: ${reservationsWithoutTransactions.length}`);

const totalPaid = reservationsWithTransactions.length + reservationsWithoutTransactions.length;
const integrityPercentage = (reservationsWithTransactions.length / totalPaid) * 100;

console.log(`🎯 INTEGRIDAD REAL del sistema: ${integrityPercentage.toFixed(2)}%`);

if (reservationsWithoutTransactions.length > 0) {
  const totalAtRisk = reservationsWithoutTransactions.reduce((sum, res) => sum + res.amount, 0);
  console.log(`💰 Monto REAL en riesgo: $${totalAtRisk.toFixed(2)}`);
  
  console.log('\n❌ PRIMERAS 20 RESERVACIONES REALMENTE SIN TRANSACCIONES:');
  console.log('=========================================================');
  
  reservationsWithoutTransactions.slice(0, 20).forEach((res, index) => {
    console.log(`${index + 1}. Reservación #${res.id} - $${res.amount}`);
  });
  
  if (reservationsWithoutTransactions.length > 20) {
    console.log(`... y ${reservationsWithoutTransactions.length - 20} más`);
  }
  
  // Agrupar por usuario
  console.log('\n👥 ANÁLISIS POR MONTOS:');
  console.log('======================');
  const amountRanges = {
    'Sin monto': 0,
    '$1-$200': 0,
    '$201-$500': 0,
    '$501-$1000': 0,
    'Más de $1000': 0
  };
  
  reservationsWithoutTransactions.forEach(res => {
    if (res.amount === 0) amountRanges['Sin monto']++;
    else if (res.amount <= 200) amountRanges['$1-$200']++;
    else if (res.amount <= 500) amountRanges['$201-$500']++;
    else if (res.amount <= 1000) amountRanges['$501-$1000']++;
    else amountRanges['Más de $1000']++;
  });
  
  Object.entries(amountRanges).forEach(([range, count]) => {
    console.log(`${range}: ${count} reservaciones`);
  });
  
} else {
  console.log('\n🎉 ¡EXCELENTE! Todas las reservaciones pagadas tienen transacciones correspondientes.');
}

// Guardar el reporte FINAL
const finalReport = {
  timestamp: new Date().toISOString(),
  correctionNote: 'Análisis corregido usando patrón exacto de búsqueda en CSV con comillas escapadas',
  userCaseVerification: {
    reservationId: 1739,
    transactionsFound: transactions1739.length,
    transactionDetails: transactions1739
  },
  summary: {
    totalPaidReservations: totalPaid,
    reservationsWithTransactions: reservationsWithTransactions.length,
    reservationsWithoutTransactions: reservationsWithoutTransactions.length,
    integrityPercentage: integrityPercentage,
    totalAmountAtRisk: reservationsWithoutTransactions.reduce((sum, res) => sum + res.amount, 0)
  },
  detailedResults: {
    reservationsWithTransactions: reservationsWithTransactions.slice(0, 10), // Primeras 10 para el reporte
    reservationsWithoutTransactions: reservationsWithoutTransactions
  }
};

fs.writeFileSync('TRULY-FINAL-payment-integrity-analysis.json', JSON.stringify(finalReport, null, 2));

console.log('\n📄 Reporte FINAL guardado en: TRULY-FINAL-payment-integrity-analysis.json');
console.log('\n💡 CONCLUSIÓN: La metodología de búsqueda es crítica para obtener resultados precisos.');
console.log('    El análisis anterior falló por no manejar correctamente las comillas escapadas en CSV.');