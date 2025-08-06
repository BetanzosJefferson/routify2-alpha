import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para leer CSV y convertir a objetos
function readCSV(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.trim().split('\n');
  const headers = lines[0].split(',');
  
  return lines.slice(1).map(line => {
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      
      if (char === '"' && (i === 0 || line[i-1] === ',')) {
        inQuotes = true;
      } else if (char === '"' && (i === line.length - 1 || line[i+1] === ',')) {
        inQuotes = false;
      } else if (char === ',' && !inQuotes) {
        values.push(current.trim());
        current = '';
        continue;
      } else {
        current += char;
      }
    }
    values.push(current.trim());
    
    const obj = {};
    headers.forEach((header, index) => {
      obj[header.trim()] = values[index] || '';
    });
    return obj;
  });
}

function parseDetails(detailsStr) {
  try {
    return JSON.parse(detailsStr);
  } catch (e) {
    return null;
  }
}

console.log('🕵️  ANÁLISIS DE USUARIOS CON RESERVACIONES PAGADAS SIN TRANSACCIONES');
console.log('===================================================================\n');

// Leer archivos
const reservationsPath = path.join(__dirname, 'attached_assets', 'reservations_rows_1754518127934.csv');
const transactionsPath = path.join(__dirname, 'attached_assets', 'transactions_rows_1754518175583.csv');

const reservations = readCSV(reservationsPath);
const transactions = readCSV(transactionsPath);

console.log(`Reservaciones totales: ${reservations.length}`);
console.log(`Transacciones totales: ${transactions.length}\n`);

// Filtrar reservaciones pagadas
const paidReservations = reservations.filter(res => 
  res.payment_status === 'pagado' || res.payment_status === 'paid'
);

console.log(`Reservaciones marcadas como pagadas: ${paidReservations.length}`);

// Crear mapa de transacciones por reservation ID
const reservationTransactions = transactions.filter(t => {
  const details = parseDetails(t.details);
  return details && details.type === 'reservation';
});

const transactionMap = new Map();
reservationTransactions.forEach(t => {
  const details = parseDetails(t.details);
  if (details && details.details && details.details.id) {
    const reservationId = details.details.id;
    if (!transactionMap.has(reservationId)) {
      transactionMap.set(reservationId, []);
    }
    transactionMap.get(reservationId).push(t);
  }
});

// Encontrar reservaciones pagadas sin transacciones
const reservationsWithoutTransactions = [];
const userAbuseSummary = new Map();

paidReservations.forEach(res => {
  const reservationId = parseInt(res.id);
  const hasTransactions = transactionMap.has(reservationId);
  
  if (!hasTransactions) {
    const userId = res.paid_by || res.created_by || 'UNKNOWN';
    const amount = parseFloat(res.total_amount) || 0;
    
    const reservationData = {
      reservationId: reservationId,
      amount: amount,
      paidBy: res.paid_by || 'NULL',
      createdBy: res.created_by || 'NULL',
      phone: res.phone || 'Sin teléfono',
      createdAt: res.created_at,
      markedAsPaidAt: res.marked_as_paid_at || 'NULL',
      paymentMethod: res.payment_method || 'efectivo'
    };
    
    reservationsWithoutTransactions.push(reservationData);
    
    // Agregar al resumen de abuso por usuario
    if (!userAbuseSummary.has(userId)) {
      userAbuseSummary.set(userId, {
        userId: userId,
        totalReservations: 0,
        totalAmount: 0,
        reservations: []
      });
    }
    
    const userSummary = userAbuseSummary.get(userId);
    userSummary.totalReservations += 1;
    userSummary.totalAmount += amount;
    userSummary.reservations.push(reservationData);
  }
});

console.log(`\n❌ RESERVACIONES PAGADAS SIN TRANSACCIONES: ${reservationsWithoutTransactions.length}`);
console.log(`👥 USUARIOS INVOLUCRADOS: ${userAbuseSummary.size}\n`);

// Ordenar usuarios por cantidad de reservaciones problemáticas
const sortedUsers = Array.from(userAbuseSummary.values())
  .sort((a, b) => b.totalReservations - a.totalReservations);

