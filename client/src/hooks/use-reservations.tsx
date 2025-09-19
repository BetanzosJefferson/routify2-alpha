import { useQuery } from "@tanstack/react-query";
import { Reservation, ReservationWithDetails } from "@shared/schema";
import { useAuth } from "./use-auth";
import { queryKeys } from "@/lib/query-keys";

type UseReservationsOptions = {
  enabled?: boolean;
  tripId?: number;
  includeRelated?: boolean;
  date?: string; // Formato YYYY-MM-DD
  archived?: boolean; // Para obtener reservaciones archivadas
  parentTripFilter?: boolean; // Para usar filtro por viaje padre (incluye sub-viajes)
};

/**
 * Hook especializado para obtener reservaciones para cualquier rol de usuario
 */
export function useReservations(options: UseReservationsOptions = {}) {
  const { user } = useAuth();
  const { tripId, includeRelated = false, enabled = true, date, archived = false, parentTripFilter = false } = options;
  
  // Solo usar filtro de fecha si se proporciona explícitamente
  const dateFilter = date;
  
  return useQuery<ReservationWithDetails[]>({
    queryKey: queryKeys.reservations.filtered({
      tripId, 
      includeRelated, 
      date: dateFilter, 
      archived, 
      parentTripFilter 
    }),
    enabled: !!user && enabled,
    staleTime: 90000, // OPTIMIZACIÓN: 90 segundos para balance performance/frescura
    refetchInterval: false, // Desactivar polling automático - usar WebSocket para updates
    refetchOnWindowFocus: true, // Mantener refetch en focus para actualizaciones importantes
    refetchOnMount: false, // OPTIMIZACIÓN: evitar refetch innecesario al montar
    queryFn: async () => {
      try {
        // Construir la URL base - USAR ENDPOINT OPTIMIZADO para resolver N+1 problem
        let url = archived ? "/api/reservations/archived" : "/api/reservations-optimized";
        
        // Añadir parámetros según sea necesario
        const params = new URLSearchParams();
        
        if (tripId) {
          params.append("tripId", tripId.toString());
        }
        
        if (includeRelated) {
          params.append("includeRelated", "true");
        }
        
        // Agregar filtro de fecha solo si se especifica
        if (dateFilter) {
          params.append("date", dateFilter);
        }
        
        // Agregar filtro por viaje padre si se especifica
        if (parentTripFilter) {
          params.append("parentTripFilter", "true");
        }
        
        // OPTIMIZACIÓN: Agregar paginación básica
        // TODO: Implementar paginación completa en próxima iteración
        
        // Añadir los parámetros a la URL solo si hay parámetros
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        // Processing reservations request
        // Fetching reservations
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener reservaciones: ${response.statusText}`);
        }
        
        const reservations = await response.json();
        // Reservations fetched successfully
        
        return reservations;
      } catch (error) {
        console.error("[useReservations] Error al obtener reservaciones:", error);
        throw error;
      }
    }
  });
}