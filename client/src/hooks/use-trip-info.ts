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

export function useTripInfo(tripId: string | number | null) {
  return useQuery({
    queryKey: ['trip-info', tripId],
    queryFn: async (): Promise<TripInfo | null> => {
      if (!tripId) return null;
      
      let recordId: number;
      let segmentIndex: number;
      
      // Verificar si el tripId es un string con formato "recordId_índice" o solo un número
      if (typeof tripId === 'string' && tripId.includes('_')) {
        // Formato: "recordId_índice"
        const parts = tripId.split('_').map(Number);
        recordId = parts[0];
        segmentIndex = parts[1];
      } else {
        // Formato: número directo (solo recordId)
        recordId = typeof tripId === 'number' ? tripId : parseInt(tripId.toString());
        segmentIndex = 0; // Usar el primer segmento por defecto
      }
      
      if (isNaN(recordId)) return null;
      
      console.log(`[useTripInfo] Consultando trip ${recordId}, segmento ${segmentIndex}`);
      
      // Obtener los datos del trip usando el recordId
      const response = await fetch(`/api/trips/${recordId}`);
      if (!response.ok) {
        console.log(`[useTripInfo] Error al obtener trip ${recordId}: ${response.status}`);
        return null;
      }
      
      const trip = await response.json();
      const tripData = trip.tripData || trip.trip_data;
      
      if (!Array.isArray(tripData)) {
        console.log(`[useTripInfo] Trip ${recordId} no tiene tripData válido`);
        return null;
      }
      
      // Si el segmentIndex está fuera de rango, usar el primer segmento
      const targetSegment = tripData[segmentIndex] || tripData[0];
      
      if (!targetSegment) {
        console.log(`[useTripInfo] Trip ${recordId} no tiene segmento ${segmentIndex}`);
        return null;
      }
      
      console.log(`[useTripInfo] Trip ${recordId} encontrado:`, targetSegment);
      return targetSegment;
    },
    enabled: !!tripId,
    staleTime: 1000 * 60 * 5, // 5 minutos
  });
}