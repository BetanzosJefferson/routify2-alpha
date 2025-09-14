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
      // Fetching reservations for specific trip
      
      // Usar parentTripFilter para obtener todas las reservas del día del viaje padre
      const searchParams = new URLSearchParams();
      if (tripInfo?.departureDate) {
        searchParams.append('date', tripInfo.departureDate);
        searchParams.append('parentTripFilter', 'true');
      }
      
      const response = await fetch(`/api/reservations?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error(`Error fetching reservations: ${response.status}`);
      }
      
      const allReservations = await response.json();
      // Total reservations processed
      
      // Filtrar reservaciones que coincidan con el viaje específico
      const matchingReservations = allReservations.filter((reservation: ReservationWithDetails) => {
        return matchReservationToTrip(reservation, recordId, tripInfo);
      });
      
      // Matching reservations filtered
      return matchingReservations;
    },
    enabled: enabled && !!(recordId || tripInfo),
    staleTime: 60000, // Considerar datos frescos por 1 minuto
    refetchInterval: false, // Desactivar polling automático - usar WebSocket para updates
    refetchOnWindowFocus: false, // Desactivar refetch automático al cambiar tabs
    refetchOnMount: 'always', // Solo refetch si cache está vacío
  });
}

// Función helper para determinar si una reservación coincide con un viaje
function matchReservationToTrip(reservation: ReservationWithDetails, recordId?: string, tripInfo?: any): boolean {
  const reservationTripDetails = reservation.tripDetails;
  
  if (!reservationTripDetails || !recordId) {
    return false;
  }
  
  // SOLO coincidencia EXACTA por recordId - no permitir coincidencias amplias
  const reservationRecordId = reservationTripDetails.recordId?.toString();
  const targetRecordId = recordId.toString();
  
  // Normalizar recordIds - extraer la parte base sin sufijos
  let normalizedReservationId = reservationRecordId;
  let normalizedTargetId = targetRecordId;
  
  if (normalizedReservationId?.includes('_')) {
    normalizedReservationId = normalizedReservationId.split('_')[0];
  }
  
  if (normalizedTargetId.includes('_')) {
    normalizedTargetId = normalizedTargetId.split('_')[0];
  }
  
  // Coincidencia EXACTA del recordId base
  const matches = normalizedReservationId === normalizedTargetId;
  
  if (matches) {
    console.log(`[matchReservationToTrip] Reservation ${reservation.id} matches by recordId:`, { 
      reservationRecordId, 
      targetRecordId, 
      normalizedReservationId, 
      normalizedTargetId 
    });
  }
  
  return matches;
}