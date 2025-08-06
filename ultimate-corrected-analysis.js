import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🎯 ANÁLISIS DEFINITIVO Y CORRECTO');
console.log('=================================\n');

// Función para buscar transacciones con patrón exacto
function hasTransactionForReservation(reservationId) {
  try {
    // Usar patrón más específico para evitar falsos positivos
    const result = execSync(`grep -c '"id":${reservationId}[^0-9]' attached_assets/transactions_rows_1754518175583.csv`, {
      encoding: 'utf8',
      cwd: __dirname
    });
    return parseInt(result.trim()) > 0;
  } catch (error) {
    return false;
  }
}

function getTransactionDetailsForReservation(reservationId) {
  try {
    const result = execSync(`grep '"id":${reservationId}[^0-9]' attached_assets/transactions_rows_1754518175583.csv`, {
      encoding: 'utf8',
      cwd: __dirname
    });
    
    return result.trim().split('\n').filter(line => line.length > 0).map(line => {
      const parts = line.split(',');
      const transactionId = parts[0];
      
      // Extraer monto
      const montoMatch = line.match(/"monto":(\d+)/);
      const monto = montoMatch ? parseInt(montoMatch[1]) : 0;
      
      // Extraer notas
      const notasMatch = line.match(/"notas":"([^"]*)"/) || line.match(/"notas":null/);
      const notas = notasMatch && !notasMatch[0].includes('null') ? notasMatch[1] : 'Sin notas';
      
      return {
        transactionId,
        monto,
        notas,
        line
      };
    });
  } catch (error) {
    return [];
  }
}

// Verificar el caso específico que mencionó el usuario
console.log('🧪 VERIFICACIÓN DEL CASO REPORTADO POR EL USUARIO:');
console.log('=================================================');

const reservation1739HasTransaction = hasTransactionForReservation(1739);
const transaction1739Details = getTransactionDetailsForReservation(1739);

console.log(`Reservación 1739 tiene transacciones: ${reservation1739HasTransaction}`);
console.log(`Número de transacciones encontradas: ${transaction1739Details.length}`);

if (transaction1739Details.length > 0) {
  console.log('✅ CONFIRMADO: La reservación 1739 SÍ tiene transacciones:');
  transaction1739Details.forEach((t, index) => {
    console.log(`  ${index + 1}. Transacción #${t.transactionId}`);
    console.log(`     • Monto: $${t.monto}`);
    console.log(`     • Notas: ${t.notas}`);
  });
  console.log('\n👍 El usuario tenía razón. Mi análisis previo estaba incorrecto.\n');
} else {
  console.log('❌ No se encontraron transacciones para la reservación 1739');
}

// Verificar otros casos que marqué incorrectamente como problemáticos
const testCases = [10, 26, 30, 31, 32, 35, 42];
console.log('🔍 VERIFICANDO OTROS CASOS PREVIAMENTE MARCADOS COMO PROBLEMÁTICOS:');
console.log('====================================================================');

let correctCases = 0;
let stillProblematic = 0;

testCases.forEach(reservationId => {
  const hasTransaction = hasTransactionForReservation(reservationId);
  const transactionDetails = getTransactionDetailsForReservation(reservationId);
  
  console.log(`\nReservación #${reservationId}:`);
  console.log(`  • Tiene transacciones: ${hasTransaction}`);
  console.log(`  • Número de transacciones: ${transactionDetails.length}`);
  
  if (transactionDetails.length > 0) {
    correctCases++;
    console.log('  ✅ CORRECCIÓN: SÍ tiene transacciones');
    
    let totalAmount = 0;
    transactionDetails.forEach((t, index) => {
      console.log(`    ${index + 1}. Transacción #${t.transactionId}: $${t.monto}`);
      totalAmount += t.monto;
    });
    console.log(`  • Total en transacciones: $${totalAmount}`);
  } else {
    stillProblematic++;
    console.log('  ❌ Realmente no tiene transacciones');
  }
});

console.log(`\n📊 RESULTADO DE LA VERIFICACIÓN:`);
console.log(`✅ Casos que SÍ tienen transacciones (corregidos): ${correctCases}`);
console.log(`❌ Casos que realmente no tienen transacciones: ${stillProblematic}`);

// Ahora hacer un análisis completo CORRECTO
console.log('\n🔍 ANÁLISIS COMPLETO CON MÉTODO CORREGIDO:');
console.log('==========================================');

// Obtener todas las reservaciones pagadas
const paidReservationsLines = execSync(`grep ",pagado," attached_assets/reservations_rows_1754518127934.csv`, {
  encoding: 'utf8',
  cwd: __dirname
}).trim().split('\n').filter(line => line.length > 0);

