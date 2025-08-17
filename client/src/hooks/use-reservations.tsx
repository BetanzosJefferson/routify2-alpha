import { useQuery } from "@tanstack/react-query";
import { Reservation, ReservationWithDetails } from "@shared/schema";
import { useAuth } from "./use-auth";

type UseReservationsOptions = {
  enabled?: boolean;
  tripId?: number;
  includeRelated?: boolean;
  date?: string; // Formato YYYY-MM-DD
  archived?: boolean; // Para obtener reservaciones archivadas
  // OPTIMIZACIÓN P0: Nuevos parámetros de performance
  limit?: number;
  offset?: number;
  search?: string;
};

/**
 * Hook especializado para obtener reservaciones para cualquier rol de usuario
 */
export function useReservations(options: UseReservationsOptions = {}) {
  const { user } = useAuth();
  const { tripId, includeRelated = false, enabled = true, date, archived = false } = options;
  
  // OPTIMIZACIÓN P0: Configuración de performance optimizada
  const limit = options.limit || 50; // Límite por defecto
  const offset = options.offset || 0;
  const search = options.search;
  
  // Por defecto filtrar por últimos 7 días para evitar cargar todas las reservaciones
  const dateFilter = date || (tripId ? undefined : getCurrentDateForFilter());
  
  function getCurrentDateForFilter() {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    return sevenDaysAgo.toISOString().split('T')[0];
  }
  
  return useQuery<ReservationWithDetails[]>({
    queryKey: ["/api/reservations", { tripId, includeRelated, date: dateFilter, archived, limit, offset, search }],
    enabled: !!user && enabled,
    // OPTIMIZACIÓN P1: Cache más inteligente
    staleTime: tripId ? 10000 : 60000, // 10s para viajes específicos, 1min para listados generales
    refetchInterval: tripId ? 15000 : 120000, // Refetch menos agresivo: 15s para viajes, 2min para listados
    refetchOnWindowFocus: true, 
    refetchOnMount: false, // No refetch automático al montar - usar cache si está disponible
    queryFn: async () => {
      try {
        // Construir la URL base
        let url = archived ? "/api/reservations/archived" : "/api/reservations";
        
        // OPTIMIZACIÓN P0: Parámetros optimizados
        const params = new URLSearchParams();
        
        if (tripId) {
          params.append("tripId", tripId.toString());
        }
        
        if (includeRelated) {
          params.append("includeRelated", "true");
        }
        
        // OPTIMIZACIÓN P0: Agregar paginación
        params.append("limit", limit.toString());
        params.append("offset", offset.toString());
        
        // Agregar filtro de fecha (por defecto últimos 7 días)
        if (dateFilter) {
          params.append("date", dateFilter);
        }
        
        // OPTIMIZACIÓN P0: Agregar búsqueda server-side
        if (search && search.trim().length >= 2) {
          params.append("search", search.trim());
        }
        
        // Añadir los parámetros a la URL solo si hay parámetros
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        console.log(`[useReservations] Obteniendo reservaciones${dateFilter ? ` para fecha ${dateFilter}` : ' (todas)'}: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener reservaciones: ${response.statusText}`);
        }
        
        const reservations = await response.json();
        console.log(`[useReservations] Obtenidas ${reservations.length} reservaciones${dateFilter ? ` para ${dateFilter}` : ' (todas)'}`);
        
        return reservations;
      } catch (error) {
        console.error("[useReservations] Error al obtener reservaciones:", error);
        throw error;
      }
    }
  });
}