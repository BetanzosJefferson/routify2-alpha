import React, { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  AlertTriangle, 
  AlertCircle, 
  CheckCircle, 
  PercentIcon, 
  DollarSign,
  Calendar,
  User,
  MapPin
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";

interface CommissionsListProps {
  /** Si es true, muestra solo vista de lectura para comisionistas */
  readOnly?: boolean;
  /** Query key adicional para diferenciación */
  queryKeySuffix?: string;
}

export function CommissionsList({ readOnly = false, queryKeySuffix = "" }: CommissionsListProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Estado para las pestañas
  const [commissionTab, setCommissionTab] = useState("pendientes");
  
  // Estado para reservaciones seleccionadas (solo para modo admin)
  const [selectedReservations, setSelectedReservations] = useState<Set<number>>(new Set());

  // Consulta para obtener las reservaciones de comisionistas
  const { data: commissionsData, isLoading, error } = useQuery({
    queryKey: ['/api/commissions/reservations', queryKeySuffix],
    queryFn: async () => {
      const response = await fetch('/api/commissions/reservations');
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al obtener comisiones: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    enabled: !!user
  });

  // Mutación para marcar comisiones como pagadas (solo para admins)
  const markAsPaidMutation = useMutation({
    mutationFn: async (reservationIds: number[]) => {
      return apiRequest("/commissions/pay", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationIds })
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/commissions/reservations'] });
      setSelectedReservations(new Set());
    }
  });

  // Función para formatear moneda
  const formatCurrency = (amount: number): string => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 2
    }).format(amount);
  };

  // Función para formatear fecha
  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString('es-MX');
  };

  // Manejar selección de reservaciones (solo para admins)
  const handleSelectionChange = (reservationId: number, checked: boolean) => {
    if (readOnly) return;
    
    const newSelection = new Set(selectedReservations);
    if (checked) {
      newSelection.add(reservationId);
    } else {
      newSelection.delete(reservationId);
    }
    setSelectedReservations(newSelection);
  };

  // Filtrar comisiones según el estado
  const pendingCommissions = commissionsData?.filter((comm: any) => !comm.createdByUser?.commissionPaid) || [];
  const paidCommissions = commissionsData?.filter((comm: any) => comm.createdByUser?.commissionPaid) || [];

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PercentIcon className="h-5 w-5" />
            {readOnly ? "Mis Comisiones" : "Gestión de Comisiones"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex flex-col space-y-2">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-16 w-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>
          {error instanceof Error ? error.message : 'Error al cargar las comisiones'}
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <Tabs value={commissionTab} onValueChange={setCommissionTab}>
        <CardHeader className="pb-0">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <PercentIcon className="h-5 w-5" />
              {readOnly ? "Mis Comisiones" : "Gestión de Comisiones"}
            </CardTitle>
            {!readOnly && selectedReservations.size > 0 && (
              <Button
                onClick={() => markAsPaidMutation.mutate([...selectedReservations])}
                disabled={markAsPaidMutation.isPending}
                className="ml-auto"
              >
                <DollarSign className="h-4 w-4 mr-2" />
                Marcar como Pagadas ({selectedReservations.size})
              </Button>
            )}
          </div>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="pendientes">
              Pendientes ({pendingCommissions.length})
            </TabsTrigger>
            <TabsTrigger value="pagadas">
              Pagadas ({paidCommissions.length})
            </TabsTrigger>
          </TabsList>
        </CardHeader>
        <CardContent className="pt-6">
          <TabsContent value="pendientes">
            {pendingCommissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <PercentIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay comisiones pendientes</p>
              </div>
            ) : (
              <CommissionItems 
                commissions={pendingCommissions} 
                readOnly={readOnly}
                selectedReservations={selectedReservations}
                onSelectionChange={handleSelectionChange}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            )}
          </TabsContent>
          
          <TabsContent value="pagadas">
            {paidCommissions.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <CheckCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No hay comisiones pagadas</p>
              </div>
            ) : (
              <CommissionItems 
                commissions={paidCommissions} 
                readOnly={readOnly}
                selectedReservations={selectedReservations}
                onSelectionChange={handleSelectionChange}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
              />
            )}
          </TabsContent>
        </CardContent>
      </Tabs>
    </Card>
  );
}

interface CommissionItemsProps {
  commissions: any[];
  readOnly: boolean;
  selectedReservations: Set<number>;
  onSelectionChange: (id: number, checked: boolean) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
}

function CommissionItems({ 
  commissions, 
  readOnly, 
  selectedReservations, 
  onSelectionChange, 
  formatCurrency, 
  formatDate 
}: CommissionItemsProps) {
  return (
    <div className="space-y-4">
      {commissions.map((commission) => (
        <div
          key={commission.id}
          className={cn(
            "border rounded-lg p-4 transition-colors",
            readOnly ? "hover:bg-gray-50" : "hover:bg-blue-50",
            !readOnly && selectedReservations.has(commission.id) && "bg-blue-50 border-blue-200"
          )}
        >
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-3">
              {!readOnly && (
                <Checkbox
                  checked={selectedReservations.has(commission.id)}
                  onCheckedChange={(checked) => 
                    onSelectionChange(commission.id, checked as boolean)
                  }
                />
              )}
              <div>
                <div className="font-medium flex items-center gap-2">
                  <User className="h-4 w-4" />
                  {commission.createdByUser?.firstName} {commission.createdByUser?.lastName}
                </div>
                <div className="text-sm text-gray-500">
                  Comisión: {commission.createdByUser?.commissionPercentage || 0}%
                </div>
              </div>
            </div>
            
            <Badge 
              variant={commission.createdByUser?.commissionPaid ? "default" : "outline"}
              className={cn(
                commission.createdByUser?.commissionPaid 
                  ? "bg-green-100 text-green-800 hover:bg-green-200" 
                  : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
              )}
            >
              {commission.createdByUser?.commissionPaid ? (
                <>
                  <CheckCircle className="mr-1 h-3 w-3" /> Pagada
                </>
              ) : (
                <>
                  <AlertCircle className="mr-1 h-3 w-3" /> Pendiente
                </>
              )}
            </Badge>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-gray-500 mb-1">Ruta</div>
              <div className="font-medium">{commission.trip?.route?.name}</div>
            </div>
            
            <div>
              <div className="text-gray-500 mb-1">Trayecto</div>
              <div className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                <span className="text-xs">
                  {commission.trip?.route?.origin} → {commission.trip?.route?.destination}
                </span>
              </div>
            </div>
            
            <div>
              <div className="text-gray-500 mb-1">Fecha</div>
              <div className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {commission.trip?.departureDate ? formatDate(commission.trip.departureDate) : 'No especificada'}
              </div>
            </div>
            
            <div>
              <div className="text-gray-500 mb-1">Comisión</div>
              <div className="font-semibold text-primary">
                {formatCurrency(
                  (commission.totalAmount || 0) * (commission.createdByUser?.commissionPercentage || 0) / 100
                )}
              </div>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t flex items-center justify-between text-sm">
            <div className="flex items-center gap-4">
              <span>
                <strong>Pasajeros:</strong> {commission.passengers?.length || 0}
              </span>
              <span>
                <strong>Total:</strong> {formatCurrency(commission.totalAmount || 0)}
              </span>
            </div>
            <div className="text-gray-500">
              Reservación #{commission.id}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}