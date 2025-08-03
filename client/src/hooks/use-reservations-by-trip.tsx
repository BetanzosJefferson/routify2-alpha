import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { ReservationWithDetails } from "@shared/schema";

interface ReservationsByTripParams {
  recordId?: string;
  tripInfo?: any;
  enabled?: boolean;
}

export function useReservationsByTrip({ recordId, tripInfo, enabled = true }: ReservationsByTripParams) {
  const { user } = useAuth();
  
  return useQuery<ReservationWithDetails[]>({
    queryKey: ["reservations-by-trip", recordId, tripInfo?.departureDate, user?.role],
    queryFn: async () => {
      console.log(`[useReservationsByTrip] Fetching reservations for trip:`, { recordId, tripInfo });
      
      const response = await fetch('/api/reservations');
      if (!response.ok) {
        throw new Error(`Error fetching reservations: ${response.status}`);
      }
      
      const allReservations = await response.json();
      console.log(`[useReservationsByTrip] Total reservations received:`, allReservations.length);
      
      // Filtrar reservaciones que coincidan con el viaje
      const matchingReservations = allReservations.filter((reservation: ReservationWithDetails) => {
        return matchReservationToTrip(reservation, recordId, tripInfo);
      });
      
      console.log(`[useReservationsByTrip] Matching reservations found:`, matchingReservations.length);
      return matchingReservations;
    },
    enabled: enabled && !!(recordId || tripInfo),
    staleTime: 0, // Datos siempre frescos para actualizaciones en tiempo real
    refetchInterval: 30000, // Actualizar cada 30 segundos automáticamente
    refetchOnWindowFocus: true, // Actualizar cuando el usuario regrese a la ventana
    refetchOnMount: true, // Siempre actualizar al montar el componente
  });
}

// Función helper para determinar si una reservación coincide con un viaje
function matchReservationToTrip(reservation: ReservationWithDetails, recordId?: string, tripInfo?: any): boolean {
  const reservationTripDetails = reservation.tripDetails;
  
  if (!reservationTripDetails) {
    return false;
  }
  
  // 1. Coincidencia exacta por recordId
  if (recordId && reservationTripDetails.recordId?.toString() === recordId.toString()) {
    console.log(`[matchReservationToTrip] Reservation ${reservation.id} matches by recordId:`, recordId);
    return true;
  }
  
  // 2. Coincidencia por tripId completo (incluyendo segmento si existe)
  if (recordId && reservationTripDetails.tripId) {
    const reservationTripId = reservationTripDetails.tripId.toString();
    const currentTripId = recordId.toString();
    
    // Comparación exacta del tripId completo
    if (reservationTripId === currentTripId) {
      console.log(`[matchReservationToTrip] Reservation ${reservation.id} matches by exact tripId:`, reservationTripId);
      return true;
    }
    
    // Si la reservación tiene un tripId base y el viaje actual también, compararlos
    const reservationBaseId = reservationTripId.split('_')[0];
    const currentBaseId = currentTripId.split('_')[0];
    
    // Solo coincidir por base ID si ambos tienen el mismo ID base
    if (reservationBaseId === currentBaseId) {
      const reservationSegment = reservationTripId.includes('_') ? reservationTripId.split('_')[1] : null;
      const currentSegment = currentTripId.includes('_') ? currentTripId.split('_')[1] : null;
      
      // Coincidir si:
      // 1. Los segmentos son exactamente iguales, O
      // 2. El viaje actual no tiene segmento (es el viaje principal) y la reservación sí tiene segmento
      if (reservationSegment === currentSegment || (currentSegment === null && reservationSegment !== null)) {
        console.log(`[matchReservationToTrip] Reservation ${reservation.id} matches by base tripId:`, reservationBaseId, 'reservationSegment:', reservationSegment, 'currentSegment:', currentSegment);
        return true;
      }
    }
  }
  
  return false;
}