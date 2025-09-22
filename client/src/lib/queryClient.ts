import { QueryClient } from "@tanstack/react-query";
import { initializeOfficialCrossTabCache, cleanupOfficialCrossTabCache } from "./cache-persister";

// Crear un cliente de consulta con configuración optimizada para cross-tab sharing
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: true, // OPTIMIZACIÓN: Mantener refetch en focus
      retry: 2, // Aumentamos los reintentos a 2
      staleTime: 5000, // CRÍTICO: 5 segundos para datos críticos (reservaciones y viajes cambian frecuentemente)
      gcTime: 10 * 60 * 1000, // Mantener en caché por 10 minutos (antes llamado cacheTime)
      // Asegurar que datos compartidos entre secciones estén disponibles
      structuralSharing: true,
    },
  },
});

/**
 * Inicializar cache cross-tab sharing oficial
 */
export async function initializeCrossTabCache() {
  return await initializeOfficialCrossTabCache(queryClient);
}

/**
 * Limpiar cache cross-tab sharing oficial
 */
export function cleanupCrossTabCache() {
  cleanupOfficialCrossTabCache();
}

// Función para pre-cargar datos importantes al iniciar la aplicación
export async function prefetchCriticalData() {
  try {
    // Pre-cargar rutas (necesarias en casi todas las secciones)
    queryClient.prefetchQuery({
      queryKey: ["/api/routes"],
      staleTime: 5 * 60 * 1000, // 5 minutos - las rutas cambian con poca frecuencia
    });
    
    // Pre-cargar viajes (usados en múltiples secciones)
    queryClient.prefetchQuery({
      queryKey: ["/api/trips"],
      staleTime: 2 * 60 * 1000, // 2 minutos - los viajes pueden cambiar más
    });
    
    // Pre-cargar reservaciones (necesarias en varias secciones)
    queryClient.prefetchQuery({
      queryKey: ["/api/reservations"],
      staleTime: 60 * 1000, // 1 minuto - las reservaciones cambian con frecuencia
    });
    
    console.log("Datos críticos pre-cargados correctamente");
  } catch (error) {
    console.error("Error pre-cargando datos críticos:", error);
    // No propagar el error, permitir que la aplicación continúe
  }
}

// Remove duplicate function definition since it's already defined below

/**
 * Sistema unificado de invalidación de caché
 * Resuelve el problema de datos no actualizados en tiempo real
 */
export const cacheInvalidation = {
  // Invalidar todas las reservaciones (más agresivo)
  allReservations: async () => {
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.includes('reservations');
      }
    });
  },

  // Invalidar reservaciones específicas por parámetros
  reservationsByParams: async (params: { tripId?: number; date?: string; archived?: boolean } = {}) => {
    await Promise.all([
      // Invalidar consultas exactas
      queryClient.invalidateQueries({
        queryKey: ["/api/reservations", params]
      }),
      // Invalidar todas las variantes relacionadas
      queryClient.invalidateQueries({
        predicate: (query) => {
          const [endpoint, queryParams] = query.queryKey;
          return endpoint === "/api/reservations" && 
                 (!params.tripId || (queryParams as any)?.tripId === params.tripId) &&
                 (!params.date || (queryParams as any)?.date === params.date);
        }
      })
    ]);
  },

  // Invalidar trips relacionados (para actualizar asientos disponibles)
  relatedTrips: async (tripId?: number) => {
    if (tripId) {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const [endpoint, params] = query.queryKey;
          return endpoint === "/api/trips" || 
                 endpoint === "/api/admin-trips" ||
                 (params as any)?.tripId === tripId;
        }
      });
    } else {
      await queryClient.invalidateQueries({
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && (key.includes('trips') || key.includes('admin-trips'));
        }
      });
    }
  },

  // Invalidación completa tras mutaciones críticas (crear/eliminar reservaciones)
  fullRefresh: async (includedData: { reservations?: boolean; trips?: boolean; packages?: boolean } = {}) => {
    const { reservations = true, trips = true, packages = false } = includedData;
    
    console.log("🔄 Iniciando invalidación completa de cache...");
    
    const invalidations = [];
    
    if (reservations) {
      // Invalidación más agresiva para reservaciones
      invalidations.push(
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === 'string' && key.includes('reservations');
          }
        }),
        // También remover queries de reservaciones del cache para forzar refetch
        queryClient.removeQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === 'string' && key.includes('reservations');
          }
        })
      );
    }
    
    if (trips) {
      // Invalidación más agresiva para viajes
      invalidations.push(
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === 'string' && key.includes('trips');
          }
        }),
        // También remover queries de trips para forzar refetch
        queryClient.removeQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === 'string' && key.includes('trips');
          }
        })
      );
    }
    
    if (packages) {
      invalidations.push(
        queryClient.invalidateQueries({
          predicate: (query) => {
            const key = query.queryKey[0];
            return typeof key === 'string' && key.includes('packages');
          }
        })
      );
    }

    await Promise.all(invalidations);
    console.log("✅ Cache completamente invalidado y removido - datos ultra-frescos garantizados");
  }
};

/**
 * Helper function for API requests with proper error handling
 */
export async function apiRequest(
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
  url: string,
  data?: any
) {
  const options: RequestInit = {
    method,
    headers: {
      "Content-Type": "application/json",
    },
    credentials: "include", // Importante: incluir cookies en la petición
  };

  if (data) {
    options.body = JSON.stringify(data);
  }

  const response = await fetch(url, options);

  // Los códigos 2xx indican éxito, incluyendo el 204 (No Content)
  if (!response.ok) {
    let errorMessage = `Error ${response.status}: ${response.statusText}`;
    try {
      const error = await response.json();
      if (error.message || error.error) {
        errorMessage = error.message || error.error;
      }
    } catch (e) {
      // If we can't parse the error, just use the status text
    }
    
    throw new Error(errorMessage);
  }

  return response;
}