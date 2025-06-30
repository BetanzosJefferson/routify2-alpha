import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

// Interfaces para manejar la información de los paquetes
export interface Package {
  id: number;
  tripId: number;
  senderName: string;
  senderLastName: string;
  senderPhone: string;
  recipientName: string;
  recipientLastName: string;
  recipientPhone: string;
  packageDescription: string;
  price: number;
  isPaid: boolean;
  paymentMethod: string;
  deliveryStatus: string;
  companyId: string;
  createdBy: number;
  createdAt?: string;
}

interface UsePackagesOptions {
  tripId?: number;
  enabled?: boolean;
}

export function usePackages(options: UsePackagesOptions = {}) {
  const { tripId, enabled = true } = options;
  const { user } = useAuth();
  
  // Usar endpoint específico para taquilla o endpoint general
  const baseUrl = user?.role === 'taquilla' ? '/api/taquilla/packages' : '/api/packages';
  
  // Construir la URL con los parámetros de consulta si existen
  const params = new URLSearchParams();
  
  if (tripId) {
    params.append('tripId', tripId.toString());
  }
  
  const queryString = params.toString();
  const fullUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;
  
  return useQuery<Package[]>({
    queryKey: [baseUrl, tripId, user?.role],
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