console.log('🚨 RANKING DE USUARIOS CON MÁS RESERVACIONES SIN TRANSACCIONES:');
console.log('===============================================================');

sortedUsers.forEach((userSummary, index) => {
  console.log(`\n${index + 1}. USUARIO ID: ${userSummary.userId}`);
  console.log(`   • Reservaciones sin transacciones: ${userSummary.totalReservations}`);
  console.log(`   • Monto total no contabilizado: $${userSummary.totalAmount.toFixed(2)}`);
  console.log(`   • Promedio por reservación: $${(userSummary.totalAmount / userSummary.totalReservations).toFixed(2)}`);
  
  console.log(`   • Detalle de reservaciones:`);
  userSummary.reservations.forEach((res, resIndex) => {
    console.log(`     ${resIndex + 1}. Reservación #${res.reservationId} - $${res.amount} - ${res.createdAt}`);
  });
});

// Análisis temporal
console.log(`\n📅 ANÁLISIS TEMPORAL:`);
console.log('====================');

const dateGroups = new Map();
reservationsWithoutTransactions.forEach(res => {
  const date = res.createdAt.split(' ')[0]; // Obtener solo la fecha
  if (!dateGroups.has(date)) {
    dateGroups.set(date, { count: 0, amount: 0 });
  }
  dateGroups.get(date).count += 1;
  dateGroups.get(date).amount += res.amount;
});

const sortedDates = Array.from(dateGroups.entries())
  .sort(([a], [b]) => b.localeCompare(a))
  .slice(0, 10); // Top 10 días

console.log('Top 10 días con más reservaciones sin transacciones:');
sortedDates.forEach(([date, data], index) => {
  console.log(`${index + 1}. ${date}: ${data.count} reservaciones - $${data.amount.toFixed(2)}`);
});

// Crear archivo CSV con el detalle completo
const csvHeader = 'Reservacion_ID,Usuario_Pagado_Por,Usuario_Creado_Por,Monto,Telefono,Fecha_Creacion,Fecha_Marcado_Pagado,Metodo_Pago\n';
const csvRows = reservationsWithoutTransactions.map(res => 
  `${res.reservationId},${res.paidBy},${res.createdBy},${res.amount},${res.phone},${res.createdAt},${res.markedAsPaidAt},${res.paymentMethod}`
).join('\n');

fs.writeFileSync('reservaciones-sin-transacciones.csv', csvHeader + csvRows);

// Generar reporte completo
const report = {
  timestamp: new Date().toISOString(),
  summary: {
    totalPaidReservations: paidReservations.length,
    reservationsWithoutTransactions: reservationsWithoutTransactions.length,
    usersInvolved: userAbuseSummary.size,
    totalAmountAtRisk: reservationsWithoutTransactions.reduce((sum, res) => sum + res.amount, 0)
  },
  userAbuseSummary: sortedUsers,
  temporalAnalysis: sortedDates,
  detailedReservations: reservationsWithoutTransactions
};

fs.writeFileSync('user-abuse-analysis.json', JSON.stringify(report, null, 2));

console.log(`\n📊 RESUMEN EJECUTIVO:`);
console.log('====================');
console.log(`Total reservaciones pagadas: ${paidReservations.length}`);
console.log(`Reservaciones sin transacciones: ${reservationsWithoutTransactions.length}`);
console.log(`Porcentaje de integridad: ${((paidReservations.length - reservationsWithoutTransactions.length) / paidReservations.length * 100).toFixed(2)}%`);
console.log(`Monto total en riesgo: $${report.summary.totalAmountAtRisk.toFixed(2)}`);
console.log(`Usuarios involucrados: ${userAbuseSummary.size}`);

console.log(`\n📄 Archivos generados:`);
console.log('- reservaciones-sin-transacciones.csv: Lista detallada en CSV');
console.log('- user-abuse-analysis.json: Análisis completo en JSON');

console.log(`\n⚠️  ACCIONES RECOMENDADAS:`);
console.log('1. Investigar a los usuarios con más reservaciones problemáticas');
console.log('2. Revisar los patrones temporales para identificar períodos críticos');
console.log('3. Implementar controles más estrictos en el proceso de marcado de pagos');
console.log('4. Crear auditorías automáticas para detectar este problema en tiempo real');