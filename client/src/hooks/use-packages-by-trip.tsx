import { useQuery } from "@tanstack/react-query";

interface PackageByTripParams {
  recordId?: string;
  tripInfo?: any;
  enabled?: boolean;
}

export function usePackagesByTrip({ recordId, tripInfo, enabled = true }: PackageByTripParams) {
  return useQuery({
    queryKey: ["packages-by-trip", recordId, tripInfo?.departureDate],
    queryFn: async () => {
      console.log(`[usePackagesByTrip] Fetching packages for trip:`, { recordId, tripInfo });
      
      const response = await fetch('/api/packages');
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
  
  if (!packageTripDetails || !tripInfo) {
    return false;
  }
  
  // 1. Coincidencia exacta por recordId
  if (recordId && packageTripDetails.recordId?.toString() === recordId.toString()) {
    console.log(`[matchPackageToTrip] Package ${pkg.id} matches by recordId:`, recordId);
    return true;
  }
  
  // 2. Coincidencia por tripId base (extraer el número base del tripId)
  if (recordId && packageTripDetails.tripId) {
    const packageBaseId = packageTripDetails.tripId.toString().split('_')[0];
    const tripBaseId = recordId.toString().split('_')[0];
    
    if (packageBaseId === tripBaseId) {
      console.log(`[matchPackageToTrip] Package ${pkg.id} matches by base tripId:`, packageBaseId);
      return true;
    }
  }
  
  // 3. Coincidencia por fecha + origen + destino del viaje padre
  if (tripInfo.departureDate && tripInfo.origin && tripInfo.destination) {
    const dateMatches = packageTripDetails.departureDate === tripInfo.departureDate;
    const originMatches = packageTripDetails.origin === tripInfo.origin;
    const destinationMatches = packageTripDetails.destination === tripInfo.destination;
    
    if (dateMatches && originMatches && destinationMatches) {
      console.log(`[matchPackageToTrip] Package ${pkg.id} matches by date+route`);
      return true;
    }
  }
  
  return false;
}