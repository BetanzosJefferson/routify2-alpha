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
      // Buscar reservaciones para este segmento específico
      const segmentReservations = reservations.filter(r => {
        const tripDetails = r.tripDetails as any;
        return OCCUPYING_STATUSES.includes(r.status) && tripDetails?.tripId === segment.tripId;
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
    const passengers = reservation.passengers as any;
    const seats = tripDetails?.seats || passengers?.length || 0;
    
    if (seats <= 0) return;
    
    // Encontrar el segmento correspondiente a esta reservación
    const reservationTripId = tripDetails?.tripId;
    const segment = tripData.find(s => s.tripId === reservationTripId);
    
    if (!segment) return;
    
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