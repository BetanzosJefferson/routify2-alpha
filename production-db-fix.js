import { neon } from '@neondatabase/serverless';

async function fixProductionDatabase() {
  try {
    console.log('🔗 Conectando a la base de datos de producción...');
    
    const sql = neon(process.env.PRODUCTION_DATABASE_URL);
    
    // Verificar conexión
    const version = await sql`SELECT version()`;
    console.log('✅ Conexión exitosa a PostgreSQL:', version[0].version.substring(0, 50) + '...');
    
    // Verificar tablas
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('\n📊 Tablas encontradas:');
    tables.forEach(table => console.log(`  - ${table.table_name}`));
    
    // Verificar estructura de invitations
    const invitationsStructure = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'invitations' 
      ORDER BY ordinal_position
    `;
    
    console.log('\n🔍 Estructura de tabla invitations:');
    invitationsStructure.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // Verificar si metadata es json o jsonb
    const metadataType = invitationsStructure.find(col => col.column_name === 'metadata');
    console.log(`\n📋 Tipo actual de metadata: ${metadataType?.data_type || 'no encontrado'}`);
    
    if (metadataType?.data_type === 'json') {
      console.log('🔧 Convirtiendo metadata de json a jsonb...');
      
      try {
        await sql`ALTER TABLE invitations ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb`;
        console.log('✅ Conversión exitosa: metadata ahora es jsonb');
      } catch (error) {
        console.error('❌ Error en conversión:', error.message);
      }
    } else {
      console.log('✅ metadata ya es jsonb o no existe');
    }
    
    // Verificar datos de invitations
    const invitations = await sql`
      SELECT id, role, email, metadata, created_at 
      FROM invitations 
      ORDER BY id
    `;
    
    console.log('\n📋 Invitaciones existentes:');
    invitations.forEach(inv => {
      console.log(`  ID: ${inv.id}, Role: ${inv.role}, Email: ${inv.email || 'NULL'}`);
      if (inv.metadata) {
        console.log(`      Metadata: ${JSON.stringify(inv.metadata)}`);
      }
    });
    
    // Verificar empresas
    const companies = await sql`
      SELECT id, name, identifier 
      FROM companies 
      ORDER BY id
    `;
    
    console.log('\n🏢 Empresas:');
    companies.forEach(comp => {
      console.log(`  - ${comp.name} (${comp.identifier})`);
    });
    
    // Contar registros importantes
    const counts = await sql`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM trips) as trips,
        (SELECT COUNT(*) FROM reservations) as reservations,
        (SELECT COUNT(*) FROM packages) as packages
    `;
    
    console.log('\n📊 Conteo de registros:');
    console.log(`  - Usuarios: ${counts[0].users}`);
    console.log(`  - Viajes: ${counts[0].trips}`);
    console.log(`  - Reservaciones: ${counts[0].reservations}`);
    console.log(`  - Paquetes: ${counts[0].packages}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

fixProductionDatabase();