/**
 * Helper puro para recalcular la disponibilidad de asientos por segmento
 * basándose únicamente en reservaciones activas y nueva capacidad.
 * 
 * Implementa la lógica compleja donde A-C afecta tanto A-B como B-C
 * usando la regla de "minimum over subsegments".
 */

interface ReservationForCalculation {
  status: string;
  tripDetails: any;
  passengers: any;
}

interface TripSegment {
  origin: string;
  destination: string;
  availableSeats: number;
  tripId: string;
  [key: string]: any;
}

interface RouteStop {
  name: string;
  order: number;
}

/**
 * Recalcula la disponibilidad de asientos para todos los segmentos
 * basándose únicamente en reservaciones activas.
 * ARREGLADO: Ahora maneja correctamente los tripId padre vs. sub-trip IDs
 */
export function recomputeSegmentAvailability(
  tripData: TripSegment[],
  route: { stops?: string[] } | null,
  reservations: ReservationForCalculation[],
  newCapacity: number
): TripSegment[] {
  
  // Estados que ocupan asientos activamente
  const OCCUPYING_STATUSES = ['confirmed', 'paid', 'checked_in', 'boarded'];
  
  // Si no hay datos de ruta, usar fallback simple
  if (!route?.stops) {
    console.log('[recomputeSegmentAvailability] Sin datos de ruta, usando cálculo simple');
    return tripData.map(segment => {
      // ARREGLADO: Buscar reservaciones que afecten este segmento
      const segmentReservations = reservations.filter(r => {
        if (!OCCUPYING_STATUSES.includes(r.status)) return false;
        
        const tripDetails = r.tripDetails as any;
        const reservationTripId = tripDetails?.tripId;
        
        // Coincidencia exacta con el segmento O si es reservación del trip completo que incluya este segmento
        return reservationTripId === segment.tripId?.toString() || 
               reservationTripId?.includes(segment.tripId?.toString()) ||
               // Si es una reservación de sub-trip que referencia este segmento por paradas
               (tripDetails && segment.origin && segment.destination &&
                reservationTripId?.includes('_')); // Es sub-trip format
      });
      
      const occupiedSeats = segmentReservations.reduce((sum, r) => {
        const tripDetails = r.tripDetails as any;
        const passengers = r.passengers as any;
        return sum + (tripDetails?.seats || passengers?.length || 0);
      }, 0);
      
      return {
        ...segment,
        availableSeats: Math.max(0, newCapacity - occupiedSeats)
      };
    });
  }

  console.log('[recomputeSegmentAvailability] Recalculando con lógica compleja de subsegmentos');
  
  // Crear mapa de paradas con índices
  const stopMap = new Map<string, number>();
  route.stops.forEach((stop, index) => {
    stopMap.set(stop, index);
  });

  // Calcular ocupación por subsegmento atómico (entre paradas consecutivas)
  const subsegmentOccupancy = new Array(route.stops.length - 1).fill(0);
  
  // Procesar todas las reservaciones activas
  reservations.forEach(reservation => {
    if (!OCCUPYING_STATUSES.includes(reservation.status)) return;
    
    const tripDetails = reservation.tripDetails as any;
    const seats = tripDetails?.seats || 0;
    
    if (seats <= 0) return;
    
    console.log(`[recomputeSegmentAvailability] Procesando reservación: tripId=${tripDetails?.tripId}, seats=${seats}`);
    
    // ARREGLADO: Encontrar el segmento usando la lógica correcta de matching
    const reservationTripId = tripDetails?.tripId;
    
    // Si es formato sub-trip (ej: "1291_98"), extraer información del segmento
    let segment;
    if (reservationTripId?.includes('_')) {
      // Formato sub-trip: buscar por tripId exacto primero
      segment = tripData.find(s => s.tripId?.toString() === reservationTripId);
      
      if (!segment) {
        // Si no encuentra por ID exacto, podría ser una reservación A-C que afecta múltiples segmentos
        console.log(`[recomputeSegmentAvailability] Sub-trip ${reservationTripId} no encontrado en segmentos exactos`);
        return;
      }
    } else {
      // Reservación del trip padre: encontrar segmento principal o usar el primero
      segment = tripData.find(s => s.isMainTrip) || tripData[0];
    }
    
    if (!segment) {
      console.log(`[recomputeSegmentAvailability] No se encontró segmento para reservación ${reservationTripId}`);
      return;
    }
    
    // Obtener índices de origen y destino
    const originIndex = stopMap.get(segment.origin);
    const destinationIndex = stopMap.get(segment.destination);
    
    if (originIndex === undefined || destinationIndex === undefined) return;
    
    // Marcar ocupación en todos los subsegmentos que esta reservación utiliza
    const startIdx = Math.min(originIndex, destinationIndex);
    const endIdx = Math.max(originIndex, destinationIndex);
    
    for (let i = startIdx; i < endIdx; i++) {
      subsegmentOccupancy[i] += seats;
    }
  });

  console.log('[recomputeSegmentAvailability] Ocupación por subsegmento:', subsegmentOccupancy);

  // Recalcular availableSeats para cada segmento usando min-over-subsegments
  return tripData.map(segment => {
    const originIndex = stopMap.get(segment.origin);
    const destinationIndex = stopMap.get(segment.destination);
    
    if (originIndex === undefined || destinationIndex === undefined) {
      console.warn(`[recomputeSegmentAvailability] No se encontraron índices para ${segment.origin} → ${segment.destination}`);
      return { ...segment, availableSeats: newCapacity };
    }
    
    const startIdx = Math.min(originIndex, destinationIndex);
    const endIdx = Math.max(originIndex, destinationIndex);
    
    // Encontrar el cuello de botella: el subsegmento más ocupado en esta ruta
    let maxOccupancy = 0;
    for (let i = startIdx; i < endIdx; i++) {
      maxOccupancy = Math.max(maxOccupancy, subsegmentOccupancy[i]);
    }
    
    const availableSeats = Math.max(0, newCapacity - maxOccupancy);
    
    console.log(`[recomputeSegmentAvailability] Segmento ${segment.origin} → ${segment.destination}: ocupación máxima ${maxOccupancy}, asientos disponibles: ${availableSeats}`);
    
    return {
      ...segment,
      availableSeats
    };
  });
}