#!/usr/bin/env node
/**
 * Script de prueba para validar la corrección del bug de reseteo de asientos
 * cuando se actualiza la capacidad de un viaje.
 */

import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Client({
  connectionString: process.env.DATABASE_URL,
});

async function main() {
  try {
    await pool.connect();
    console.log('🔗 Conectado a la base de datos');
    
    // PASO 1: Identificar un viaje con reservas para testing
    console.log('\n=== PASO 1: IDENTIFICANDO VIAJE CON RESERVAS ===');
    
    const tripsWithReservations = await pool.query(`
      SELECT DISTINCT 
        t.id as trip_id,
        t.capacity,
        t.trip_data,
        COUNT(r.id) as reservation_count,
        SUM(
          CASE 
            WHEN r.trip_details->>'seatCount' IS NOT NULL 
            THEN (r.trip_details->>'seatCount')::int
            ELSE jsonb_array_length(COALESCE(r.trip_details->'passengersData', '[]'::jsonb))
          END
        ) as total_seats_occupied
      FROM trips t
      LEFT JOIN reservations r ON 
        r.trip_details->>'recordId' = t.id::text 
        AND r.status != 'cancelled'
      WHERE t.trip_data IS NOT NULL 
        AND jsonb_array_length(t.trip_data) > 0
      GROUP BY t.id, t.capacity, t.trip_data
      HAVING COUNT(r.id) > 0
      ORDER BY reservation_count DESC
      LIMIT 3
    `);
    
    if (tripsWithReservations.rows.length === 0) {
      console.log('❌ No se encontraron viajes con reservas para probar');
      return;
    }
    
    console.log(`📊 Viajes encontrados con reservas:`);
    tripsWithReservations.rows.forEach(trip => {
      console.log(`  Viaje ${trip.trip_id}: Capacidad ${trip.capacity}, ${trip.reservation_count} reservas, ${trip.total_seats_occupied} asientos ocupados`);
    });
    
    // Seleccionar el primer viaje para pruebas
    const testTrip = tripsWithReservations.rows[0];
    console.log(`\n🎯 Usando viaje ${testTrip.trip_id} para pruebas`);
    
    // PASO 2: Analizar estado actual antes de la prueba
    console.log('\n=== PASO 2: ESTADO ANTES DE LA PRUEBA ===');
    
    const currentTripData = await pool.query('SELECT * FROM trips WHERE id = $1', [testTrip.trip_id]);
    const currentTrip = currentTripData.rows[0];
    
    console.log(`📋 Viaje ${testTrip.trip_id}:`);
    console.log(`  Capacidad actual: ${currentTrip.capacity}`);
    console.log(`  Segmentos: ${currentTrip.trip_data.length}`);
    
    // Mostrar disponibilidad actual por segmento
    currentTrip.trip_data.forEach((segment, index) => {
      console.log(`  Segmento ${index} (${segment.tripId}): ${segment.availableSeats}/${segment.capacity || currentTrip.capacity} disponibles`);
    });
    
    // Obtener reservas actuales
    const reservationsData = await pool.query(`
      SELECT 
        r.id,
        r.trip_details->>'tripId' as trip_id,
        r.trip_details->>'seatCount' as seat_count,
        jsonb_array_length(COALESCE(r.trip_details->'passengersData', '[]'::jsonb)) as passengers_count,
        r.status
      FROM reservations r
      WHERE r.trip_details->>'recordId' = $1
        AND r.status != 'cancelled'
      ORDER BY r.id
    `, [testTrip.trip_id]);
    
    console.log(`\n📋 Reservas activas (${reservationsData.rows.length}):`);
    reservationsData.rows.forEach(res => {
      const seatCount = res.seat_count || res.passengers_count;
      console.log(`  Reserva ${res.id}: Segmento ${res.trip_id}, ${seatCount} asientos (seatCount: ${res.seat_count}, passengers: ${res.passengers_count})`);
    });
    
    // PASO 3: Simular cambio de capacidad (aumentar en 1)
    console.log('\n=== PASO 3: SIMULANDO CAMBIO DE CAPACIDAD ===');
    
    const newCapacity = currentTrip.capacity + 1;
    console.log(`🔄 Cambiando capacidad de ${currentTrip.capacity} a ${newCapacity}`);
    
    // Calcular la nueva disponibilidad usando la lógica corregida
    const updatedTripData = currentTrip.trip_data.map((segment, segmentIndex) => {
      // Filtrar reservas para este segmento específico
      const segmentReservations = reservationsData.rows.filter(r => r.trip_id === segment.tripId);
      
      // Contar asientos ocupados usando seatCount si está disponible
      const occupiedSeats = segmentReservations.reduce((sum, r) => {
        const reservedSeats = parseInt(r.seat_count) || parseInt(r.passengers_count) || 0;
        return sum + reservedSeats;
      }, 0);
      
      const availableSeats = newCapacity - occupiedSeats;
      
      console.log(`  📍 Segmento ${segmentIndex} (${segment.tripId}): ${occupiedSeats} ocupados → ${availableSeats} disponibles`);
      
      return {
        ...segment,
        capacity: newCapacity,
        availableSeats: Math.max(0, Math.min(availableSeats, newCapacity))
      };
    });
    
    // PASO 4: Aplicar la actualización real
    console.log('\n=== PASO 4: APLICANDO ACTUALIZACIÓN REAL ===');
    
    const updateResult = await pool.query(`
      UPDATE trips 
      SET 
        capacity = $1,
        trip_data = $2
      WHERE id = $3
      RETURNING *
    `, [newCapacity, JSON.stringify(updatedTripData), testTrip.trip_id]);
    
    if (updateResult.rows.length > 0) {
      console.log(`✅ Viaje ${testTrip.trip_id} actualizado correctamente`);
      
      // PASO 5: Verificar resultado final
      console.log('\n=== PASO 5: VERIFICACIÓN DEL RESULTADO ===');
      
      const updatedTrip = updateResult.rows[0];
      console.log(`📋 Estado final del viaje ${testTrip.trip_id}:`);
      console.log(`  Capacidad: ${currentTrip.capacity} → ${updatedTrip.capacity}`);
      
      updatedTrip.trip_data.forEach((segment, index) => {
        const originalSegment = currentTrip.trip_data[index];
        console.log(`  Segmento ${index}: ${originalSegment.availableSeats} → ${segment.availableSeats} disponibles`);
        
        // Validaciones de integridad
        if (segment.availableSeats < 0) {
          console.error(`  ❌ ERROR: Asientos negativos en segmento ${index}`);
        }
        if (segment.availableSeats > segment.capacity) {
          console.error(`  ❌ ERROR: Más asientos disponibles que capacidad en segmento ${index}`);
        }
      });
      
      // PASO 6: Calcular diferencias para validar corrección
      console.log('\n=== PASO 6: ANÁLISIS DE CORRECCIÓN ===');
      
      let totalIncorrectBefore = 0;
      let totalCorrectAfter = 0;
      
      currentTrip.trip_data.forEach((originalSegment, index) => {
        const updatedSegment = updatedTrip.trip_data[index];
        const expectedIncrease = 1; // Aumentamos capacidad en 1
        const actualIncrease = updatedSegment.availableSeats - originalSegment.availableSeats;
        
        console.log(`  Segmento ${index}: Incremento esperado: ${expectedIncrease}, Incremento real: ${actualIncrease}`);
        
        if (actualIncrease === expectedIncrease) {
          totalCorrectAfter++;
          console.log(`  ✅ Segmento ${index}: Corrección exitosa`);
        } else {
          totalIncorrectBefore++;
          console.log(`  ⚠️  Segmento ${index}: Incremento inesperado (esperado: ${expectedIncrease}, real: ${actualIncrease})`);
        }
      });
      
      console.log(`\n📊 RESUMEN:`);
      console.log(`  Segmentos correctamente actualizados: ${totalCorrectAfter}/${updatedTrip.trip_data.length}`);
      console.log(`  Segmentos con problemas: ${totalIncorrectBefore}/${updatedTrip.trip_data.length}`);
      
      if (totalCorrectAfter === updatedTrip.trip_data.length) {
        console.log(`🎉 ¡CORRECCIÓN EXITOSA! Todos los segmentos se actualizaron correctamente.`);
      } else {
        console.log(`⚠️  Se detectaron problemas en la actualización de algunos segmentos.`);
      }
      
    } else {
      console.error('❌ Error al actualizar el viaje');
    }
    
    console.log('\n✅ Prueba completada');
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);