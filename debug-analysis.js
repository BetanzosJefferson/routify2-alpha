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

console.log('🔍 DEBUG: VERIFICANDO LÓGICA DEL ANÁLISIS');
console.log('=========================================\n');

// Leer archivos
const reservationsPath = path.join(__dirname, 'attached_assets', 'reservations_rows_1754518127934.csv');
const transactionsPath = path.join(__dirname, 'attached_assets', 'transactions_rows_1754518175583.csv');

const reservations = readCSV(reservationsPath);
const transactions = readCSV(transactionsPath);

console.log(`Total reservaciones: ${reservations.length}`);
console.log(`Total transacciones: ${transactions.length}`);

// Vamos a revisar algunas reservaciones específicas que según mi análisis no tienen transacciones
const testReservationIds = [10, 26, 29, 30, 31, 32, 35, 37, 38, 42];

console.log('\n🧪 PRUEBA MANUAL - Revisando reservaciones específicas:');
console.log('======================================================');

testReservationIds.forEach(resId => {
  console.log(`\n📋 RESERVACIÓN #${resId}:`);
  
  // Encontrar la reservación
  const reservation = reservations.find(r => parseInt(r.id) === resId);
  if (reservation) {
    console.log(`   Status: ${reservation.status}`);
    console.log(`   Payment Status: ${reservation.payment_status}`);
    console.log(`   Amount: $${reservation.total_amount}`);
    console.log(`   Paid by: ${reservation.paid_by}`);
    console.log(`   Created by: ${reservation.created_by}`);
    console.log(`   Created at: ${reservation.created_at}`);
  } else {
    console.log('   ❌ Reservación no encontrada');
    return;
  }
  
  // Buscar transacciones relacionadas
  const relatedTransactions = transactions.filter(t => {
    const details = parseDetails(t.details);
    if (!details || details.type !== 'reservation') return false;
    
    // Diferentes formas de buscar la reservación en las transacciones
    if (details.details && details.details.id) {
      return details.details.id === resId || details.details.id === resId.toString();
    }
    
    return false;
  });
  
  console.log(`   🔄 Transacciones encontradas: ${relatedTransactions.length}`);
  
  if (relatedTransactions.length > 0) {
    relatedTransactions.forEach((t, index) => {
      const details = parseDetails(t.details);
      console.log(`      ${index + 1}. Transacción #${t.id}`);
      console.log(`         - Monto: $${details?.details?.monto || 'N/A'}`);
      console.log(`         - Usuario: ${t.user_id}`);
      console.log(`         - Fecha: ${t.created_at}`);
      console.log(`         - Detalles: ${details?.details?.notas || 'Sin notas'}`);
    });
    
    const totalTransactionAmount = relatedTransactions.reduce((sum, t) => {
      const details = parseDetails(t.details);
      return sum + (parseFloat(details?.details?.monto) || 0);
    }, 0);
    
    console.log(`   💰 Total en transacciones: $${totalTransactionAmount}`);
    console.log(`   💰 Monto reservación: $${reservation.total_amount}`);
    
    if (Math.abs(totalTransactionAmount - parseFloat(reservation.total_amount)) < 0.01) {
      console.log('   ✅ Los montos coinciden');
    } else {
      console.log('   ⚠️  Los montos NO coinciden');
    }
  } else {
    console.log('   ❌ No se encontraron transacciones');
  }
});

// Ahora vamos a verificar mi lógica de búsqueda más en detalle
console.log('\n🔍 ANÁLISIS DETALLADO DE TRANSACCIONES:');
console.log('======================================');

// Mostrar algunas transacciones para entender la estructura
console.log('\nPrimeras 10 transacciones de tipo "reservation":');
const reservationTransactions = transactions
  .filter(t => {
    const details = parseDetails(t.details);
    return details && details.type === 'reservation';
  })
  .slice(0, 10);

reservationTransactions.forEach((t, index) => {
  const details = parseDetails(t.details);
  console.log(`${index + 1}. Transacción #${t.id}`);
  console.log(`   - Reservación ID: ${details?.details?.id}`);
  console.log(`   - Tipo de ID: ${typeof details?.details?.id}`);
  console.log(`   - Monto: $${details?.details?.monto}`);
  console.log(`   - Usuario: ${t.user_id}`);
  console.log(`   - Fecha: ${t.created_at}`);
});

// Verificar si hay algún problema con el parseo de tipos
console.log('\n🔬 VERIFICANDO TIPOS DE DATOS:');
console.log('==============================');

const sampleReservations = reservations.slice(0, 10);
sampleReservations.forEach(r => {
  console.log(`Reservación #${r.id} - Tipo: ${typeof r.id} - Payment Status: ${r.payment_status}`);
});

console.log('\n📊 ESTADÍSTICAS DE PAYMENT STATUS:');
const statusCounts = {};
reservations.forEach(r => {
  const status = r.payment_status || 'undefined';
  statusCounts[status] = (statusCounts[status] || 0) + 1;
});

Object.entries(statusCounts).forEach(([status, count]) => {
  console.log(`${status}: ${count} reservaciones`);
});