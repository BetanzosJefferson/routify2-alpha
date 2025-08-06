import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Leer el reporte generado
const reportData = JSON.parse(fs.readFileSync('payment-integrity-report.json', 'utf-8'));
const reservationsData = fs.readFileSync(path.join(__dirname, 'attached_assets', 'reservations_rows_1754518127934.csv'), 'utf-8');

console.log('🔧 GENERADOR DE TRANSACCIONES FALTANTES');
console.log('=====================================\n');

// Parsear CSV de reservaciones
function parseCSV(content) {
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

const reservations = parseCSV(reservationsData);
const reservationMap = new Map();
reservations.forEach(res => {
  reservationMap.set(parseInt(res.id), res);
});

console.log(`Total de reservaciones encontradas: ${reservations.length}`);
console.log(`Reservaciones problemáticas: ${reportData.reservationIssues.length}\n`);

// Generar transacciones faltantes
const missingTransactions = [];
let transactionId = 10000; // ID inicial para evitar conflictos

reportData.reservationIssues
  .filter(issue => issue.issue === 'SIN_TRANSACCION')
  .forEach(issue => {
    const reservation = reservationMap.get(issue.id);
    if (!reservation) return;
    
    let tripDetails;
    try {
      tripDetails = JSON.parse(reservation.trip_details);
    } catch (e) {
      tripDetails = {};
    }
    
    // Generar nombres de pasajeros ficticios si no están disponibles
    const generatePassengerName = (seats) => {
      const names = [];
      for (let i = 0; i < seats; i++) {
        names.push(`Pasajero ${i + 1}`);
      }
      return names.join(', ');
    };
    
    const seats = tripDetails.seats || 1;
    const pasajeros = generatePassengerName(seats);
    
    // Crear transacción de anticipo si hay advance_amount
    if (reservation.advance_amount && parseFloat(reservation.advance_amount) > 0) {
      const advanceTransaction = {
        id: transactionId++,
        details: JSON.stringify({
          type: "reservation",
          details: {
            id: issue.id,
            monto: parseFloat(reservation.advance_amount),
            notas: reservation.notes || null,
            origen: tripDetails.origin || "No especificado",
            tripId: tripDetails.tripId || tripDetails.recordId,
            destino: tripDetails.destination || "No especificado",
            contacto: {
              email: reservation.email || null,
              telefono: reservation.phone || null
            },
            companyId: reservation.company_id,
            isSubTrip: typeof tripDetails.tripId === 'string' && tripDetails.tripId.includes('_'),
            pasajeros: pasajeros,
            metodoPago: reservation.advance_payment_method || "efectivo",
            dateCreated: reservation.created_at
          }
        }),
        user_id: reservation.created_by || null,
        cutoff_id: null,
        created_at: reservation.created_at,
        updated_at: reservation.created_at,
        company_id: reservation.company_id
      };
      missingTransactions.push(advanceTransaction);
    }
    
    // Crear transacción del pago final
    const remainingAmount = issue.amount - (parseFloat(reservation.advance_amount) || 0);
    if (remainingAmount > 0) {
      const finalTransaction = {
        id: transactionId++,
        details: JSON.stringify({
          type: "reservation",
          details: {
            id: issue.id,
            monto: remainingAmount,
            notas: `Pago final - Reservación #${issue.id}`,
            origen: tripDetails.origin || "No especificado",
            tripId: tripDetails.tripId || tripDetails.recordId,
            destino: tripDetails.destination || "No especificado",
            contacto: {
              email: reservation.email || null,
              telefono: reservation.phone || null
            },
            companyId: reservation.company_id,
            isSubTrip: typeof tripDetails.tripId === 'string' && tripDetails.tripId.includes('_'),
            pasajeros: pasajeros,
            metodoPago: reservation.payment_method || "efectivo"
          }
        }),
        user_id: reservation.paid_by || reservation.created_by || null,
        cutoff_id: null,
        created_at: reservation.marked_as_paid_at || reservation.updated_at,
        updated_at: reservation.marked_as_paid_at || reservation.updated_at,
        company_id: reservation.company_id
      };
      missingTransactions.push(finalTransaction);
    } else if (remainingAmount === 0 && (!reservation.advance_amount || parseFloat(reservation.advance_amount) === 0)) {
      // Pago completo de una vez
      const fullTransaction = {
        id: transactionId++,
        details: JSON.stringify({
          type: "reservation",
          details: {
            id: issue.id,
            monto: issue.amount,
            notas: reservation.notes || `Pago completo - Reservación #${issue.id}`,
            origen: tripDetails.origin || "No especificado",
            tripId: tripDetails.tripId || tripDetails.recordId,
            destino: tripDetails.destination || "No especificado",
            contacto: {
              email: reservation.email || null,
              telefono: reservation.phone || null
            },
            companyId: reservation.company_id,
            isSubTrip: typeof tripDetails.tripId === 'string' && tripDetails.tripId.includes('_'),
            pasajeros: pasajeros,
            metodoPago: reservation.payment_method || "efectivo",
            dateCreated: reservation.created_at
          }
        }),
        user_id: reservation.paid_by || reservation.created_by || null,
        cutoff_id: null,
        created_at: reservation.marked_as_paid_at || reservation.updated_at,
        updated_at: reservation.marked_as_paid_at || reservation.updated_at,
        company_id: reservation.company_id
      };
      missingTransactions.push(fullTransaction);
    }
  });

console.log(`🔧 Transacciones generadas: ${missingTransactions.length}`);

// Calcular totales
const totalAmount = missingTransactions.reduce((sum, t) => {
  const details = JSON.parse(t.details);
  return sum + details.details.monto;
}, 0);

console.log(`💰 Monto total a recuperar: $${totalAmount.toFixed(2)}`);

// Generar script SQL para insertar transacciones
const sqlInserts = missingTransactions.map(t => {
  return `INSERT INTO transactions (id, details, user_id, cutoff_id, created_at, updated_at, company_id) VALUES (${t.id}, '${t.details.replace(/'/g, "''")}', ${t.user_id || 'NULL'}, NULL, '${t.created_at}', '${t.updated_at}', '${t.company_id}');`;
}).join('\n');

// Guardar archivos
fs.writeFileSync('missing-transactions.json', JSON.stringify(missingTransactions, null, 2));
fs.writeFileSync('fix-transactions.sql', sqlInserts);

console.log('\n📄 Archivos generados:');
console.log('- missing-transactions.json: Transacciones en formato JSON');
console.log('- fix-transactions.sql: Script SQL para insertar las transacciones');

console.log('\n⚠️  INSTRUCCIONES PARA APLICAR LA CORRECCIÓN:');
console.log('1. Revisar el archivo fix-transactions.sql');
console.log('2. Hacer backup de la tabla transactions');
console.log('3. Ejecutar el script SQL en la base de datos de producción');
console.log('4. Verificar que se insertaron correctamente las transacciones');
console.log('5. Volver a ejecutar el análisis para confirmar la corrección');

console.log('\n🔒 PREVENCIÓN FUTURA:');
console.log('- Implementar validación obligatoria de transacciones al marcar como pagado');
console.log('- Agregar triggers en base de datos para evitar inconsistencias');
console.log('- Implementar auditoría de cambios en estados de pago');