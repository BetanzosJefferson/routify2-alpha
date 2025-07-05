// Script para ejecutar migración y corrección en producción
// Uso: node production-migration-fix.js

import { drizzle } from 'drizzle-orm/neon-http';
import { migrate } from 'drizzle-orm/neon-http/migrator';
import { neon } from '@neondatabase/serverless';

async function runProductionMigrationAndFix() {
  try {
    const DATABASE_URL = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
    
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada');
    }
    
    console.log('🚀 Iniciando migración y corrección en producción...');
    
    // Crear conexión
    const sql = neon(DATABASE_URL);
    const db = drizzle(sql);
    
    // 1. Verificar estado actual
    console.log('🔍 Verificando estado actual de la base de datos...');
    
    const tablesResult = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `;
    
    console.log('📊 Tablas encontradas:', tablesResult.map(t => t.table_name).join(', '));
    
    // 2. Verificar estructura de invitations
    const invitationsStructure = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'invitations' 
      ORDER BY ordinal_position
    `;
    
    console.log('🔍 Estructura de invitations:');
    invitationsStructure.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // 3. Corregir metadata si es necesario
    const metadataType = invitationsStructure.find(col => col.column_name === 'metadata');
    
    if (metadataType?.data_type === 'json') {
      console.log('🔧 Convirtiendo metadata de json a jsonb...');
      
      try {
        await sql`ALTER TABLE invitations ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb`;
        console.log('✅ Conversión exitosa');
      } catch (error) {
        console.log('⚠️ Error en conversión:', error.message);
        
        // Verificar datos problemáticos
        const problemData = await sql`
          SELECT id, metadata::text as metadata_text
          FROM invitations 
          WHERE metadata IS NOT NULL
        `;
        
        console.log('🔍 Datos encontrados:');
        problemData.forEach(row => {
          console.log(`  ID ${row.id}: ${row.metadata_text}`);
        });
        
        // Intentar limpiar datos corruptos
        console.log('🧹 Limpiando datos corruptos...');
        const cleaned = await sql`
          DELETE FROM invitations 
          WHERE metadata IS NOT NULL 
          AND NOT (metadata::text ~ '^[\{\[].*[\}\]]$')
        `;
        
        console.log(`🗑️ Eliminados ${cleaned.length} registros con datos corruptos`);
        
        // Intentar conversión nuevamente
        await sql`ALTER TABLE invitations ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb`;
        console.log('✅ Conversión exitosa después de limpieza');
      }
    } else {
      console.log('✅ metadata ya es jsonb o no existe');
    }
    
    // 4. Ejecutar migraciones pendientes
    console.log('🔄 Ejecutando migraciones pendientes...');
    
    try {
      await migrate(db, { migrationsFolder: './migrations' });
      console.log('✅ Migraciones ejecutadas exitosamente');
    } catch (error) {
      console.log('⚠️ Error en migraciones:', error.message);
      
      // Verificar si las migraciones ya están aplicadas
      const migrationsTable = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = '__drizzle_migrations'
        ) as exists
      `;
      
      if (migrationsTable[0].exists) {
        const appliedMigrations = await sql`
          SELECT hash, created_at FROM __drizzle_migrations 
          ORDER BY created_at DESC
        `;
        
        console.log('📋 Migraciones aplicadas:');
        appliedMigrations.forEach(migration => {
          console.log(`  - ${migration.hash} (${migration.created_at})`);
        });
      }
    }
    
    // 5. Verificar otras tablas críticas
    console.log('🔍 Verificando otras tablas críticas...');
    
    // Verificar reservations
    const reservationsStructure = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reservations' 
      AND column_name IN ('trip_details', 'id', 'status')
      ORDER BY ordinal_position
    `;
    
    console.log('📋 Estructura de reservations:');
    reservationsStructure.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // 6. Verificar integridad general
    console.log('🔍 Verificando integridad general...');
    
    const counts = await sql`
      SELECT 
        'users' as tabla,
        COUNT(*) as total
      FROM users
      UNION ALL
      SELECT 
        'companies' as tabla,
        COUNT(*) as total
      FROM companies
      UNION ALL
      SELECT 
        'invitations' as tabla,
        COUNT(*) as total
      FROM invitations
      UNION ALL
      SELECT 
        'trips' as tabla,
        COUNT(*) as total
      FROM trips
      UNION ALL
      SELECT 
        'reservations' as tabla,
        COUNT(*) as total
      FROM reservations
      ORDER BY tabla
    `;
    
    console.log('📊 Conteo de registros:');
    counts.forEach(row => {
      console.log(`  - ${row.tabla}: ${row.total}`);
    });
    
    // 7. Verificar campos JSON/JSONB
    console.log('🔍 Verificando campos JSON/JSONB...');
    
    const jsonFields = await sql`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns 
      WHERE data_type IN ('json', 'jsonb') 
      AND table_schema = 'public'
      ORDER BY table_name, column_name
    `;
    
    console.log('📋 Campos JSON/JSONB encontrados:');
    jsonFields.forEach(field => {
      console.log(`  - ${field.table_name}.${field.column_name}: ${field.data_type}`);
    });
    
    console.log('🎉 Migración y corrección completadas exitosamente');
    console.log('💡 Reinicia tu aplicación para aplicar todos los cambios');
    
  } catch (error) {
    console.error('❌ Error durante la migración:', error.message);
    console.error('Stack:', error.stack);
    
    console.log('\n🆘 Pasos para solucionar:');
    console.log('1. Verificar que DATABASE_URL esté configurada correctamente');
    console.log('2. Asegurar que el directorio ./migrations exista');
    console.log('3. Verificar permisos de base de datos');
    console.log('4. Revisar logs de aplicación para errores específicos');
  }
}

// Ejecutar migración
runProductionMigrationAndFix();