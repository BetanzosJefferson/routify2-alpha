import { useQuery } from "@tanstack/react-query";
import { Trip, TripWithRouteInfo } from "@shared/schema";
import { useAuth } from "./use-auth";
import { formatDateForApiQuery } from "@/lib/utils";

type UseTripsOptions = {
  enabled?: boolean;
  routeId?: number;
  departureDate?: string;
  searchTerm?: string;
};

// Tipo para la respuesta optimizada del endpoint /api/trips
type OptimizedTripsResponse = {
  trips: TripWithRouteInfo[];
  companies: Record<string, { name: string; logo?: string }>;
};

/**
 * Hook especializado para obtener viajes para cualquier rol de usuario
 */
export function useTrips(options: UseTripsOptions = {}) {
  const { user } = useAuth();
  const { routeId, departureDate, searchTerm, enabled = true } = options;
  
  return useQuery<TripWithRouteInfo[]>({
    queryKey: ["/api/trips", { routeId, departureDate, searchTerm }],
    enabled: enabled, // Allow anonymous access to public trips
    staleTime: 5000,
    refetchInterval: 15000,
    queryFn: async () => {
      try {
        // Construir la URL base
        let url = "/api/trips";
        
        // Añadir parámetros según sea necesario
        const params = new URLSearchParams();
        
        if (routeId) {
          params.append("routeId", routeId.toString());
        }
        
        if (departureDate) {
          // Asegurarnos de que la fecha esté en el formato correcto usando nuestras utilidades
          // Esto evita problemas de zona horaria al enviar la fecha al servidor
          try {
            // Si la fecha ya está en formato YYYY-MM-DD, usarla directamente
            // De lo contrario, normalizarla para asegurar consistencia
            const normalizedDate = departureDate.includes('-') && departureDate.split('-').length === 3
              ? departureDate
              : formatDateForApiQuery(new Date(departureDate));
              
            console.log(`[useTrips] Fecha normalizada para API: ${normalizedDate} (original: ${departureDate})`);
            params.append("date", normalizedDate);
          } catch (e) {
            console.warn(`[useTrips] Error al formatear fecha: ${e}. Usando fecha original.`);
            params.append("date", departureDate);
          }
        }
        
        if (searchTerm) {
          params.append("search", searchTerm);
        }
        
        // Añadir los parámetros a la URL si hay alguno
        if (params.toString()) {
          url += `?${params.toString()}`;
        }
        
        console.log(`[useTrips] Obteniendo viajes: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener viajes: ${response.statusText}`);
        }
        
        const data: OptimizedTripsResponse = await response.json();
        
        // COMPATIBILIDAD: Enriquecer los viajes con información de compañías
        const enrichedTrips = data.trips.map(trip => ({
          ...trip,
          companyName: (trip.companyId && data.companies[trip.companyId]?.name) || trip.companyName,
          companyLogo: (trip.companyId && data.companies[trip.companyId]?.logo) || trip.companyLogo
        }));
        
        console.log(`[useTrips] OPTIMIZADO: Obtenidos ${enrichedTrips.length} viajes únicos (información de ${Object.keys(data.companies).length} compañías)`);
        
        return enrichedTrips;
      } catch (error) {
        console.error("[useTrips] Error al obtener viajes:", error);
        throw error;
      }
    }
  });
}

/**
 * Hook para obtener un viaje específico
 */
export function useTripDetails(tripId?: number) {
  const { user } = useAuth();
  
  return useQuery<TripWithRouteInfo>({
    queryKey: ["/api/trips", tripId],
    enabled: !!user && !!tripId,
    staleTime: 5000,
    refetchInterval: 15000,
    queryFn: async () => {
      try {
        if (!tripId) {
          throw new Error("ID de viaje no proporcionado");
        }
        
        const url = `/api/trips/${tripId}`;
        console.log(`[useTripDetails] Obteniendo detalles del viaje: ${url}`);
        
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Error al obtener detalles del viaje: ${response.statusText}`);
        }
        
        const trip = await response.json();
        console.log(`[useTripDetails] Obtenidos detalles del viaje ${tripId}`);
        
        return trip;
      } catch (error) {
        console.error(`[useTripDetails] Error al obtener detalles del viaje ${tripId}:`, error);
        throw error;
      }
    }
  });
}