// Monitor para detectar cambios en el viaje 1223
const initialState = {
  totalSegments: 111,
  sampleSegments: [
    { origin: "Acapulco de Juarez, Guerrero - Terminal condesa", destination: "Coyoacan, Ciudad de Mexico - Taxqueña", price: 450, tripId: 1752394036183, departureTime: "23:50 PM", arrivalTime: "05:33 AM" },
    { origin: "Acapulco de Juarez, Guerrero - Terminal condesa", destination: "Chilpancingo de los Bravo, Guerrero - Terminal Chilpancingo", price: 120, tripId: 1752394036222, departureTime: "23:50 PM", arrivalTime: "02:38 AM" },
    { origin: "Acapulco de Juarez, Guerrero - Terminal condesa", destination: "Tuliman, Guerrero - Paredero de Tuliman, sobre carretera", price: 240, tripId: 1752394037163, departureTime: "23:50 PM", arrivalTime: "02:58 AM" },
    { origin: "Acapulco de Juarez, Guerrero - Terminal condesa", destination: "Paso Morelos, Guerrero - Caseta de Paso Morelos", price: 300, tripId: 1752394037132, departureTime: "23:50 PM", arrivalTime: "03:28 AM" },
    { origin: "Acapulco de Juarez, Guerrero - Terminal condesa", destination: "Tequesquitengo, Morelos - Entronque de Tequesquitengo, sobre carretera", price: 350, tripId: 1752394036781, departureTime: "23:50 PM", arrivalTime: "03:43 AM" }
  ]
};

async function monitorTripChanges() {
  try {
    const response = await fetch('http://localhost:5000/api/trips/1223');
    const currentTrip = await response.json();
    
    console.log("=== MONITOR DE CAMBIOS - VIAJE 1223 ===\n");
    
    // Verificar total de segmentos
    const currentTotal = currentTrip.tripData?.length || 0;
    console.log(`Total de segmentos: ${currentTotal} (inicial: ${initialState.totalSegments})`);
    
    if (currentTotal !== initialState.totalSegments) {
      console.log(`❌ CAMBIO CRÍTICO: Se perdieron ${initialState.totalSegments - currentTotal} segmentos`);
    } else {
      console.log(`✅ Total de segmentos preservado`);
    }
    
    console.log("\n=== COMPARACIÓN DE SEGMENTOS DE MUESTRA ===");
    
    // Verificar segmentos de muestra
    initialState.sampleSegments.forEach((initialSegment, index) => {
      const currentSegment = currentTrip.tripData?.find(seg => 
        seg.origin === initialSegment.origin && 
        seg.destination === initialSegment.destination
      );
      
      if (!currentSegment) {
        console.log(`❌ SEGMENTO ${index + 1}: ELIMINADO`);
        console.log(`   ${initialSegment.origin} -> ${initialSegment.destination}`);
        return;
      }
      
      console.log(`\n--- SEGMENTO ${index + 1} ---`);
      console.log(`${initialSegment.origin} -> ${initialSegment.destination}`);
      
      // Comparar campos
      const changes = [];
      
      if (currentSegment.price !== initialSegment.price) {
        changes.push(`price: ${initialSegment.price} → ${currentSegment.price}`);
      }
      
      if (currentSegment.tripId !== initialSegment.tripId) {
        changes.push(`tripId: ${initialSegment.tripId} → ${currentSegment.tripId}`);
      }
      
      if (currentSegment.departureTime !== initialSegment.departureTime) {
        changes.push(`departureTime: ${initialSegment.departureTime} → ${currentSegment.departureTime}`);
      }
      
      if (currentSegment.arrivalTime !== initialSegment.arrivalTime) {
        changes.push(`arrivalTime: ${initialSegment.arrivalTime} → ${currentSegment.arrivalTime}`);
      }
      
      if (changes.length > 0) {
        console.log(`🔄 CAMBIOS DETECTADOS:`);
        changes.forEach(change => console.log(`   ${change}`));
      } else {
        console.log(`✅ Sin cambios`);
      }
    });
    
    console.log("\n=== RESUMEN ===");
    console.log(`Estado: ${currentTotal === initialState.totalSegments ? 'ESTABLE' : 'MODIFICADO'}`);
    console.log(`Fecha de verificación: ${new Date().toLocaleString()}`);
    
  } catch (error) {
    console.error("Error al monitorear cambios:", error);
  }
}

// Ejecutar el monitor
monitorTripChanges();