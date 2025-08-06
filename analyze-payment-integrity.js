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

// Función para parsear detalles JSON
function parseDetails(detailsStr) {
  try {
    return JSON.parse(detailsStr);
  } catch (e) {
    return null;
  }
}

console.log('🔍 ANÁLISIS DE INTEGRIDAD DE PAGOS - DATOS DE PRODUCCIÓN');
console.log('======================================================\n');

// Leer archivos CSV
const packagesPath = path.join(__dirname, 'attached_assets', 'packages_rows (1)_1754518125761.csv');
const reservationsPath = path.join(__dirname, 'attached_assets', 'reservations_rows_1754518127934.csv');
const transactionsPath = path.join(__dirname, 'attached_assets', 'transactions_rows_1754518175583.csv');

console.log('📁 Leyendo archivos CSV...');
const packages = readCSV(packagesPath);
const reservations = readCSV(reservationsPath);
const transactions = readCSV(transactionsPath);

console.log(`✅ Paquetes: ${packages.length}`);
console.log(`✅ Reservaciones: ${reservations.length}`);
console.log(`✅ Transacciones: ${transactions.length}\n`);

// Analizar paquetes pagados
console.log('📦 ANÁLISIS DE PAQUETES PAGADOS');
console.log('===============================');

const paidPackages = packages.filter(pkg => pkg.is_paid === 'true' || pkg.is_paid === true);
console.log(`Total de paquetes pagados: ${paidPackages.length}`);

// Extraer transacciones de paquetes
const packageTransactions = transactions.filter(t => {
  const details = parseDetails(t.details);
  return details && details.type === 'package';
});

console.log(`Transacciones de paquetes encontradas: ${packageTransactions.length}`);

// Verificar integridad de paquetes
const packageIssues = [];
const packageTransactionMap = new Map();

packageTransactions.forEach(t => {
  const details = parseDetails(t.details);
  if (details && details.details && details.details.id) {
    packageTransactionMap.set(details.details.id, t);
  }
});

paidPackages.forEach(pkg => {
  const packageId = parseInt(pkg.id);
  const hasTransaction = packageTransactionMap.has(packageId);
  
  if (!hasTransaction) {
    packageIssues.push({
      id: packageId,
      price: pkg.price,
      paidBy: pkg.paid_by,
      createdAt: pkg.created_at,
      description: pkg.package_description,
      sender: `${pkg.sender_name} ${pkg.sender_lastname}`,
      recipient: `${pkg.recipient_name} ${pkg.recipient_lastname}`
    });
  }
});

console.log(`\n❌ Paquetes pagados SIN transacción: ${packageIssues.length}`);
if (packageIssues.length > 0) {
  console.log('\nDetalle de paquetes problemáticos:');
  packageIssues.forEach((issue, index) => {
    console.log(`${index + 1}. Paquete #${issue.id}`);
    console.log(`   - Precio: $${issue.price}`);
    console.log(`   - Pagado por usuario: ${issue.paidBy}`);
    console.log(`   - Descripción: ${issue.description}`);
    console.log(`   - Remitente: ${issue.sender}`);
    console.log(`   - Destinatario: ${issue.recipient}`);
    console.log(`   - Fecha: ${issue.createdAt}\n`);
  });
}

// Analizar reservaciones pagadas
console.log('\n🎫 ANÁLISIS DE RESERVACIONES PAGADAS');
console.log('====================================');

const paidReservations = reservations.filter(res => 
  res.payment_status === 'pagado' || res.payment_status === 'paid'
);
console.log(`Total de reservaciones pagadas: ${paidReservations.length}`);

// Extraer transacciones de reservaciones
const reservationTransactions = transactions.filter(t => {
  const details = parseDetails(t.details);
  return details && details.type === 'reservation';
});

console.log(`Transacciones de reservaciones encontradas: ${reservationTransactions.length}`);

// Verificar integridad de reservaciones
const reservationIssues = [];
const reservationTransactionMap = new Map();

// Crear mapa de transacciones por reservation ID
reservationTransactions.forEach(t => {
  const details = parseDetails(t.details);
  if (details && details.details && details.details.id) {
    const reservationId = details.details.id;
    if (!reservationTransactionMap.has(reservationId)) {
      reservationTransactionMap.set(reservationId, []);
    }
    reservationTransactionMap.get(reservationId).push(t);
  }
});

paidReservations.forEach(res => {
  const reservationId = parseInt(res.id);
  const transactions = reservationTransactionMap.get(reservationId) || [];
  
  // Calcular total de transacciones
  const totalTransactionAmount = transactions.reduce((sum, t) => {
    const details = parseDetails(t.details);
    return sum + (details?.details?.monto || 0);
  }, 0);
  
  const reservationAmount = parseFloat(res.total_amount) || 0;
  
  // Verificar si no hay transacciones o si los montos no coinciden
  if (transactions.length === 0) {
    reservationIssues.push({
      id: reservationId,
      amount: reservationAmount,
      paidBy: res.paid_by,
      createdAt: res.created_at,
      phone: res.phone,
      issue: 'SIN_TRANSACCION',
      transactionAmount: 0,
      transactionCount: 0
    });
  } else if (Math.abs(totalTransactionAmount - reservationAmount) > 0.01) {
    reservationIssues.push({
      id: reservationId,
      amount: reservationAmount,
      paidBy: res.paid_by,
      createdAt: res.created_at,
      phone: res.phone,
      issue: 'MONTO_DIFERENTE',
      transactionAmount: totalTransactionAmount,
      transactionCount: transactions.length
    });
  }
});

