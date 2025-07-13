import { Pool } from 'pg';
import { config } from 'dotenv';
config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function fixTripSeats() {
  const client = await pool.connect();
  
  try {
    // Obtener el viaje 1223
    const result = await client.query('SELECT id, capacity, trip_data FROM trips WHERE id = 1223');
    
    if (result.rows.length === 0) {
      console.log('Viaje 1223 no encontrado');
      return;
    }
    
    const trip = result.rows[0];
    console.log('Viaje encontrado:', {
      id: trip.id,
      capacity: trip.capacity,
      firstSegmentSeats: trip.trip_data[0]?.availableSeats
    });
    
    // Verificar si los asientos están incorrectos
    const tripData = trip.trip_data;
    let needsFixing = false;
    
    tripData.forEach((segment, index) => {
      if (segment.availableSeats !== segment.capacity) {
        console.log(`Segmento ${index}: availableSeats=${segment.availableSeats}, capacity=${segment.capacity}`);
        needsFixing = true;
      }
    });
    
    if (!needsFixing) {
      console.log('No se necesita corrección');
      return;
    }
    
    // Corregir asientos disponibles para que coincidan con la capacidad
    const fixedTripData = tripData.map(segment => ({
      ...segment,
      availableSeats: segment.capacity || trip.capacity
    }));
    
    console.log('Aplicando corrección...');
    
    // Actualizar la base de datos
    await client.query(
      'UPDATE trips SET trip_data = $1 WHERE id = $2',
      [JSON.stringify(fixedTripData), trip.id]
    );
    
    console.log('✅ Asientos corregidos exitosamente');
    
    // Verificar la corrección
    const verifyResult = await client.query("SELECT trip_data->0->>'availableSeats' as seats FROM trips WHERE id = 1223");
    console.log('Verificación - Asientos primer segmento:', verifyResult.rows[0].seats);
    
  } catch (error) {
    console.error('Error al corregir asientos:', error);
  } finally {
    client.release();
  }
}

fixTripSeats().then(() => {
  console.log('Proceso completado');
  process.exit(0);
}).catch(error => {
  console.error('Error:', error);
  process.exit(1);
});