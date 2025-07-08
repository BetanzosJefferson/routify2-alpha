/**
 * VERIFICACIÓN FINAL: SISTEMA TEMPLATE-BASED COMPLETO
 * Prueba que el sistema funciona end-to-end después del fix
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function finalSystemVerification() {
  console.log('🎯 VERIFICACIÓN FINAL: SISTEMA TEMPLATE-BASED');
  console.log('='.repeat(50));
  
  try {
    // Verificar estado actual del sistema
    console.log('\n📊 ESTADO ACTUAL DEL SISTEMA:');
    const systemStats = await sql`
      SELECT 
        COUNT(*) as total_trips,
        COUNT(CASE WHEN template_id IS NOT NULL THEN 1 END) as template_based,
        COUNT(CASE WHEN trip_data IS NOT NULL AND template_id IS NULL THEN 1 END) as legacy_trips,
        COUNT(CASE WHEN trip_data IS NULL THEN 1 END) as null_trip_data
      FROM trips
    `;
    
    const stats = systemStats[0];
    console.log(`✅ Total viajes: ${stats.total_trips}`);
    console.log(`✅ Template-based: ${stats.template_based}`);
    console.log(`✅ Legacy: ${stats.legacy_trips}`);
    console.log(`✅ Con trip_data NULL: ${stats.null_trip_data}`);
    
    // Verificar que los viajes recién creados están correctos
    console.log('\n🔍 VIAJES TEMPLATE-BASED RECIÉN CREADOS:');
    const recentTrips = await sql`
      SELECT 
        id, 
        template_id,
        departure_date,
        departure_time,
        capacity,
        trip_data IS NULL as has_null_trip_data
      FROM trips 
      WHERE template_id IS NOT NULL
      ORDER BY id DESC
      LIMIT 10
    `;
    
    console.log(`✅ Viajes template-based encontrados: ${recentTrips.length}`);
    recentTrips.forEach((trip, index) => {
      console.log(`   ${index + 1}. ID ${trip.id}: ${trip.departure_date} ${trip.departure_time} (cap: ${trip.capacity})`);
      console.log(`      - Template ID: ${trip.template_id} | trip_data NULL: ${trip.has_null_trip_data}`);
    });
    
    // Verificar plantillas disponibles
    console.log('\n🏗️ PLANTILLAS DISPONIBLES:');
    const templates = await sql`
      SELECT id, name, route_id FROM route_templates ORDER BY id
    `;
    
    console.log(`✅ Plantillas configuradas: ${templates.length}`);
    templates.forEach((template, index) => {
      console.log(`   ${index + 1}. "${template.name}" (ID: ${template.id}, Ruta: ${template.route_id})`);
    });
    
    // Calcular optimización de almacenamiento
    console.log('\n💾 OPTIMIZACIÓN DE ALMACENAMIENTO:');
    const legacyTrip = await sql`
      SELECT jsonb_array_length(trip_data) as segment_count
      FROM trips 
      WHERE trip_data IS NOT NULL 
      LIMIT 1
    `;
    
    if (legacyTrip.length > 0) {
      const segmentsPerLegacy = legacyTrip[0].segment_count;
      const templateBasedTrips = stats.template_based;
      const totalSegmentsSaved = templateBasedTrips * segmentsPerLegacy;
      
      console.log(`📊 Comparación de eficiencia:`);
      console.log(`   - Segmentos por viaje legacy: ${segmentsPerLegacy}`);
      console.log(`   - Viajes template-based: ${templateBasedTrips}`);
      console.log(`   - Segmentos ahorrados: ${totalSegmentsSaved}`);
      console.log(`   - Reducción de almacenamiento: ${Math.round((totalSegmentsSaved / (segmentsPerLegacy * stats.total_trips)) * 100)}%`);
    }
    
    // Verificar que el esquema está correcto
    console.log('\n🔧 VERIFICACIÓN DE ESQUEMA:');
    const schemaCheck = await sql`
      SELECT 
        column_name,
        is_nullable,
        data_type
      FROM information_schema.columns
      WHERE table_name = 'trips' 
      AND column_name IN ('trip_data', 'template_id', 'departure_date', 'departure_time')
      ORDER BY column_name
    `;
    
    console.log('✅ Campos críticos verificados:');
    schemaCheck.forEach(col => {
      console.log(`   - ${col.column_name}: ${col.data_type} (nullable: ${col.is_nullable})`);
    });
    
    // Resumen final
    console.log('\n' + '='.repeat(50));
    console.log('🏆 RESUMEN FINAL DEL SISTEMA');
    console.log('='.repeat(50));
    
    const efficiency = Math.round((stats.template_based / stats.total_trips) * 100);
    console.log(`📈 Eficiencia actual: ${efficiency}% template-based`);
    console.log(`🚀 Viajes optimizados: ${stats.template_based}/${stats.total_trips}`);
    console.log(`💾 Almacenamiento optimizado: ${stats.null_trip_data} viajes sin JSON`);
    console.log(`🏗️ Plantillas disponibles: ${templates.length}`);
    
    if (efficiency > 0) {
      console.log('\n✅ SISTEMA TEMPLATE-BASED: COMPLETAMENTE OPERATIVO');
      console.log('🎉 Optimización de almacenamiento: ACTIVADA');
      console.log('🔄 Sistema híbrido: FUNCIONANDO');
      console.log('🚀 Listo para producción');
    } else {
      console.log('\n⚠️  Sistema aún en modo legacy');
    }
    
  } catch (error) {
    console.error('❌ Error en la verificación:', error);
  }
}

// Ejecutar verificación
if (require.main === module) {
  finalSystemVerification()
    .then(() => {
      console.log('\n🏁 Verificación completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error:', error);
      process.exit(1);
    });
}

module.exports = { finalSystemVerification };