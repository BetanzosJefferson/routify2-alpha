#!/usr/bin/env node

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result.map(field => field.replace(/^"|"$/g, ''));
}

function parseCSV(content) {
  const lines = content.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];
  
  const headers = parseCSVLine(lines[0]);
  const rows = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        const value = values[index];
        row[header] = value === '' || value === 'null' ? null : value;
      });
      rows.push(row);
    }
  }
  
  return rows;
}

async function clearDatabase() {
  console.log('🗑️  Limpiando base de datos...');
  
  const tables = [
    'notifications', 'reservation_requests', 'transactions', 'trip_expenses',
    'trip_budgets', 'box_cutoff', 'coupons', 'packages', 'passengers',
    'reservations', 'trips', 'route_templates', 'routes', 'user_companies',
    'invitations', 'users', 'companies'
  ];

  for (const table of tables) {
    try {
      await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`   ✅ Tabla ${table} limpiada`);
    } catch (error) {
      console.log(`   ⚠️  Tabla ${table}: ${error.message}`);
    }
  }
}

async function importCSVFile(filePath, tableName, transform = null) {
  try {
    console.log(`📥 Importando ${tableName}...`);
    
    if (!fs.existsSync(filePath)) {
      console.log(`   ❌ Archivo no encontrado: ${filePath}`);
      return;
    }
    
    const content = fs.readFileSync(filePath, 'utf8');
    const rows = parseCSV(content);
    
    if (rows.length === 0) {
      console.log(`   ⚠️  Sin datos en ${filePath}`);
      return;
    }
    
    let insertedCount = 0;
    
    for (const row of rows) {
      try {
        const transformedRow = transform ? transform(row) : row;
        if (!transformedRow) continue;
        
        const columns = Object.keys(transformedRow);
        const values = Object.values(transformedRow);
        const placeholders = values.map((_, i) => `$${i + 1}`).join(',');
        
        const query = `
          INSERT INTO ${tableName} (${columns.join(',')})
          VALUES (${placeholders})
          ON CONFLICT DO NOTHING
        `;
        
        await pool.query(query, values);
        insertedCount++;
      } catch (error) {
        console.log(`   ⚠️  Error insertando fila: ${error.message}`);
      }
    }
    
    console.log(`   ✅ ${tableName}: ${insertedCount} registros importados de ${rows.length} total`);
    
  } catch (error) {
    console.log(`   ❌ Error importando ${tableName}: ${error.message}`);
  }
}

function transformCompany(row) {
  return {
    id: parseInt(row.id),
    name: row.name,
    identifier: row.identifier,
    logo: row.logo || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    created_by: row.created_by === 'null' ? null : parseInt(row.created_by)
  };
}

function transformUser(row) {
  return {
    id: parseInt(row.id),
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    password: row.password,
    role: row.role,
    company: row.company || '',
    profile_picture: row.profile_picture || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    invited_by_id: row.invited_by_id === 'null' ? null : parseInt(row.invited_by_id),
    company_id: row.company_id || '',
    commission_percentage: parseFloat(row.commission_percentage) || 0,
    commission_enabled: row.commission_enabled === 'true',
    cash_box_enabled: row.cash_box_enabled === 'true'
  };
}

function transformRoute(row) {
  let stops = [];
  try {
    if (row.stops && row.stops !== 'null') {
      stops = JSON.parse(row.stops);
    }
  } catch (e) {
    console.log(`   ⚠️  Error parseando stops: ${row.stops}`);
  }
  
  return {
    id: parseInt(row.id),
    name: row.name,
    origin: row.origin,
    stops: stops,
    destination: row.destination,
    company_id: row.company_id
  };
}

