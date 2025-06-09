import { useQuery } from "@tanstack/react-query";
import { Reservation, ReservationWithDetails } from "@shared/schema";
import { useAuth } from "./use-auth";

type UseReservationsOptions = {
  enabled?: boolean;
  tripId?: number;
  includeRelated?: boolean;
  date?: string; // Formato YYYY-MM-DD
  archived?: boolean; // Filtrar reservaciones archivadas (fecha anterior)
  canceled?: boolean; // Filtrar reservaciones canceladas
};

/**
 * Hook especializado para obtener reservaciones para cualquier rol de usuario
 */
export function useReservations(options: UseReservationsOptions = {}) {
  const { user } = useAuth();
  const { tripId, includeRelated = false, enabled = true, date, archived, canceled } = options;
  
  return useQuery<ReservationWithDetails[]>({
    queryKey: ["/api/reservations", { tripId, includeRelated, date, archived, canceled }],
    enabled: !!user && enabled,
    staleTime: 5000,
    refetchInterval: 15000,
    queryFn: async () => {
      try {
        // Construir la URL base
        let url = "/api/reservations";
        
        // Añadir parámetros según sea necesario
        const params = new URLSearchParams();
        
        if (tripId) {
          params.append("tripId", tripId.toString());
        }
        
        if (includeRelated) {
          params.append("includeRelated", "true");
        }
        
        // Agregar filtro de fecha solo si se especifica
        if (date) {
          params.append("date", date);
        }
        
        // Agregar filtros de archivadas y canceladas
        if (archived) {
          params.append("archived", "true");
        }
        
        if (canceled) {
          params.append("canceled", "true");
        }
        
        // Añadir los parámetros a la URL solo si hay parámetros
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        const filterDesc = archived ? ' archivadas' : canceled ? ' canceladas' : date ? ` para fecha ${date}` : ' (todas)';
        console.log(`[useReservations] Obteniendo reservaciones${filterDesc}: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener reservaciones: ${response.statusText}`);
        }
        
        const reservations = await response.json();
        console.log(`[useReservations] Obtenidas ${reservations.length} reservaciones${filterDesc}`);
        
        return reservations;
      } catch (error) {
        console.error("[useReservations] Error al obtener reservaciones:", error);
        throw error;
      }
    }
  });
}