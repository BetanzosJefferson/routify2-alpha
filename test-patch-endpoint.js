#!/usr/bin/env node
/**
 * Script para probar el endpoint PATCH /trips/:id con la corrección del bug
 * de reseteo de asientos. Simula una petición real del frontend.
 */

import axios from 'axios';
import { Client } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const API_BASE = 'http://localhost:5173/api';
const pool = new Client({
  connectionString: process.env.DATABASE_URL,
});

// Función para hacer login y obtener cookie de sesión
async function loginAndGetSession() {
  try {
    const loginResponse = await axios.post(`${API_BASE}/auth/login`, {
      email: 'admin@bamo.com',
      password: 'admin123'
    }, {
      withCredentials: true,
      validateStatus: () => true
    });
    
    if (loginResponse.status === 200) {
      const cookies = loginResponse.headers['set-cookie'];
      return cookies ? cookies.join('; ') : null;
    }
    
    console.error('❌ Error en login:', loginResponse.status, loginResponse.data);
    return null;
  } catch (error) {
    console.error('❌ Error durante login:', error.message);
    return null;
  }
}

async function main() {
  try {
    await pool.connect();
    console.log('🔗 Conectado a la base de datos');
    
    // PASO 1: Hacer login
    console.log('\n=== PASO 1: AUTENTICACIÓN ===');
    const sessionCookie = await loginAndGetSession();
    
    if (!sessionCookie) {
      console.error('❌ No se pudo obtener sesión de usuario');
      return;
    }
    
    console.log('✅ Sesión obtenida correctamente');
    
    // PASO 2: Buscar viaje con reservas para probar
    console.log('\n=== PASO 2: IDENTIFICANDO VIAJE PARA PRUEBA ===');
    
    const tripsWithReservations = await pool.query(`
      SELECT DISTINCT 
        t.id as trip_id,
        t.capacity,
        t.trip_data,
        COUNT(r.id) as reservation_count
      FROM trips t
      LEFT JOIN reservations r ON 
        r.trip_details->>'recordId' = t.id::text 
        AND r.status != 'cancelled'
      WHERE t.trip_data IS NOT NULL 
        AND jsonb_array_length(t.trip_data) > 0
        AND t.company_id = 'bamo-350045'
      GROUP BY t.id, t.capacity, t.trip_data
      HAVING COUNT(r.id) > 0
      ORDER BY reservation_count DESC
      LIMIT 1
    `);
    
    if (tripsWithReservations.rows.length === 0) {
      console.log('❌ No se encontraron viajes con reservas para probar');
      return;
    }
    
    const testTrip = tripsWithReservations.rows[0];
    console.log(`🎯 Usando viaje ${testTrip.trip_id} para pruebas`);
    console.log(`  Capacidad actual: ${testTrip.capacity}`);
    console.log(`  Reservas: ${testTrip.reservation_count}`);
    
    // PASO 3: Obtener estado antes de la prueba
    console.log('\n=== PASO 3: ESTADO ANTES DE LA PRUEBA ===');
    
    const beforeState = await pool.query('SELECT * FROM trips WHERE id = $1', [testTrip.trip_id]);
    const tripBefore = beforeState.rows[0];
    
    console.log(`📋 Estado inicial:`);
    console.log(`  Capacidad: ${tripBefore.capacity}`);
    console.log(`  Segmentos: ${tripBefore.trip_data.length}`);
    
    tripBefore.trip_data.forEach((segment, index) => {
      console.log(`  Segmento ${index} (${segment.tripId}): ${segment.availableSeats} disponibles`);
    });
    
    // PASO 4: Hacer petición PATCH para cambiar capacidad
    console.log('\n=== PASO 4: EJECUTANDO PATCH ENDPOINT ===');
    
    const newCapacity = tripBefore.capacity + 2; // Incrementar en 2 para probar
    console.log(`🔄 Cambiando capacidad de ${tripBefore.capacity} a ${newCapacity}`);
    
    try {
      const patchResponse = await axios.patch(
        `${API_BASE}/trips/${testTrip.trip_id}`,
        { capacity: newCapacity },
        {
          headers: {
            'Cookie': sessionCookie,
            'Content-Type': 'application/json'
          },
          withCredentials: true,
          validateStatus: () => true
        }
      );
      
      if (patchResponse.status === 200) {
        console.log('✅ PATCH request exitosa');
        console.log('📊 Respuesta del servidor:', JSON.stringify(patchResponse.data, null, 2));
      } else {
        console.error('❌ Error en PATCH request:', patchResponse.status, patchResponse.data);
        return;
      }
      
    } catch (error) {
      console.error('❌ Error durante PATCH request:', error.message);
      return;
    }
    
    // PASO 5: Verificar estado después de la prueba
    console.log('\n=== PASO 5: ESTADO DESPUÉS DE LA PRUEBA ===');
    
    const afterState = await pool.query('SELECT * FROM trips WHERE id = $1', [testTrip.trip_id]);
    const tripAfter = afterState.rows[0];
    
    console.log(`📋 Estado final:`);
    console.log(`  Capacidad: ${tripBefore.capacity} → ${tripAfter.capacity}`);
    console.log(`  Segmentos: ${tripAfter.trip_data.length}`);
    
    // PASO 6: Análisis de corrección
    console.log('\n=== PASO 6: ANÁLISIS DE CORRECCIÓN ===');
    
    let correctUpdates = 0;
    let totalSegments = tripAfter.trip_data.length;
    
    tripAfter.trip_data.forEach((segmentAfter, index) => {
      const segmentBefore = tripBefore.trip_data[index];
      const expectedIncrease = newCapacity - tripBefore.capacity; // Debería ser +2
      const actualIncrease = segmentAfter.availableSeats - segmentBefore.availableSeats;
      
      console.log(`  📍 Segmento ${index} (${segmentAfter.tripId}):`);
      console.log(`    Antes: ${segmentBefore.availableSeats} disponibles`);
      console.log(`    Después: ${segmentAfter.availableSeats} disponibles`);
      console.log(`    Incremento esperado: +${expectedIncrease}, real: +${actualIncrease}`);
      
      // Validaciones
      if (segmentAfter.availableSeats < 0) {
        console.log(`    ❌ ERROR: Asientos negativos`);
      } else if (segmentAfter.availableSeats > segmentAfter.capacity) {
        console.log(`    ❌ ERROR: Más disponibles que capacidad`);
      } else if (actualIncrease === expectedIncrease) {
        console.log(`    ✅ Correcto: Incremento esperado`);
        correctUpdates++;
      } else {
        console.log(`    ⚠️  Incremento inesperado`);
      }
    });
    
    // PASO 7: Resultado final
    console.log('\n=== PASO 7: RESULTADO FINAL ===');
    
    console.log(`📊 RESUMEN DE LA PRUEBA:`);
    console.log(`  Viaje ID: ${testTrip.trip_id}`);
    console.log(`  Capacidad: ${tripBefore.capacity} → ${tripAfter.capacity}`);
    console.log(`  Segmentos actualizados correctamente: ${correctUpdates}/${totalSegments}`);
    console.log(`  Reservas en el viaje: ${testTrip.reservation_count}`);
    
    if (correctUpdates === totalSegments) {
      console.log(`🎉 ¡PRUEBA EXITOSA! La corrección del bug funciona correctamente.`);
      console.log(`   - Todos los segmentos mantuvieron la integridad de asientos`);
      console.log(`   - No se resetéaron los asientos ocupados`);
      console.log(`   - La capacidad se incrementó adecuadamente`);
    } else {
      console.log(`⚠️  PRUEBA PARCIAL: ${totalSegments - correctUpdates} segmentos tienen problemas.`);
    }
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error.message);
    console.error(error.stack);
  } finally {
    await pool.end();
  }
}

// Función para revertir cambios si es necesario
async function revertChanges(tripId, originalCapacity, originalTripData) {
  try {
    await pool.connect();
    
    await pool.query(`
      UPDATE trips 
      SET 
        capacity = $1,
        trip_data = $2
      WHERE id = $3
    `, [originalCapacity, JSON.stringify(originalTripData), tripId]);
    
    console.log(`🔄 Cambios revertidos para viaje ${tripId}`);
    
  } catch (error) {
    console.error('❌ Error al revertir cambios:', error.message);
  } finally {
    await pool.end();
  }
}

main().catch(console.error);