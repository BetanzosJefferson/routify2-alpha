import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🔍 IDENTIFICANDO RESERVACIONES PAGADAS SIN TRANSACCIONES');
console.log('========================================================\n');

// Leer archivos
const reservationsContent = fs.readFileSync(path.join(__dirname, 'attached_assets', 'reservations_rows_1754518127934.csv'), 'utf-8');
const transactionsContent = fs.readFileSync(path.join(__dirname, 'attached_assets', 'transactions_rows_1754518175583.csv'), 'utf-8');

// Parsing simple pero robusto para CSV
function parseCSV(content) {
  const lines = content.split('\n');
  const headers = lines[0].split(',').map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const values = [];
    let current = '';
    let inQuotes = false;
    let escapeNext = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      
      if (escapeNext) {
        current += char;
        escapeNext = false;
        continue;
      }
      
      if (char === '\\') {
        escapeNext = true;
        continue;
      }
      
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          current += '"';
          j++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        values.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current);
    
    const obj = {};
    headers.forEach((header, index) => {
      obj[header] = values[index] ? values[index].trim() : '';
    });
    data.push(obj);
  }
  
  return data;
}

const reservations = parseCSV(reservationsContent);
const transactions = parseCSV(transactionsContent);

console.log(`Total reservaciones: ${reservations.length}`);
console.log(`Total transacciones: ${transactions.length}`);

// Filtrar solo reservaciones marcadas como pagadas
const paidReservations = reservations.filter(res => 
  res.payment_status === 'pagado'
);

console.log(`Reservaciones marcadas como pagadas: ${paidReservations.length}\n`);

// Crear set con todos los IDs de reservaciones que tienen transacciones
const reservationIdsWithTransactions = new Set();

transactions.forEach(transaction => {
  try {
    // Intentar parsear el JSON de details
    let detailsJson = transaction.details;
    
    // Limpiar comillas escapadas múltiples
    detailsJson = detailsJson.replace(/^"/, '').replace(/"$/, '');
    detailsJson = detailsJson.replace(/""/g, '"');
    
    const details = JSON.parse(detailsJson);
    
    if (details && details.type === 'reservation' && details.details && details.details.id) {
      // Agregar tanto como número como string para asegurar coincidencia
      reservationIdsWithTransactions.add(details.details.id);
      reservationIdsWithTransactions.add(String(details.details.id));
      reservationIdsWithTransactions.add(parseInt(details.details.id));
    }
  } catch (error) {
    // Ignorar errores de parsing - algunos JSONs pueden estar malformados
  }
});

console.log(`Reservaciones únicas con transacciones: ${reservationIdsWithTransactions.size}`);

// Encontrar reservaciones pagadas sin transacciones
const reservationsWithoutTransactions = [];

paidReservations.forEach(reservation => {
  const reservationId = reservation.id;
  const reservationIdInt = parseInt(reservationId);
  
  // Verificar si esta reservación tiene transacciones
  const hasTransactions = 
    reservationIdsWithTransactions.has(reservationId) ||
    reservationIdsWithTransactions.has(reservationIdInt) ||
    reservationIdsWithTransactions.has(String(reservationId));
  
  if (!hasTransactions) {
    let tripDetails = {};
    try {
      if (reservation.trip_details) {
        tripDetails = JSON.parse(reservation.trip_details);
      }
    } catch (e) {
      // Si no se puede parsear, usar objeto vacío
    }
    
    reservationsWithoutTransactions.push({
      id: reservationIdInt,
      amount: parseFloat(reservation.total_amount) || 0,
      paidBy: reservation.paid_by || null,
      createdBy: reservation.created_by || null,
      phone: reservation.phone || null,
      email: reservation.email || null,
      createdAt: reservation.created_at || null,
      markedAsPaidAt: reservation.marked_as_paid_at || null,
      paymentMethod: reservation.payment_method || 'efectivo',
      status: reservation.status || null,
      advanceAmount: parseFloat(reservation.advance_amount) || 0,
      advancePaymentMethod: reservation.advance_payment_method || null,
      notes: reservation.notes || null,
      origin: tripDetails.origin || 'No especificado',
      destination: tripDetails.destination || 'No especificado',
      tripId: tripDetails.tripId || tripDetails.recordId || 'No especificado',
      seats: tripDetails.seats || 1,
      companyId: reservation.company_id || null
    });
  }
});

// Ordenar por ID
reservationsWithoutTransactions.sort((a, b) => a.id - b.id);

console.log(`\n❌ RESERVACIONES PAGADAS SIN TRANSACCIONES: ${reservationsWithoutTransactions.length}`);
console.log('================================================================\n');

