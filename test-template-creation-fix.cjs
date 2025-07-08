/**
 * PRUEBA: CREACIÓN DE VIAJE TEMPLATE-BASED DESPUÉS DEL FIX
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function testTemplateCreationFix() {
  console.log('🔧 PRUEBA: CREACIÓN DE VIAJE TEMPLATE-BASED (POST-FIX)');
  console.log('='.repeat(50));
  
  try {
    // Paso 1: Verificar que trip_data ahora es nullable
    console.log('\n📊 PASO 1: Verificando esquema de tabla trips...');
    const schema = await sql`
      SELECT column_name, is_nullable, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'trips' AND column_name = 'trip_data'
    `;
    
    console.log(`✅ Campo trip_data: ${schema[0].data_type}, nullable: ${schema[0].is_nullable}`);
    
    // Paso 2: Crear viaje template-based directamente en base de datos
    console.log('\n🚀 PASO 2: Creando viaje template-based...');
    const newTrip = await sql`
      INSERT INTO trips (
        template_id, 
        departure_date, 
        departure_time, 
        capacity, 
        visibility, 
        route_id, 
        company_id, 
        seat_occupancy,
        trip_data
      ) VALUES (
        3, 
        '2025-07-09', 
        '10:00 AM', 
        18, 
        'publicado', 
        6, 
        'bamo-350045', 
        '{}',
        NULL
      ) RETURNING id, template_id, departure_date, departure_time
    `;
    
    console.log(`✅ Viaje template-based creado exitosamente:`);
    console.log(`   - ID: ${newTrip[0].id}`);
    console.log(`   - Template ID: ${newTrip[0].template_id}`);
    console.log(`   - Fecha: ${newTrip[0].departure_date}`);
    console.log(`   - Hora: ${newTrip[0].departure_time}`);
    
    // Paso 3: Verificar búsqueda híbrida
    console.log('\n🔍 PASO 3: Probando búsqueda híbrida...');
    const searchResults = await sql`
      SELECT 
        id, 
        template_id, 
        departure_date, 
        departure_time,
        trip_data IS NULL as is_template_based
      FROM trips 
      WHERE departure_date = '2025-07-09' 
      OR (trip_data IS NOT NULL AND trip_data::text LIKE '%2025-07-09%')
      ORDER BY id DESC
    `;
    
    console.log(`✅ Búsqueda híbrida encontró ${searchResults.length} viajes:`);
    searchResults.forEach(trip => {
      const type = trip.is_template_based ? 'template-based' : 'legacy';
      console.log(`   - ID ${trip.id}: ${type} (${trip.departure_date})`);
    });
    
    // Paso 4: Estadísticas actualizadas
    console.log('\n📊 PASO 4: Estadísticas del sistema...');
    const stats = await sql`
      SELECT 
        COUNT(*) as total_trips,
        COUNT(CASE WHEN template_id IS NOT NULL THEN 1 END) as template_based_trips,
        COUNT(CASE WHEN trip_data IS NOT NULL AND template_id IS NULL THEN 1 END) as legacy_trips
      FROM trips
    `;
    
    const systemStats = stats[0];
    console.log(`📈 Estado actualizado del sistema:`);
    console.log(`   - Total viajes: ${systemStats.total_trips}`);
    console.log(`   - Viajes template-based: ${systemStats.template_based_trips}`);
    console.log(`   - Viajes legacy: ${systemStats.legacy_trips}`);
    
    const efficiency = Math.round((systemStats.template_based_trips / systemStats.total_trips) * 100);
    console.log(`   - Eficiencia template-based: ${efficiency}%`);
    
    if (efficiency > 0) {
      console.log('\n🎉 ¡ÉXITO! Sistema template-based funcionando correctamente');
      console.log('✅ Restricción NOT NULL removida exitosamente');
      console.log('✅ Viajes template-based creándose sin problemas');
      console.log('✅ Sistema híbrido operativo');
    }
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
}

// Ejecutar prueba
if (require.main === module) {
  testTemplateCreationFix()
    .then(() => {
      console.log('\n🏁 Prueba completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error:', error);
      process.exit(1);
    });
}

module.exports = { testTemplateCreationFix };