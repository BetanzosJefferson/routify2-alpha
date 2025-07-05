// Script para ejecutar en tu servidor de producción
// Uso: node production-server-fix.js

const { neon } = require('@neondatabase/serverless');

async function fixProductionDatabase() {
  try {
    // Usar la URL de tu base de datos de producción
    const DATABASE_URL = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
    
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada. Asegúrate de que la variable de entorno esté definida.');
    }
    
    console.log('🔗 Conectando a la base de datos de producción...');
    const sql = neon(DATABASE_URL);
    
    // Verificar conexión
    const version = await sql`SELECT version()`;
    console.log('✅ Conexión exitosa a PostgreSQL');
    
    // 1. Verificar estructura de invitations
    console.log('\n🔍 Verificando estructura de tabla invitations...');
    const invitationsStructure = await sql`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'invitations' 
      ORDER BY ordinal_position
    `;
    
    invitationsStructure.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} (${col.is_nullable === 'YES' ? 'nullable' : 'not null'})`);
    });
    
    // 2. Verificar tipo de metadata
    const metadataType = invitationsStructure.find(col => col.column_name === 'metadata');
    console.log(`\n📋 Tipo actual de metadata: ${metadataType?.data_type || 'no encontrado'}`);
    
    // 3. Convertir metadata si es necesario
    if (metadataType?.data_type === 'json') {
      console.log('🔧 Convirtiendo metadata de json a jsonb...');
      
      try {
        await sql`ALTER TABLE invitations ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb`;
        console.log('✅ Conversión exitosa: metadata ahora es jsonb');
      } catch (error) {
        console.error('❌ Error en conversión:', error.message);
        
        // Intentar diagnóstico de datos corruptos
        console.log('🔍 Diagnosticando datos corruptos...');
        const corruptData = await sql`
          SELECT id, metadata::text as metadata_text
          FROM invitations 
          WHERE metadata IS NOT NULL
        `;
        
        corruptData.forEach(row => {
          console.log(`  ID ${row.id}: ${row.metadata_text}`);
        });
      }
    } else {
      console.log('✅ metadata ya es jsonb o no existe');
    }
    
    // 4. Verificar otras columnas JSON
    console.log('\n🔍 Verificando otras columnas JSON...');
    const jsonColumns = await sql`
      SELECT table_name, column_name, data_type 
      FROM information_schema.columns 
      WHERE data_type = 'json' AND table_schema = 'public' 
      ORDER BY table_name, column_name
    `;
    
    if (jsonColumns.length > 0) {
      console.log('Columnas JSON encontradas:');
      jsonColumns.forEach(col => {
        console.log(`  - ${col.table_name}.${col.column_name}: ${col.data_type}`);
      });
    } else {
      console.log('✅ No hay columnas JSON adicionales');
    }
    
    // 5. Verificar integridad de datos
    console.log('\n🔍 Verificando integridad de datos JSON/JSONB...');
    const invitations = await sql`
      SELECT id, role, email, metadata, created_at 
      FROM invitations 
      ORDER BY id
    `;
    
    console.log('Invitaciones encontradas:');
    invitations.forEach(inv => {
      console.log(`  ID: ${inv.id}, Role: ${inv.role}, Email: ${inv.email || 'NULL'}`);
      if (inv.metadata) {
        try {
          const parsed = typeof inv.metadata === 'string' ? JSON.parse(inv.metadata) : inv.metadata;
          console.log(`      Metadata: ${JSON.stringify(parsed)}`);
        } catch (e) {
          console.log(`      Metadata CORRUPTO: ${inv.metadata}`);
        }
      }
    });
    
    // 6. Verificar reservations
    console.log('\n🔍 Verificando reservations...');
    const reservationsWithIssues = await sql`
      SELECT id, trip_details, created_at 
      FROM reservations 
      WHERE trip_details IS NOT NULL
      ORDER BY id DESC
      LIMIT 5
    `;
    
    console.log('Últimas 5 reservaciones con trip_details:');
    reservationsWithIssues.forEach(res => {
      console.log(`  ID: ${res.id}, Trip Details: ${JSON.stringify(res.trip_details)}`);
    });
    
    // 7. Conteo general
    console.log('\n📊 Conteo de registros:');
    const counts = await sql`
      SELECT 
        (SELECT COUNT(*) FROM users) as users,
        (SELECT COUNT(*) FROM companies) as companies,
        (SELECT COUNT(*) FROM trips) as trips,
        (SELECT COUNT(*) FROM reservations) as reservations,
        (SELECT COUNT(*) FROM invitations) as invitations
    `;
    
    const count = counts[0];
    console.log(`  - Usuarios: ${count.users}`);
    console.log(`  - Empresas: ${count.companies}`);
    console.log(`  - Viajes: ${count.trips}`);
    console.log(`  - Reservaciones: ${count.reservations}`);
    console.log(`  - Invitaciones: ${count.invitations}`);
    
    console.log('\n🎉 Diagnóstico completado exitosamente');
    
  } catch (error) {
    console.error('❌ Error durante el diagnóstico:', error.message);
    console.error('Stack:', error.stack);
    
    // Sugerencias de solución
    console.log('\n💡 Sugerencias para solucionar el problema:');
    console.log('1. Verificar que DATABASE_URL esté configurada correctamente');
    console.log('2. Asegurar que el servidor tenga acceso a internet');
    console.log('3. Verificar que Supabase esté funcionando correctamente');
    console.log('4. Revisar los logs de la aplicación para errores específicos');
  }
}

// Ejecutar el script
fixProductionDatabase();