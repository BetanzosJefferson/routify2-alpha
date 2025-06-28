import { useQuery } from "@tanstack/react-query";

// Interfaces para manejar la información de los paquetes
export interface Package {
  id: number;
  sender_name: string;
  sender_lastname: string;
  sender_phone: string;
  recipient_name: string;
  recipient_lastname: string;
  recipient_phone: string;
  package_description: string;
  price: number;
  is_paid: boolean;
  payment_method?: string;
  delivery_status: string;
  company_id: string;
  created_by?: number;
  created_at?: string;
  trip_details?: any;
  // Campos adicionales que pueden venir del backend
  origin?: string;
  destination?: string;
  departureDate?: string;
  departureTime?: string;
  arrivalTime?: string;
}

interface UsePackagesOptions {
  tripId?: number;
  enabled?: boolean;
}

interface UsePackagesByTripDetailsOptions {
  tripDetails?: {
    recordId?: string;
    tripId?: string;
    origin?: string;
    destination?: string;
    departureDate?: string;
  };
  enabled?: boolean;
}

export function usePackages(options: UsePackagesOptions = {}) {
  const { tripId, enabled = true } = options;
  
  // Construir la URL con los parámetros de consulta si existen
  let url = '/api/packages';
  const params = new URLSearchParams();
  
  if (tripId) {
    params.append('tripId', tripId.toString());
  }
  
  const queryString = params.toString();
  const fullUrl = queryString ? `${url}?${queryString}` : url;
  
  return useQuery<Package[]>({
    queryKey: ['/api/packages', tripId],
    queryFn: async () => {
      const response = await fetch(fullUrl);
      
      if (!response.ok) {
        throw new Error('Error al cargar las paqueterías');
      }
      
      return response.json();
    },
    enabled: enabled,
  });
}

// Hook específico para obtener paqueterías por detalles de viaje
export function usePackagesByTripDetails(options: UsePackagesByTripDetailsOptions = {}) {
  const { tripDetails, enabled = true } = options;
  
  return useQuery<Package[]>({
    queryKey: ['/api/packages', 'trip-details', tripDetails?.recordId, tripDetails?.tripId],
    queryFn: async () => {
      if (!tripDetails?.recordId && !tripDetails?.tripId) {
        return [];
      }
      
      // Construir la URL con filtros basados en los detalles del viaje
      const params = new URLSearchParams();
      
      if (tripDetails.recordId) {
        params.append('recordId', tripDetails.recordId);
      }
      if (tripDetails.tripId) {
        params.append('tripId', tripDetails.tripId);
      }
      
      const url = `/api/packages?${params.toString()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error('Error al cargar las paqueterías del viaje');
      }
      
      return response.json();
    },
    enabled: enabled && !!(tripDetails?.recordId || tripDetails?.tripId),
    staleTime: 5 * 60 * 1000, // 5 minutos
    refetchOnWindowFocus: false,
  });
}