console.log(`Total reservaciones marcadas como pagadas: ${paidReservationsLines.length}`);

const reservationsWithTransactions = [];
const reservationsWithoutTransactions = [];

console.log('Procesando todas las reservaciones pagadas...');

paidReservationsLines.forEach((line, index) => {
  if (index % 200 === 0 && index > 0) {
    console.log(`  Progreso: ${index}/${paidReservationsLines.length}`);
  }
  
  // Extraer ID de la reservación (primer campo)
  const firstComma = line.indexOf(',');
  const reservationId = parseInt(line.substring(0, firstComma));
  
  if (isNaN(reservationId)) return;
  
  const hasTransaction = hasTransactionForReservation(reservationId);
  const transactionDetails = getTransactionDetailsForReservation(reservationId);
  
  if (hasTransaction && transactionDetails.length > 0) {
    const totalTransactionAmount = transactionDetails.reduce((sum, t) => sum + t.monto, 0);
    
    reservationsWithTransactions.push({
      id: reservationId,
      transactionCount: transactionDetails.length,
      totalAmount: totalTransactionAmount
    });
  } else {
    // Extraer monto de la reservación
    const parts = line.split(',');
    const amount = parts.length > 2 ? (parseFloat(parts[2]) || 0) : 0;
    
    reservationsWithoutTransactions.push({
      id: reservationId,
      amount: amount
    });
  }
});

console.log('\n📊 RESULTADOS FINALES CORREGIDOS:');
console.log('=================================');
console.log(`✅ Reservaciones CON transacciones: ${reservationsWithTransactions.length}`);
console.log(`❌ Reservaciones SIN transacciones: ${reservationsWithoutTransactions.length}`);

const totalPaid = reservationsWithTransactions.length + reservationsWithoutTransactions.length;
const integrityPercentage = (reservationsWithTransactions.length / totalPaid) * 100;
console.log(`🎯 INTEGRIDAD REAL del sistema: ${integrityPercentage.toFixed(2)}%`);

if (reservationsWithoutTransactions.length > 0) {
  const totalAtRisk = reservationsWithoutTransactions.reduce((sum, res) => sum + res.amount, 0);
  console.log(`💰 Monto REAL en riesgo: $${totalAtRisk.toFixed(2)}`);
  console.log(`📈 Promedio por reservación problemática: $${(totalAtRisk / reservationsWithoutTransactions.length).toFixed(2)}`);
  
  console.log('\n❌ LISTA DE RESERVACIONES REALMENTE SIN TRANSACCIONES:');
  console.log('======================================================');
  
  // Mostrar las primeras 20
  reservationsWithoutTransactions.slice(0, 20).forEach((res, index) => {
    console.log(`${index + 1}. Reservación #${res.id} - $${res.amount}`);
  });
  
  if (reservationsWithoutTransactions.length > 20) {
    console.log(`... y ${reservationsWithoutTransactions.length - 20} reservaciones más sin transacciones`);
  }
  
} else {
  console.log('\n🎉 ¡PERFECTO! Todas las reservaciones pagadas tienen sus transacciones correspondientes.');
}

// Guardar el análisis FINAL corregido
const finalReport = {
  timestamp: new Date().toISOString(),
  correctionNote: 'Análisis corregido después de que el usuario reportó error en reservación 1739',
  verification: {
    userReportedCase: {
      reservationId: 1739,
      hasTransactions: reservation1739HasTransaction,
      transactionCount: transaction1739Details.length,
      transactionDetails: transaction1739Details.map(t => ({
        id: t.transactionId,
        amount: t.monto,
        notes: t.notas
      }))
    },
    testCasesVerification: {
      totalTested: testCases.length,
      casesWithTransactions: correctCases,
      casesWithoutTransactions: stillProblematic
    }
  },
  summary: {
    totalPaidReservations: totalPaid,
    reservationsWithTransactions: reservationsWithTransactions.length,
    reservationsWithoutTransactions: reservationsWithoutTransactions.length,
    integrityPercentage: integrityPercentage,
    totalAmountAtRisk: reservationsWithoutTransactions.reduce((sum, res) => sum + res.amount, 0)
  },
  problematicReservations: reservationsWithoutTransactions
};

fs.writeFileSync('FINAL-CORRECTED-payment-integrity-analysis.json', JSON.stringify(finalReport, null, 2));

console.log('\n📄 ANÁLISIS FINAL CORREGIDO guardado en: FINAL-CORRECTED-payment-integrity-analysis.json');
console.log('\n💡 LECCIÓN APRENDIDA: Es crucial validar la metodología de análisis');
console.log('    con casos específicos antes de generar reportes completos.');