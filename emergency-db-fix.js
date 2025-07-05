// Script de emergencia para corregir problemas de base de datos
// Ejecutar en tu servidor de producción cuando los errores persistan

const { neon } = require('@neondatabase/serverless');

async function emergencyFix() {
  try {
    const DATABASE_URL = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
    
    if (!DATABASE_URL) {
      console.error('❌ DATABASE_URL no configurada');
      process.exit(1);
    }
    
    console.log('🚨 Iniciando corrección de emergencia...');
    const sql = neon(DATABASE_URL);
    
    // 1. Forzar conversión de metadata a jsonb
    console.log('🔧 Convirtiendo metadata a jsonb...');
    try {
      await sql`ALTER TABLE invitations ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb`;
      console.log('✅ Conversión exitosa');
    } catch (error) {
      console.log('⚠️  Posible problema con datos corruptos:', error.message);
      
      // Intentar limpiar datos corruptos
      console.log('🧹 Limpiando datos corruptos...');
      
      // Eliminar registros con JSON inválido
      const deletedRows = await sql`
        DELETE FROM invitations 
        WHERE metadata IS NOT NULL 
        AND metadata::text NOT LIKE '{%}' 
        AND metadata::text NOT LIKE '[%]'
      `;
      
      console.log(`🗑️  Eliminados ${deletedRows.length} registros corruptos`);
      
      // Intentar conversión nuevamente
      await sql`ALTER TABLE invitations ALTER COLUMN metadata TYPE jsonb USING metadata::jsonb`;
      console.log('✅ Conversión exitosa después de limpieza');
    }
    
    // 2. Verificar y corregir otros campos JSON
    console.log('🔍 Verificando otras tablas...');
    
    // Verificar trip_details en reservations
    try {
      const reservationsCheck = await sql`
        SELECT COUNT(*) as total
        FROM reservations 
        WHERE trip_details IS NOT NULL
      `;
      console.log(`📊 Reservaciones con trip_details: ${reservationsCheck[0].total}`);
    } catch (error) {
      console.log('⚠️  Error verificando reservations:', error.message);
    }
    
    // 3. Verificar consistencia de datos
    console.log('🔍 Verificando consistencia...');
    
    const consistency = await sql`
      SELECT 
        'invitations' as tabla,
        COUNT(*) as total,
        COUNT(CASE WHEN metadata IS NOT NULL THEN 1 END) as con_metadata
      FROM invitations
      UNION ALL
      SELECT 
        'reservations' as tabla,
        COUNT(*) as total,
        COUNT(CASE WHEN trip_details IS NOT NULL THEN 1 END) as con_trip_details
      FROM reservations
    `;
    
    consistency.forEach(row => {
      console.log(`📋 ${row.tabla}: ${row.total} registros totales, ${row.con_metadata || row.con_trip_details} con JSON`);
    });
    
    // 4. Verificar estructura final
    console.log('🔍 Verificando estructura final...');
    
    const finalStructure = await sql`
      SELECT table_name, column_name, data_type
      FROM information_schema.columns 
      WHERE table_name IN ('invitations', 'reservations')
      AND column_name IN ('metadata', 'trip_details')
      ORDER BY table_name, column_name
    `;
    
    finalStructure.forEach(col => {
      console.log(`📋 ${col.table_name}.${col.column_name}: ${col.data_type}`);
    });
    
    console.log('🎉 Corrección de emergencia completada');
    console.log('💡 Reinicia tu aplicación para aplicar los cambios');
    
  } catch (error) {
    console.error('❌ Error crítico:', error.message);
    console.error('Stack:', error.stack);
    
    console.log('\n🆘 Acciones de emergencia:');
    console.log('1. Verificar que la base de datos esté accesible');
    console.log('2. Revisar permisos de usuario de base de datos');
    console.log('3. Contactar soporte de Supabase si el problema persiste');
    console.log('4. Considerar restaurar backup más reciente');
  }
}

// Ejecutar corrección
emergencyFix();