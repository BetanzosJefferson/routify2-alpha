/**
 * PASO 8: MIGRACIÓN DE DATOS EXISTENTES
 * Migra viajes legacy (tripData JSON) a estructura template-based
 * Mantiene compatibilidad total durante la transición
 */

const { neon } = require('@neondatabase/serverless');
require('dotenv').config();

const sql = neon(process.env.DATABASE_URL);

async function migrateExistingTrips() {
  console.log('🔄 INICIANDO MIGRACIÓN DE VIAJES LEGACY A TEMPLATE-BASED');
  console.log('='.repeat(60));
  
  try {
    // Paso 1: Obtener todos los viajes legacy (con tripData y sin templateId)
    console.log('\n📊 PASO 1: Analizando viajes legacy...');
    const legacyTrips = await sql`
      SELECT id, route_id, company_id, trip_data
      FROM trips 
      WHERE trip_data IS NOT NULL 
      AND template_id IS NULL
      ORDER BY id DESC
    `;
    
    console.log(`✅ Encontrados ${legacyTrips.length} viajes legacy para migrar`);
    
    if (legacyTrips.length === 0) {
      console.log('✨ No hay viajes legacy que migrar. Sistema completamente actualizado.');
      return;
    }
    
    // Paso 2: Procesar cada viaje legacy
    let migratedCount = 0;
    let errorCount = 0;
    
    console.log('\n🔄 PASO 2: Procesando viajes legacy...');
    
    for (const trip of legacyTrips) {
      try {
        console.log(`\n--- Procesando viaje ID: ${trip.id} ---`);
        
        // Parsear tripData JSON (ya viene como objeto desde PostgreSQL JSONB)
        const tripData = trip.trip_data;
        
        if (!tripData || !tripData.length) {
          console.log(`⚠️  Viaje ${trip.id}: tripData vacío, omitiendo...`);
          continue;
        }
        
        // Extraer información del primer segmento (datos principales del viaje)
        const firstSegment = tripData[0];
        const departureDate = firstSegment.date || new Date().toISOString().split('T')[0];
        const departureTime = firstSegment.departureTime || '00:00';
        
        console.log(`📅 Fecha: ${departureDate}, Hora: ${departureTime}`);
        
        // Actualizar el viaje con campos template-based
        await sql`
          UPDATE trips 
          SET 
            departure_date = ${departureDate},
            departure_time = ${departureTime},
            seat_occupancy = '{}'::jsonb
          WHERE id = ${trip.id}
        `;
        
        migratedCount++;
        console.log(`✅ Viaje ${trip.id} migrado exitosamente`);
        
      } catch (error) {
        errorCount++;
        console.error(`❌ Error procesando viaje ${trip.id}:`, error.message);
      }
    }
    
    // Paso 3: Reporte final
    console.log('\n' + '='.repeat(60));
    console.log('📈 REPORTE FINAL DE MIGRACIÓN');
    console.log(`✅ Viajes migrados exitosamente: ${migratedCount}`);
    console.log(`❌ Viajes con errores: ${errorCount}`);
    console.log(`📊 Total procesados: ${migratedCount + errorCount}`);
    console.log(`🎯 Tasa de éxito: ${Math.round((migratedCount / (migratedCount + errorCount)) * 100)}%`);
    
    // Paso 4: Verificación post-migración
    console.log('\n🔍 PASO 3: Verificación post-migración...');
    
    const updatedTrips = await sql`
      SELECT 
        COUNT(*) as total_trips,
        COUNT(CASE WHEN template_id IS NOT NULL THEN 1 END) as template_based_trips,
        COUNT(CASE WHEN trip_data IS NOT NULL AND template_id IS NULL THEN 1 END) as legacy_trips,
        COUNT(CASE WHEN departure_date IS NOT NULL THEN 1 END) as trips_with_departure_date
      FROM trips
    `;
    
    const stats = updatedTrips[0];
    console.log(`📊 Estadísticas actuales:`);
    console.log(`   - Total de viajes: ${stats.total_trips}`);
    console.log(`   - Viajes template-based: ${stats.template_based_trips}`);
    console.log(`   - Viajes legacy restantes: ${stats.legacy_trips}`);
    console.log(`   - Viajes con departure_date: ${stats.trips_with_departure_date}`);
    
    if (stats.legacy_trips > 0) {
      console.log('\n⚠️  IMPORTANTE: Aún quedan viajes legacy sin migrar');
      console.log('   Estos viajes seguirán funcionando con el sistema híbrido');
      console.log('   Se recomienda revisar los errores y ejecutar la migración nuevamente');
    } else {
      console.log('\n🎉 ¡MIGRACIÓN COMPLETADA EXITOSAMENTE!');
      console.log('   Todos los viajes ahora tienen estructura template-based');
    }
    
  } catch (error) {
    console.error('❌ Error crítico durante la migración:', error);
    throw error;
  }
}

// Función adicional para migración incremental
async function migrateSpecificTrips(tripIds) {
  console.log('🎯 MIGRACIÓN ESPECÍFICA DE VIAJES');
  console.log(`Procesando viajes: ${tripIds.join(', ')}`);
  
  for (const tripId of tripIds) {
    try {
      const trip = await sql`
        SELECT id, trip_data 
        FROM trips 
        WHERE id = ${tripId} AND trip_data IS NOT NULL
      `;
      
      if (trip.length === 0) {
        console.log(`⚠️  Viaje ${tripId} no encontrado o ya migrado`);
        continue;
      }
      
      const tripData = JSON.parse(trip[0].trip_data);
      const firstSegment = tripData[0];
      const departureDate = firstSegment.date || new Date().toISOString().split('T')[0];
      const departureTime = firstSegment.departureTime || '00:00';
      
      await sql`
        UPDATE trips 
        SET 
          departure_date = ${departureDate},
          departure_time = ${departureTime},
          seat_occupancy = '{}'::jsonb
        WHERE id = ${tripId}
      `;
      
      console.log(`✅ Viaje ${tripId} migrado exitosamente`);
      
    } catch (error) {
      console.error(`❌ Error migrando viaje ${tripId}:`, error.message);
    }
  }
}

// Ejecutar migración
if (require.main === module) {
  migrateExistingTrips()
    .then(() => {
      console.log('\n🏁 Migración completada');
      process.exit(0);
    })
    .catch(error => {
      console.error('💥 Error fatal:', error);
      process.exit(1);
    });
}

module.exports = { migrateExistingTrips, migrateSpecificTrips };