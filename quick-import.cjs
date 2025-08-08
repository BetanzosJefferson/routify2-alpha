#!/usr/bin/env node

const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

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

async function importData() {
  console.log('📦 Importando datos básicos...');
  
  // Companies
  await pool.query(`
    INSERT INTO companies (id, name, identifier, logo, created_at, updated_at, created_by)
    VALUES (1, 'BAMO', 'bamo-373009', '', '2025-07-05 19:35:37', '2025-07-05 19:35:37', null)
    ON CONFLICT (id) DO NOTHING;
  `);
  
  // Users  
  await pool.query(`
    INSERT INTO users (id, first_name, last_name, email, password, role, company, profile_picture, created_at, updated_at, invited_by_id, company_id, commission_percentage, commission_enabled, cash_box_enabled)
    VALUES 
    (1, 'Admin', 'Principal', 'admin@transporte.com', '$2b$10$7bfot4A5x1HgSDElxHbwH.RmUfXmJCvWsW9TvWyVE0b0vSG3WOADO', 'superAdmin', '', '', '2025-07-05 19:35:37', '2025-07-05 19:35:37', null, '', 0, false, false),
    (2, 'William', 'Bahena', 'bahenawilliamjefferson@gmail.com', '$2b$10$7bfot4A5x1HgSDElxHbwH.RmUfXmJCvWsW9TvWyVE0b0vSG3WOADO', 'superAdmin', '', '', '2025-07-05 13:37:37', '2025-07-05 13:37:40', null, '', 0, false, false),
    (3, 'Ivan', 'Bahena', 'ivanbahenabetanzos@gmail.com', '$2b$10$7bfot4A5x1HgSDElxHbwH.RmUfXmJCvWsW9TvWyVE0b0vSG3WOADO', 'dueño', 'BAMO', '', '2025-07-05 13:37:37', '2025-07-05 13:37:40', null, 'bamo-373009', 0, false, false)
    ON CONFLICT (id) DO NOTHING;
  `);
  
  // Routes
  await pool.query(`
    INSERT INTO routes (id, name, origin, stops, destination, company_id)
    VALUES 
    (3, 'Acapulco de Juarez - Taxqueña', 'Acapulco de Juarez, Guerrero - Terminal condesa', 
     ARRAY['Acapulco de Juarez, Guerrero - Gas de la giovanna (Renacimiento)', 'Acapulco de Juarez, Guerrero - Plaza Caracol', 'Acapulco de Juarez, Guerrero - Gas de la venta'],
     'Coyoacan, Ciudad de Mexico - Taxqueña', 'bamo-373009'),
    (4, 'México - Acapulco', 'Coyoacan, Ciudad de Mexico - Taxqueña',
     ARRAY['Tlalpan, Ciudad de Mexico - San Pedro Martir', 'Tlalpan, Ciudad de Mexico - Colegio Militar (Puente vehicular)', 'Tlalpan, Ciudad de Mexico - Caseta de Tlalpan'],
     'Acapulco de Juarez, Guerrero - Terminal condesa', 'bamo-373009')
    ON CONFLICT (id) DO NOTHING;
  `);
  
  console.log('✅ Datos básicos importados');
}

async function main() {
  console.log('🚀 Iniciando importación rápida...\n');
  
  try {
    await clearDatabase();
    console.log('');
    await importData();
    console.log('\n🎉 ¡Importación completada!');
    
  } catch (error) {
    console.error('💥 Error:', error.message);
  } finally {
    await pool.end();
  }
}

main();