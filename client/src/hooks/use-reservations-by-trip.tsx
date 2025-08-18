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
      console.log(`[useReservationsByTrip] Total reservations received:`, allReservations.length);
      
      // Filtrar reservaciones que coincidan con el viaje específico
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