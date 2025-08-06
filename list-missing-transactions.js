import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Función para leer CSV
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

console.log('📋 LISTA DETALLADA DE RESERVACIONES SIN TRANSACCIONES');
console.log('====================================================\n');

// Leer archivos
const reservationsPath = path.join(__dirname, 'attached_assets', 'reservations_rows_1754518127934.csv');
const transactionsPath = path.join(__dirname, 'attached_assets', 'transactions_rows_1754518175583.csv');

const reservations = readCSV(reservationsPath);
const transactions = readCSV(transactionsPath);

// Filtrar reservaciones pagadas
const paidReservations = reservations.filter(res => 
  res.payment_status === 'pagado' || res.payment_status === 'paid'
);

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

// Encontrar reservaciones sin transacciones
const missingTransactions = [];

paidReservations.forEach(res => {
  const reservationId = parseInt(res.id);
  const hasTransactions = transactionMap.has(reservationId);
  
  if (!hasTransactions) {
    let tripDetails;
    try {
      tripDetails = JSON.parse(res.trip_details);
    } catch (e) {
      tripDetails = {};
    }
    
    missingTransactions.push({
      id: reservationId,
      amount: parseFloat(res.total_amount) || 0,
      paidBy: res.paid_by || 'NULL',
      createdBy: res.created_by || 'NULL',
      phone: res.phone || 'Sin teléfono',
      email: res.email || 'Sin email',
      createdAt: res.created_at,
      markedAsPaidAt: res.marked_as_paid_at || 'No marcado',
      paymentMethod: res.payment_method || 'efectivo',
      origin: tripDetails.origin || 'No especificado',
      destination: tripDetails.destination || 'No especificado',
      tripId: tripDetails.tripId || tripDetails.recordId || 'No especificado',
      seats: tripDetails.seats || 1,
      advanceAmount: parseFloat(res.advance_amount) || 0,
      advancePaymentMethod: res.advance_payment_method || 'efectivo',
      notes: res.notes || '',
      status: res.status || '',
      companyId: res.company_id || ''
    });
  }
});

// Ordenar por ID de reservación
missingTransactions.sort((a, b) => a.id - b.id);

console.log(`Total de reservaciones sin transacciones: ${missingTransactions.length}\n`);

// Mostrar lista detallada
console.log('LISTA COMPLETA DE RESERVACIONES SIN TRANSACCIONES:');
console.log('==================================================');

missingTransactions.forEach((res, index) => {
  console.log(`${index + 1}. RESERVACIÓN #${res.id}`);
  console.log(`   • Monto: $${res.amount}`);
  console.log(`   • Pagado por usuario: ${res.paidBy}`);
  console.log(`   • Creado por usuario: ${res.createdBy}`);
  console.log(`   • Teléfono: ${res.phone}`);
  console.log(`   • Email: ${res.email}`);
  console.log(`   • Fecha creación: ${res.createdAt}`);
  console.log(`   • Fecha marcado pagado: ${res.markedAsPaidAt}`);
  console.log(`   • Método de pago: ${res.paymentMethod}`);
  console.log(`   • Origen: ${res.origin}`);
  console.log(`   • Destino: ${res.destination}`);
  console.log(`   • Trip ID: ${res.tripId}`);
  console.log(`   • Asientos: ${res.seats}`);
  if (res.advanceAmount > 0) {
    console.log(`   • Anticipo: $${res.advanceAmount} (${res.advancePaymentMethod})`);
  }
  if (res.notes) {
    console.log(`   • Notas: ${res.notes}`);
  }
  console.log(`   • Estado: ${res.status}`);
  console.log(`   • Compañía: ${res.companyId}`);
  console.log('');
});

// Generar archivo CSV con todos los detalles
const csvHeader = [
  'ID_Reservacion',
  'Monto',
  'Usuario_Pagado_Por',
  'Usuario_Creado_Por',
  'Telefono',
  'Email',
  'Fecha_Creacion',
  'Fecha_Marcado_Pagado',
  'Metodo_Pago',
  'Origen',
  'Destino',
  'Trip_ID',
  'Asientos',
  'Monto_Anticipo',
  'Metodo_Pago_Anticipo',
  'Notas',
  'Estado',
  'Company_ID'
].join(',') + '\n';

const csvRows = missingTransactions.map(res => [
  res.id,
  res.amount,
  res.paidBy,
  res.createdBy,
  `"${res.phone}"`,
  `"${res.email}"`,
  res.createdAt,
  res.markedAsPaidAt,
  res.paymentMethod,
  `"${res.origin}"`,
  `"${res.destination}"`,
  res.tripId,
  res.seats,
  res.advanceAmount,
  res.advancePaymentMethod,
  `"${res.notes}"`,
  res.status,
  res.companyId
].join(','));

fs.writeFileSync('lista-completa-reservaciones-sin-transacciones.csv', csvHeader + csvRows.join('\n'));

// Crear lista simple solo con IDs
const simpleList = missingTransactions.map(res => res.id);
fs.writeFileSync('ids-reservaciones-sin-transacciones.txt', simpleList.join('\n'));

// Agrupar por usuario
const byUser = new Map();
missingTransactions.forEach(res => {
  const userId = res.paidBy || res.createdBy;
  if (!byUser.has(userId)) {
    byUser.set(userId, []);
  }
  byUser.get(userId).push(res.id);
});

console.log('\n🔍 AGRUPACIÓN POR USUARIO:');
console.log('==========================');

Array.from(byUser.entries()).forEach(([userId, reservationIds]) => {
  console.log(`Usuario ${userId}: ${reservationIds.length} reservaciones`);
  console.log(`   IDs: ${reservationIds.join(', ')}`);
});

// Resumen final
console.log('\n📊 RESUMEN:');
console.log('===========');
console.log(`Total de reservaciones sin transacciones: ${missingTransactions.length}`);
console.log(`Monto total en riesgo: $${missingTransactions.reduce((sum, res) => sum + res.amount, 0).toFixed(2)}`);
console.log(`Rango de IDs: ${Math.min(...simpleList)} - ${Math.max(...simpleList)}`);

console.log('\n📄 Archivos generados:');
console.log('- lista-completa-reservaciones-sin-transacciones.csv');
console.log('- ids-reservaciones-sin-transacciones.txt');