console.log(`\n❌ Reservaciones pagadas con problemas: ${reservationIssues.length}`);

if (reservationIssues.length > 0) {
  console.log('\nDetalle de reservaciones problemáticas:');
  
  const sinTransaccion = reservationIssues.filter(r => r.issue === 'SIN_TRANSACCION');
  const montoDiferente = reservationIssues.filter(r => r.issue === 'MONTO_DIFERENTE');
  
  console.log(`\n🚨 Reservaciones SIN transacciones: ${sinTransaccion.length}`);
  sinTransaccion.forEach((issue, index) => {
    console.log(`${index + 1}. Reservación #${issue.id}`);
    console.log(`   - Monto: $${issue.amount}`);
    console.log(`   - Pagado por usuario: ${issue.paidBy}`);
    console.log(`   - Teléfono: ${issue.phone}`);
    console.log(`   - Fecha: ${issue.createdAt}\n`);
  });
  
  console.log(`\n⚠️  Reservaciones con montos diferentes: ${montoDiferente.length}`);
  montoDiferente.forEach((issue, index) => {
    console.log(`${index + 1}. Reservación #${issue.id}`);
    console.log(`   - Monto reservación: $${issue.amount}`);
    console.log(`   - Monto transacciones: $${issue.transactionAmount}`);
    console.log(`   - Diferencia: $${Math.abs(issue.amount - issue.transactionAmount)}`);
    console.log(`   - Número de transacciones: ${issue.transactionCount}`);
    console.log(`   - Pagado por usuario: ${issue.paidBy}`);
    console.log(`   - Teléfono: ${issue.phone}`);
    console.log(`   - Fecha: ${issue.createdAt}\n`);
  });
}

// Resumen final
console.log('\n📊 RESUMEN EJECUTIVO');
console.log('===================');
console.log(`Total de paquetes pagados: ${paidPackages.length}`);
console.log(`Paquetes pagados SIN transacción: ${packageIssues.length}`);
console.log(`Porcentaje de integridad paquetes: ${((paidPackages.length - packageIssues.length) / paidPackages.length * 100).toFixed(2)}%`);

console.log(`\nTotal de reservaciones pagadas: ${paidReservations.length}`);
console.log(`Reservaciones pagadas con problemas: ${reservationIssues.length}`);
console.log(`Porcentaje de integridad reservaciones: ${((paidReservations.length - reservationIssues.length) / paidReservations.length * 100).toFixed(2)}%`);

const totalIssues = packageIssues.length + reservationIssues.length;
const totalPaidItems = paidPackages.length + paidReservations.length;

console.log(`\n🎯 INTEGRIDAD GENERAL: ${((totalPaidItems - totalIssues) / totalPaidItems * 100).toFixed(2)}%`);

if (totalIssues > 0) {
  console.log(`\n❗ ACCIÓN REQUERIDA:`);
  console.log(`Se encontraron ${totalIssues} elementos pagados sin transacciones correspondientes.`);
  console.log(`Esto indica posible abuso del sistema o errores en el proceso de pago.`);
  
  // Calcular monto total en riesgo
  const packageRiskAmount = packageIssues.reduce((sum, issue) => sum + parseFloat(issue.price), 0);
  const reservationRiskAmount = reservationIssues.reduce((sum, issue) => sum + parseFloat(issue.amount), 0);
  const totalRiskAmount = packageRiskAmount + reservationRiskAmount;
  
  console.log(`💰 Monto total en riesgo: $${totalRiskAmount.toFixed(2)}`);
  console.log(`   - Paquetes: $${packageRiskAmount.toFixed(2)}`);
  console.log(`   - Reservaciones: $${reservationRiskAmount.toFixed(2)}`);
}

// Generar archivo de reporte
const reportData = {
  timestamp: new Date().toISOString(),
  summary: {
    totalPaidPackages: paidPackages.length,
    packageIssues: packageIssues.length,
    totalPaidReservations: paidReservations.length,
    reservationIssues: reservationIssues.length,
    totalIssues: totalIssues,
    integrityPercentage: ((totalPaidItems - totalIssues) / totalPaidItems * 100)
  },
  packageIssues,
  reservationIssues: reservationIssues.map(issue => ({
    ...issue,
    issueType: issue.issue
  }))
};

fs.writeFileSync('payment-integrity-report.json', JSON.stringify(reportData, null, 2));
console.log(`\n📄 Reporte detallado guardado en: payment-integrity-report.json`);