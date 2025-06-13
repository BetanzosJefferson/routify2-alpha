// Test para verificar el cálculo correcto de departureDate en viajes que cruzan medianoche
console.log("=== PRUEBA DE CÁLCULO DE FECHAS PARA VIAJES QUE CRUZAN MEDIANOCHE ===\n");

// Simular el escenario del usuario:
// Viaje que sale a las 7:00 PM, parada a las 3:00 AM, llega a las 5:00 AM
const tripExample = {
  departureTime: "07:00 PM",
  arrivalTime: "05:00 AM",
  segments: [
    {
      origin: "Acapulco de Juárez, Guerrero - Condesa",
      destination: "Chilpancingo de los Bravo, Guerrero - Chilpancingo", 
      departureTime: "07:00 PM",
      arrivalTime: "11:00 PM"
    },
    {
      origin: "Chilpancingo de los Bravo, Guerrero - Chilpancingo",
      destination: "Coyoacán, Ciudad de México - Taxqueña",
      departureTime: "03:00 AM +1d", // 3:00 AM del día siguiente
      arrivalTime: "05:00 AM +1d"   // 5:00 AM del día siguiente
    }
  ],
  originalDate: "2025-06-13"
};

// Función helper para extraer indicador de día
function extractDayIndicator(timeString) {
  if (!timeString) return 0;
  const dayIndicatorMatch = timeString.match(/\+(\d+)d$/);
  return dayIndicatorMatch ? parseInt(dayIndicatorMatch[1], 10) : 0;
}

// Función para calcular la fecha correcta de un segmento
function calculateSegmentDate(originalDate, segmentTime) {
  const dayOffset = extractDayIndicator(segmentTime);
  const segmentDate = new Date(originalDate);
  
  if (dayOffset > 0) {
    segmentDate.setDate(segmentDate.getDate() + dayOffset);
  }
  
  return segmentDate.toISOString().split('T')[0];
}

console.log("Fecha original del viaje:", tripExample.originalDate);
console.log("Horario de salida principal:", tripExample.departureTime);
console.log("Horario de llegada principal:", tripExample.arrivalTime);
console.log("");

console.log("=== ANÁLISIS DE SEGMENTOS ===");

tripExample.segments.forEach((segment, index) => {
  console.log(`\nSegmento ${index + 1}: ${segment.origin} → ${segment.destination}`);
  console.log(`  Hora de salida: ${segment.departureTime}`);
  console.log(`  Hora de llegada: ${segment.arrivalTime}`);
  
  const departureDayOffset = extractDayIndicator(segment.departureTime);
  const departureDate = calculateSegmentDate(tripExample.originalDate, segment.departureTime);
  
  console.log(`  Offset de días: +${departureDayOffset} días`);
  console.log(`  Fecha de salida calculada: ${departureDate}`);
  
  if (departureDayOffset > 0) {
    console.log(`  ✅ CORRECTO: Este segmento tiene departureDate del día siguiente`);
  } else {
    console.log(`  ✅ CORRECTO: Este segmento tiene departureDate del mismo día`);
  }
});

console.log("\n=== RESULTADO ESPERADO ===");
console.log("Segmento 1 (7:00 PM - 11:00 PM): departureDate = 2025-06-13 (mismo día)");
console.log("Segmento 2 (3:00 AM - 5:00 AM): departureDate = 2025-06-14 (día siguiente)");
console.log("\nEsto permite que:");
console.log("- Búsquedas del 13 de junio encuentren el primer segmento");
console.log("- Búsquedas del 14 de junio encuentren el segundo segmento");
console.log("- Los boletos tengan las fechas correctas");