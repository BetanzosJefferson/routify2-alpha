#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');
const { drizzle } = require('drizzle-orm/node-postgres');

// Función simple para parsear CSV
function parseCSV(csvText) {
  const lines = csvText.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.replace(/"/g, ''));
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line.trim()) continue;
    
    const values = [];
    let current = '';
    let inQuotes = false;
    
    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        values.push(current.replace(/"/g, ''));
        current = '';
      } else {
        current += char;
      }
    }
    values.push(current.replace(/"/g, ''));
    
    const row = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || null;
    });
    data.push(row);
  }
  
  return data;
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool);

// Mapeo de archivos CSV a tablas
const CSV_TABLE_MAPPING = {
  'companies_rows_1754636884879.csv': {
    table: companies,
    name: 'companies'
  },
  'users_rows_1754637238983.csv': {
    table: users,
    name: 'users'
  },
  'routes_rows_1754637024914.csv': {
    table: routes,
    name: 'routes'
  },
  'route_templates_rows_1754637016080.csv': {
    table: routeTemplates,
    name: 'route_templates'
  },
  'trips_rows_1754637216119.csv': {
    table: trips,
    name: 'trips'
  },
  'transactions_rows (1)_1754637044268.csv': {
    table: transacciones,
    name: 'transactions'
  },
  'trip_budgets_rows_1754637163998.csv': {
    table: tripBudgets,
    name: 'trip_budgets'
  },
  'trip_expenses_rows_1754637171909.csv': {
    table: tripExpenses,
    name: 'trip_expenses'
  },
  'user_companies_rows_1754637227790.csv': {
    table: userCompanies,
    name: 'user_companies'
  },
  'box_cutoff_rows_1754636848160.csv': {
    table: boxCutoff,
    name: 'box_cutoff'
  },
  'coupons_rows_1754636913651.csv': {
    table: coupons,
    name: 'coupons'
  }
};

function parseCSVValue(value, columnName) {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  // Handle arrays (stops in routes)
  if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
    try {
      // Parse JSON arrays
      return JSON.parse(value);
    } catch (e) {
      console.warn(`Failed to parse JSON array for ${columnName}:`, value);
      return null;
    }
  }

  // Handle JSON objects
  if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.warn(`Failed to parse JSON for ${columnName}:`, value);
      return value;
    }
  }

  // Handle timestamps
  if (columnName.includes('at') || columnName.includes('_at') || columnName === 'expires_at' || columnName === 'fecha_inicio' || columnName === 'fecha_fin') {
    if (value && value !== 'null') {
      return new Date(value);
    }
    return null;
  }

  // Handle booleans
  if (value === 'true' || value === 'false') {
    return value === 'true';
  }

  // Handle numbers
  if (columnName.includes('id') || columnName.includes('amount') || columnName.includes('price') || 
      columnName.includes('capacity') || columnName.includes('percentage') || columnName.includes('quantity') ||
      columnName.includes('count') || columnName.includes('limit') || columnName.includes('hours')) {
    if (value && value !== 'null') {
      const num = parseFloat(value);
      return isNaN(num) ? value : num;
    }
    return null;
  }

  return value;
}

function transformRecord(record, tableName) {
  const transformed = {};
  
  for (const [key, value] of Object.entries(record)) {
    // Convertir nombres de columnas si es necesario
    let columnName = key;
    
    // Transformaciones específicas por tabla
    if (tableName === 'transactions') {
      // La tabla transactions usa nombres específicos
      if (key === 'user_id') columnName = 'user_id';
      if (key === 'cutoff_id') columnName = 'cutoff_id';
      if (key === 'created_at') columnName = 'createdAt';
      if (key === 'updated_at') columnName = 'updatedAt';
      if (key === 'company_id') columnName = 'companyId';
    } else {
      // Para otras tablas, usar camelCase estándar
      if (key === 'created_at') columnName = 'createdAt';
      if (key === 'updated_at') columnName = 'updatedAt';
      if (key === 'company_id') columnName = 'companyId';
      if (key === 'user_id') columnName = 'userId';
      if (key === 'route_id') columnName = 'routeId';
      if (key === 'trip_id') columnName = 'tripId';
      if (key === 'vehicle_id') columnName = 'vehicleId';
      if (key === 'driver_id') columnName = 'driverId';
      if (key === 'invited_by_id') columnName = 'invitedById';
      if (key === 'first_name') columnName = 'firstName';
      if (key === 'last_name') columnName = 'lastName';
      if (key === 'profile_picture') columnName = 'profilePicture';
      if (key === 'commission_percentage') columnName = 'commissionPercentage';
      if (key === 'commission_enabled') columnName = 'commissionEnabled';
      if (key === 'cash_box_enabled') columnName = 'cashBoxEnabled';
    }
    
    transformed[columnName] = parseCSVValue(value, columnName);
  }
  
  return transformed;
}