function transformTrip(row) {
  let segments = [];
  let stop_times = [];
  
  try {
    if (row.segments && row.segments !== 'null') {
      segments = JSON.parse(row.segments);
    }
    if (row.stop_times && row.stop_times !== 'null') {
      stop_times = JSON.parse(row.stop_times);
    }
  } catch (e) {
    console.log(`   ⚠️  Error parseando segments o stop_times para trip ${row.id}`);
  }
  
  return {
    id: parseInt(row.id),
    name: row.name || '',
    route_id: row.route_id ? parseInt(row.route_id) : null,
    route_template_id: row.route_template_id ? parseInt(row.route_template_id) : null,
    departure_time: row.departure_time,
    arrival_time: row.arrival_time,
    departure_date: row.departure_date,
    duration: row.duration ? parseFloat(row.duration) : null,
    price: row.price ? parseFloat(row.price) : null,
    capacity: row.capacity ? parseInt(row.capacity) : null,
    available_seats: row.available_seats ? parseInt(row.available_seats) : null,
    vehicle: row.vehicle || '',
    driver: row.driver || '',
    operator: row.operator || '',
    segments: segments,
    stop_times: stop_times,
    status: row.status || 'activo',
    created_at: row.created_at,
    updated_at: row.updated_at,
    company_id: row.company_id
  };
}

function transformReservation(row) {
  return {
    id: parseInt(row.id),
    trip_id: row.trip_id ? parseInt(row.trip_id) : null,
    record_id: row.record_id || null,
    passenger_name: row.passenger_name,
    passenger_phone: row.passenger_phone,
    passenger_email: row.passenger_email || '',
    seat_number: row.seat_number || '',
    origin: row.origin || '',
    destination: row.destination || '',
    boarding_time: row.boarding_time || null,
    price: row.price ? parseFloat(row.price) : null,
    status: row.status || 'pendiente',
    created_at: row.created_at,
    updated_at: row.updated_at,
    company_id: row.company_id,
    created_by: row.created_by ? parseInt(row.created_by) : null,
    payment_method: row.payment_method || '',
    coupon_applied: row.coupon_applied === 'true',
    coupon_code: row.coupon_code || null,
    discount_amount: row.discount_amount ? parseFloat(row.discount_amount) : null,
    final_price: row.final_price ? parseFloat(row.final_price) : null
  };
}

function transformTransaction(row) {
  return {
    id: parseInt(row.id),
    reservation_id: row.reservation_id ? parseInt(row.reservation_id) : null,
    amount: row.amount ? parseFloat(row.amount) : null,
    type: row.type || 'payment',
    payment_method: row.payment_method || '',
    status: row.status || 'completed',
    description: row.description || '',
    created_at: row.created_at,
    updated_at: row.updated_at,
    company_id: row.company_id,
    created_by: row.created_by ? parseInt(row.created_by) : null
  };
}

async function main() {
  console.log('🚀 Iniciando importación completa de datos CSV...\n');
  
  try {
    await clearDatabase();
    console.log('');
    
    // Importar en orden de dependencias
    await importCSVFile('attached_assets/companies_rows_1754636884879.csv', 'companies', transformCompany);
    await importCSVFile('attached_assets/users_rows_1754637238983.csv', 'users', transformUser);
    await importCSVFile('attached_assets/routes_rows_1754637024914.csv', 'routes', transformRoute);
    await importCSVFile('attached_assets/route_templates_rows_1754637016080.csv', 'route_templates');
    await importCSVFile('attached_assets/trips_rows_1754637216119.csv', 'trips', transformTrip);
    await importCSVFile('attached_assets/reservations_rows (1)_1754637001917.csv', 'reservations', transformReservation);
    await importCSVFile('attached_assets/transactions_rows (1)_1754637044268.csv', 'transactions', transformTransaction);
    await importCSVFile('attached_assets/passengers_rows_1754636978728.csv', 'passengers');
    await importCSVFile('attached_assets/packages_rows (2)_1754636963234.csv', 'packages');
    await importCSVFile('attached_assets/user_companies_rows_1754637227790.csv', 'user_companies');
    await importCSVFile('attached_assets/trip_budgets_rows_1754637163998.csv', 'trip_budgets');
    await importCSVFile('attached_assets/trip_expenses_rows_1754637171909.csv', 'trip_expenses');
    await importCSVFile('attached_assets/box_cutoff_rows_1754636848160.csv', 'box_cutoff');
    await importCSVFile('attached_assets/coupons_rows_1754636913651.csv', 'coupons');
    await importCSVFile('attached_assets/invitations_rows_1754636930921.csv', 'invitations');
    await importCSVFile('attached_assets/notifications_rows_1754636951292.csv', 'notifications');
    await importCSVFile('attached_assets/reservation_requests_rows_1754636985452.csv', 'reservation_requests');
    
    console.log('\n🎉 ¡Importación completa finalizada!');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();