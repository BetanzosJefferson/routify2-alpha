import { Client } from 'pg';

async function checkProductionDatabase() {
  const client = new Client({
    connectionString: process.env.PRODUCTION_DATABASE_URL,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('🟢 Conexión a base de datos de producción exitosa');
    
    // Verificar tablas existentes
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);
    
    console.log('\n📊 Tablas en la base de datos de producción:');
    tablesResult.rows.forEach(row => {
      console.log(`  - ${row.table_name}`);
    });
    
    // Verificar estructura de invitations
    const invitationsStructure = await client.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'invitations' 
      ORDER BY ordinal_position;
    `);
    
    console.log('\n🔍 Estructura de la tabla invitations:');
    invitationsStructure.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type} (${row.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Verificar datos de invitations
    const invitationsData = await client.query(`
      SELECT id, role, email, metadata, created_at 
      FROM invitations 
      ORDER BY id;
    `);
    
    console.log('\n📋 Datos de invitations:');
    invitationsData.rows.forEach(row => {
      console.log(`  ID: ${row.id}, Role: ${row.role}, Email: ${row.email || 'NULL'}, Metadata: ${row.metadata || 'NULL'}`);
    });
    
    // Verificar empresas
    const companiesData = await client.query(`
      SELECT id, name, identifier, created_at 
      FROM companies 
      ORDER BY id;
    `);
    
    console.log('\n🏢 Empresas:');
    companiesData.rows.forEach(row => {
      console.log(`  - ${row.name} (${row.identifier})`);
    });
    
    // Verificar usuarios
    const usersCount = await client.query('SELECT COUNT(*) as count FROM users');
    console.log(`\n👥 Total de usuarios: ${usersCount.rows[0].count}`);
    
    // Verificar reservaciones
    const reservationsCount = await client.query('SELECT COUNT(*) as count FROM reservations');
    console.log(`📝 Total de reservaciones: ${reservationsCount.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error conectando a la base de datos de producción:', error.message);
  } finally {
    await client.end();
  }
}

checkProductionDatabase();