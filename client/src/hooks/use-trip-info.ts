import { useQuery } from '@tanstack/react-query';

export interface TripInfo {
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  isMainTrip: boolean;
}

export function useTripInfo(tripId: string | null) {
  return useQuery({
    queryKey: ['trip-info', tripId],
    queryFn: async (): Promise<TripInfo | null> => {
      if (!tripId) return null;
      
      // Extraer recordId e índice del tripId (formato: "recordId_índice")
      const [recordId, segmentIndex] = tripId.split('_').map(Number);
      
      if (isNaN(recordId) || isNaN(segmentIndex)) return null;
      
      // Obtener los datos del trip usando el recordId
      const response = await fetch(`/api/trips/${recordId}`);
      if (!response.ok) return null;
      
      const trip = await response.json();
      const tripData = trip.tripData || trip.trip_data;
      
      if (!Array.isArray(tripData) || !tripData[segmentIndex]) return null;
      
      return tripData[segmentIndex];
    },
    enabled: !!tripId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}