import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";

export interface Package {
  id: number;
  tripId: number;
  senderName: string;
  senderPhone: string;
  recipientName: string;
  recipientPhone: string;
  description: string;
  weight: number;
  fragile: boolean;
  amount: number;
  isPaid: boolean;
  paymentMethod: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  status: string;
  companyId?: string;
  createdBy?: number;
  paidBy?: number;
  deliveredBy?: number;
  tripOrigin?: string;
  tripDestination?: string;
  segmentOrigin?: string;
  segmentDestination?: string;
  createdByUser?: { firstName: string; lastName: string };
  paidByUser?: { firstName: string; lastName: string };
  deliveredByUser?: { firstName: string; lastName: string };
}

export function useTripPackages(tripId: number) {
  const { user } = useAuth();
  
  // Usar endpoint específico para taquilla o endpoint general
  const baseUrl = user?.role === 'taquilla' ? '/api/taquilla/packages' : '/api/packages';
  
  return useQuery({
    queryKey: [baseUrl, tripId, user?.role],
    queryFn: async (): Promise<Package[]> => {
      const response = await fetch(`${baseUrl}?tripId=${tripId}`);
      if (!response.ok) {
        throw new Error("Failed to fetch packages");
      }
      return response.json();
    },
    enabled: !!tripId,
  });
}