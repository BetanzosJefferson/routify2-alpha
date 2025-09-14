import { QueryClient } from "@tanstack/react-query";
import { initializeOfficialCrossTabCache, cleanupOfficialCrossTabCache } from "./cache-persister";

// Crear un cliente de consulta con configuración optimizada para cross-tab sharing
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 2, // Aumentamos los reintentos a 2
      staleTime: 60000, // Datos considerados válidos por 1 minuto
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