if (reservationsWithoutTransactions.length === 0) {
  console.log('✅ ¡EXCELENTE! No se encontraron reservaciones pagadas sin transacciones.');
  console.log('El sistema de integridad contable está funcionando correctamente.\n');
} else {
  console.log('LISTA DETALLADA:');
  console.log('================');
  
  reservationsWithoutTransactions.forEach((res, index) => {
    console.log(`${index + 1}. RESERVACIÓN #${res.id}`);
    console.log(`   • Monto: $${res.amount}`);
    console.log(`   • Estado: ${res.status}`);
    console.log(`   • Pagado por: ${res.paidBy || 'NULL'}`);
    console.log(`   • Creado por: ${res.createdBy || 'NULL'}`);
    console.log(`   • Teléfono: ${res.phone || 'Sin teléfono'}`);
    console.log(`   • Fecha creación: ${res.createdAt}`);
    console.log(`   • Fecha marcado como pagado: ${res.markedAsPaidAt || 'No especificada'}`);
    console.log(`   • Método de pago: ${res.paymentMethod}`);
    
    if (res.advanceAmount > 0) {
      console.log(`   • Anticipo: $${res.advanceAmount} (${res.advancePaymentMethod})`);
      console.log(`   • Saldo pendiente: $${res.amount - res.advanceAmount}`);
    }
    
    console.log(`   • Origen: ${res.origin}`);
    console.log(`   • Destino: ${res.destination}`);
    console.log(`   • Trip ID: ${res.tripId}`);
    console.log(`   • Asientos: ${res.seats}`);
    
    if (res.notes) {
      console.log(`   • Notas: ${res.notes}`);
    }
    
    console.log(`   • Compañía: ${res.companyId}`);
    console.log('');
  });
  
  // Agrupar por usuario
  const byUser = new Map();
  reservationsWithoutTransactions.forEach(res => {
    const userId = res.paidBy || res.createdBy || 'UNKNOWN';
    if (!byUser.has(userId)) {
      byUser.set(userId, { count: 0, amount: 0, reservations: [] });
    }
    const userData = byUser.get(userId);
    userData.count++;
    userData.amount += res.amount;
    userData.reservations.push(res.id);
  });
  
  console.log('\n👥 AGRUPACIÓN POR USUARIO:');
  console.log('==========================');
  
  Array.from(byUser.entries())
    .sort((a, b) => b[1].count - a[1].count)
    .forEach(([userId, data]) => {
      console.log(`Usuario ${userId}:`);
      console.log(`   • ${data.count} reservaciones sin transacciones`);
      console.log(`   • Monto total: $${data.amount.toFixed(2)}`);
      console.log(`   • IDs: ${data.reservations.join(', ')}`);
      console.log('');
    });
  
  // Calcular totales
  const totalAmount = reservationsWithoutTransactions.reduce((sum, res) => sum + res.amount, 0);
  const uniqueUsers = byUser.size;
  
  console.log('\n📊 RESUMEN:');
  console.log('===========');
  console.log(`Reservaciones sin transacciones: ${reservationsWithoutTransactions.length}`);
  console.log(`Monto total en riesgo: $${totalAmount.toFixed(2)}`);
  console.log(`Usuarios involucrados: ${uniqueUsers}`);
  console.log(`Promedio por reservación: $${(totalAmount / reservationsWithoutTransactions.length).toFixed(2)}`);
}

// Guardar lista de IDs para uso posterior
const ids = reservationsWithoutTransactions.map(res => res.id);
fs.writeFileSync('reservations-without-transactions-ids.txt', ids.join('\n'));

// Guardar reporte detallado
const report = {
  timestamp: new Date().toISOString(),
  totalPaidReservations: paidReservations.length,
  reservationsWithoutTransactions: reservationsWithoutTransactions.length,
  totalAmountAtRisk: reservationsWithoutTransactions.reduce((sum, res) => sum + res.amount, 0),
  details: reservationsWithoutTransactions
};

fs.writeFileSync('reservations-without-transactions-report.json', JSON.stringify(report, null, 2));

console.log(`\n📄 Archivos generados:`);
console.log(`- reservations-without-transactions-ids.txt`);
console.log(`- reservations-without-transactions-report.json`);

// Integridad general
const integrityPercentage = ((paidReservations.length - reservationsWithoutTransactions.length) / paidReservations.length) * 100;
console.log(`\n🎯 INTEGRIDAD DEL SISTEMA: ${integrityPercentage.toFixed(2)}%`);