async function importCSVFile(filename, tableConfig) {
  const filePath = path.join('./attached_assets', filename);
  
  console.log(`🔄 Importando ${filename} a tabla ${tableConfig.name}...`);
  
  try {
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });

    console.log(`   📊 Encontrados ${records.length} registros`);

    if (records.length === 0) {
      console.log(`   ⚠️  No hay datos para importar en ${filename}`);
      return;
    }

    // Transformar registros
    const transformedRecords = records.map(record => 
      transformRecord(record, tableConfig.name)
    );

    // Dividir en lotes para evitar problemas de memoria
    const BATCH_SIZE = 100;
    let importedCount = 0;

    for (let i = 0; i < transformedRecords.length; i += BATCH_SIZE) {
      const batch = transformedRecords.slice(i, i + BATCH_SIZE);
      
      try {
        await db.insert(tableConfig.table).values(batch).onConflictDoNothing();
        importedCount += batch.length;
        console.log(`   ✅ Lote ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} registros insertados`);
      } catch (error) {
        console.error(`   ❌ Error insertando lote ${Math.floor(i / BATCH_SIZE) + 1}:`, error.message);
        
        // Intentar insertar registro por registro en caso de error
        for (const record of batch) {
          try {
            await db.insert(tableConfig.table).values(record).onConflictDoNothing();
            importedCount++;
          } catch (recordError) {
            console.error(`   ⚠️  Error insertando registro individual:`, recordError.message);
            console.error(`   🔍 Registro problemático:`, JSON.stringify(record, null, 2));
          }
        }
      }
    }

    console.log(`   ✅ ${tableConfig.name}: ${importedCount}/${records.length} registros importados exitosamente`);

  } catch (error) {
    console.error(`   ❌ Error procesando ${filename}:`, error.message);
  }
}

async function clearDatabase() {
  console.log('🗑️  Limpiando base de datos de desarrollo...');
  
  const tables = [
    'notifications',
    'reservation_requests', 
    'transactions',
    'trip_expenses',
    'trip_budgets',
    'box_cutoff',
    'coupons',
    'packages',
    'passengers',
    'reservations',
    'trips',
    'route_templates',
    'routes',
    'user_companies',
    'invitations',
    'users',
    'companies',
    'vehicles',
    'commissions',
    'location_data',
    'session'
  ];

  for (const table of tables) {
    try {
      await pool.query(`TRUNCATE TABLE ${table} CASCADE`);
      console.log(`   ✅ Tabla ${table} limpiada`);
    } catch (error) {
      console.log(`   ⚠️  Tabla ${table} no existe o ya está vacía`);
    }
  }
}

async function main() {
  console.log('🚀 Iniciando importación de datos de producción...\n');

  try {
    // Limpiar base de datos
    await clearDatabase();
    console.log('');

    // Importar datos en orden de dependencias
    const importOrder = [
      'companies_rows_1754636884879.csv',
      'users_rows_1754637238983.csv', 
      'user_companies_rows_1754637227790.csv',
      'routes_rows_1754637024914.csv',
      'route_templates_rows_1754637016080.csv',
      'trips_rows_1754637216119.csv',
      'trip_budgets_rows_1754637163998.csv',
      'trip_expenses_rows_1754637171909.csv',
      'box_cutoff_rows_1754636848160.csv',
      'transactions_rows (1)_1754637044268.csv',
      'coupons_rows_1754636913651.csv'
    ];

    for (const filename of importOrder) {
      const tableConfig = CSV_TABLE_MAPPING[filename];
      if (tableConfig) {
        await importCSVFile(filename, tableConfig);
        console.log('');
      } else {
        console.log(`⚠️  No se encontró configuración para ${filename}`);
      }
    }

    console.log('🎉 ¡Importación completada exitosamente!');
    
  } catch (error) {
    console.error('💥 Error durante la importación:', error);
  } finally {
    await pool.end();
  }
}

// Ejecutar el script
main();