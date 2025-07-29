import { useQuery } from "@tanstack/react-query";

export interface BitacoraTrip {
  recordId: number;
  tripInfo: {
    id: number;
    tripData: any;
    capacity: number;
    origin: string;
    destination: string;
    routeName: string;
    driverName: string;
    vehicleInfo: string;
  };
  reservations: any[];
  packages: any[];
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
  passengerCount: number;
  packageCount: number;
}

export interface BitacoraSummary {
  totalPorVender: number;
  ventasReales: number;
  totalTrips: number;
  totalPassengers: number;
  totalPackages: number;
}

export interface BitacoraData {
  trips: BitacoraTrip[];
  summary: BitacoraSummary;
}

// Hook optimizado para obtener datos de Bitácora usando endpoint unificado
export function useBitacoraOptimized(date: string) {
  console.log(`[useBitacoraOptimized] Solicitando datos para fecha: ${date}`);
  
  return useQuery<BitacoraData>({
    queryKey: ['/api/bitacora', date],
    enabled: !!date,
    staleTime: 30000, // 30 segundos
    refetchOnWindowFocus: true,
    refetchInterval: 60000, // Actualizar cada minuto
    meta: {
      description: "Datos optimizados de Bitácora"
    }
  });
}

// Hook para comparar performance (temporal)
export function useBitacoraLegacy(date: string) {
  console.log(`[useBitacoraLegacy] Datos legacy para comparación de performance`);
  
  return {
    data: null,
    isLoading: false,
    error: null,
    isPlaceholderData: false,
    isSuccess: false
  };
}