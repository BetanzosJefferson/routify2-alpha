/**
 * Script para probar el fix de calculateSegmentDate
 * Verifica que la función ahora calcule correctamente las fechas para horarios AM tempranos
 */

// Simular una actualización del viaje 1227 con un pequeño cambio para activar calculateSegmentDate
const testData = {
  capacity: 16,
  vehicleId: null,
  driverId: null,
  visibility: 'private',
  segmentPrices: {
    'Acapulco de Juarez, Guerrero - Terminal condesa|Chilpancingo de los Bravo, Guerrero - Terminal Chilpancingo': {
      price: 120,
      departureTime: '23:50 PM',
      arrivalTime: '01:48 AM'
    }
  }
};

console.log('🧪 Probando fix de calculateSegmentDate...');
console.log('📊 Datos de prueba:', JSON.stringify(testData, null, 2));

// Hacer una petición PUT al endpoint
fetch('http://localhost:5000/api/trips/1227', {
  method: 'PUT',
  headers: {
    'Content-Type': 'application/json',
    'Cookie': 'connect.sid=s%3A7YoIp6MJnNBKWnqxjWYgBkiPZqPmTcCq.1N2cjSNtaVhRYjxgKZGzjLHMCE2oKjuqMIUjBJT%2FFkM'
  },
  body: JSON.stringify(testData)
})
.then(response => response.json())
.then(data => {
  console.log('✅ Respuesta del servidor:', JSON.stringify(data, null, 2));
  
  // Verificar que los segmentos con horario AM temprano tienen fecha correcta
  if (data.tripData) {
    const segmentsWith01_48AM = data.tripData.filter(segment => 
      segment.arrivalTime === '01:48 AM'
    );
    
    console.log('\n🎯 Segmentos con horario 01:48 AM:');
    segmentsWith01_48AM.forEach(segment => {
      console.log(`- ${segment.origin} → ${segment.destination}`);
      console.log(`  departureDate: ${segment.departureDate}`);
      console.log(`  arrivalTime: ${segment.arrivalTime}`);
      
      // Verificar si la fecha es correcta (debería ser 2025-07-14 para 01:48 AM)
      if (segment.departureDate === '2025-07-14') {
        console.log('  ✅ CORRECTO: Fecha calculada correctamente para horario AM temprano');
      } else {
        console.log('  ❌ ERROR: Fecha incorrecta, debería ser 2025-07-14');
      }
    });
  }
})
.catch(error => {
  console.error('❌ Error en la prueba:', error);
});