import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

interface PackageByTripParams {
  recordId?: string;
  tripInfo?: any;
  enabled?: boolean;
}

export function usePackagesByTrip({ recordId, tripInfo, enabled = true }: PackageByTripParams) {
  const { user } = useAuth();
  
  return useQuery({
    queryKey: ["packages-by-trip", recordId, tripInfo?.departureDate, user?.role],
    queryFn: async () => {
      console.log(`[usePackagesByTrip] Fetching packages for trip:`, { recordId, tripInfo });
      
      // Usar endpoint específico para taquilla, chofer o endpoint general
      const endpoint = (user?.role === 'taquilla' || user?.role === 'chofer') ? '/api/taquilla/packages' : '/api/packages';
      
      const response = await fetch(endpoint);
      if (!response.ok) {
        throw new Error(`Error fetching packages: ${response.status}`);
      }
      
      const allPackages = await response.json();
      console.log(`[usePackagesByTrip] Total packages received:`, allPackages.length);
      
      // Filtrar paquetes que coincidan con el viaje
      const matchingPackages = allPackages.filter((pkg: any) => {
        return matchPackageToTrip(pkg, recordId, tripInfo);
      });
      
      console.log(`[usePackagesByTrip] Matching packages found:`, matchingPackages.length);
      return matchingPackages;
    },
    enabled: enabled && !!(recordId || tripInfo),
    staleTime: 30000, // 30 segundos
  });
}

// Función helper para determinar si un paquete coincide con un viaje
function matchPackageToTrip(pkg: any, recordId?: string, tripInfo?: any): boolean {
  const packageTripDetails = pkg.tripDetails;
  
  if (!packageTripDetails) {
    return false;
  }
  
  // 1. Coincidencia exacta por recordId
  if (recordId && packageTripDetails.recordId?.toString() === recordId.toString()) {
    console.log(`[matchPackageToTrip] Package ${pkg.id} matches by recordId:`, recordId);
    return true;
  }
  
  // 2. Coincidencia por tripId completo (incluyendo segmento si existe)
  if (recordId && packageTripDetails.tripId) {
    const packageTripId = packageTripDetails.tripId.toString();
    const currentTripId = recordId.toString();
    
    // Comparación exacta del tripId completo
    if (packageTripId === currentTripId) {
      console.log(`[matchPackageToTrip] Package ${pkg.id} matches by exact tripId:`, packageTripId);
      return true;
    }
    
    // Si el paquete tiene un tripId base y el viaje actual también, compararlos
    const packageBaseId = packageTripId.split('_')[0];
    const currentBaseId = currentTripId.split('_')[0];
    
    // Solo coincidir por base ID si ambos tienen el mismo ID base Y el mismo segmento (o ningún segmento)
    if (packageBaseId === currentBaseId) {
      const packageSegment = packageTripId.includes('_') ? packageTripId.split('_')[1] : null;
      const currentSegment = currentTripId.includes('_') ? currentTripId.split('_')[1] : null;
      
      // Solo coincidir si los segmentos también coinciden (o ambos son null)
      if (packageSegment === currentSegment) {
        console.log(`[matchPackageToTrip] Package ${pkg.id} matches by base tripId with segment:`, packageBaseId, 'segment:', packageSegment);
        return true;
      }
    }
  }
  
  return false;
}