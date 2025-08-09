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
  Clock,
  User,
  MapPin,
  Download,
  CalendarDays,
  Eye,
  Users,
  CheckSquare,
  XCircle,
  CheckCircle2,
  HelpCircle,
  RefreshCcw
} from "lucide-react";
import { cn, formatPrice, generateReservationId, getCurrentLocalDate } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import { useCommissionTicketGenerator } from "./commission-ticket-generator";
import QRCode from "qrcode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
  
  // Estados para filtros
  const [filterDate, setFilterDate] = useState<string>(() => {
    const today = new Date();
    return getCurrentLocalDate();
  });
  const [viewAll, setViewAll] = useState(false);
  const [selectedCommissioner, setSelectedCommissioner] = useState<string>("todos");

  // Consulta para obtener las reservaciones de comisionistas
  const { data: commissionsData, isLoading, error } = useQuery({
    queryKey: ['/api/commissions/reservations', queryKeySuffix, filterDate, viewAll, selectedCommissioner],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (!viewAll && filterDate) {
        params.append('date', filterDate);
      }
      if (viewAll) {
        params.append('viewAll', 'true');
      }
      if (selectedCommissioner !== "todos") {
        params.append('userId', selectedCommissioner);
      }
      
      const url = `/api/commissions/reservations${params.toString() ? '?' + params.toString() : ''}`;
      const response = await fetch(url);
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al obtener comisiones: ${response.status} ${errorText}`);
      }
      return response.json();
    },
    enabled: !!user
  });

  // Consulta para obtener la lista de comisionistas (solo para admins)
  const { data: commissionersData } = useQuery({
    queryKey: ['/api/users/commissioners'],
    queryFn: async () => {
      const response = await fetch('/api/users/commissioners');
      if (!response.ok) {
        throw new Error('Error al obtener comisionistas');
      }
      return response.json();
    },
    enabled: !!user && !readOnly
  });

  // Mutación para marcar comisiones como pagadas (solo para admins)
  const markAsPaidMutation = useMutation({
    mutationFn: async (reservationIds: number[]) => {
      const response = await fetch("/api/commissions/pay", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reservationIds })
      });
      if (!response.ok) {
        throw new Error("Error al marcar comisiones como pagadas");
      }
      return response.json();
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

  // Función para formatear fecha (evitando problemas de zona horaria)
  const formatDate = (dateString: string): string => {
    if (!dateString) return 'No especificada';
    
    // Si es formato YYYY-MM-DD, procesarlo directamente sin conversión de zona horaria
    if (dateString.match(/^\d{4}-\d{2}-\d{2}$/)) {
      const [year, month, day] = dateString.split('-');
      return `${day}/${month}/${year}`;
    }
    
    // Para otros formatos, usar fecha sin conversión de zona horaria
    try {
      const date = new Date(dateString + 'T00:00:00');
      return date.toLocaleDateString('es-MX');
    } catch (error) {
      console.error('Error formateando fecha:', error);
      return dateString;
    }
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

  // Función para seleccionar todas las comisiones visibles
  const handleSelectAll = () => {
    if (readOnly) return;
    
    const currentCommissions = commissionTab === "pendientes" ? pendingCommissions : paidCommissions;
    const allIds = currentCommissions.map((comm: any) => comm.id);
    setSelectedReservations(new Set(allIds));
  };

  // Función para deseleccionar todas las comisiones
  const handleDeselectAll = () => {
    if (readOnly) return;
    setSelectedReservations(new Set());
  };

  // Calcular total de comisiones seleccionadas
  const calculateSelectedTotal = () => {
    if (!validCommissions || selectedReservations.size === 0) return 0;
    
    const selectedCommissions = validCommissions.filter((comm: any) => 
      selectedReservations.has(comm.id)
    );
    
    return selectedCommissions.reduce((total: number, comm: any) => {
      // Obtener el monto total de la reservación
      const totalAmount = comm.totalAmount || comm.monto || 0;
      
      // Obtener el porcentaje de comisión del usuario creador
      const commissionPercentage = comm.createdByUser?.commissionPercentage || 10; // Default 10%
      
      // Calcular el monto de la comisión
      const commissionAmount = totalAmount * (commissionPercentage / 100);
      
      console.log(`[calculateSelectedTotal] Reservación ${comm.id}: monto=${totalAmount}, porcentaje=${commissionPercentage}%, comisión=${commissionAmount}`);
      
      return total + commissionAmount;
    }, 0);
  };

  // Filtrar comisiones válidas: solo reservaciones confirmadas y pagadas
  const validCommissions = commissionsData?.filter((comm: any) => {
    // Excluir reservaciones canceladas
    if (comm.status === "canceled") {
      return false;
    }
    
    // Excluir reservaciones con pago cancelado (reembolso)
    if (comm.paymentStatus === "cancelado") {
      return false;
    }
    
    // Excluir reservaciones pendientes de cobro
    if (comm.paymentStatus === "pendiente") {
      return false;
    }
    
    // Solo incluir reservaciones con pago confirmado
    return comm.paymentStatus === "pagado";
  }) || [];

  // Filtrar comisiones según el estado de comisión (pagada o pendiente)
  const pendingCommissions = validCommissions.filter((comm: any) => {
    console.log(`[DEBUG] Comisión ${comm.id}: commissionPaid=${comm.commissionPaid}, typeof=${typeof comm.commissionPaid}`);
    return !comm.commissionPaid;
  });
  const paidCommissions = validCommissions.filter((comm: any) => comm.commissionPaid);

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
            <div className="flex items-center gap-2">
              {!readOnly && selectedReservations.size > 0 && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">
                    Total seleccionado: {formatCurrency(calculateSelectedTotal())}
                  </span>
                  <Button
                    onClick={() => markAsPaidMutation.mutate(Array.from(selectedReservations))}
                    disabled={markAsPaidMutation.isPending}
                  >
                    <DollarSign className="h-4 w-4 mr-2" />
                    Marcar como Pagadas ({selectedReservations.size})
                  </Button>
                </div>
              )}
            </div>
          </div>
          
          {/* Controles de filtro */}
          <div className="space-y-3 mt-4">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2">
                <Label htmlFor="filter-date" className="text-sm">
                  Filtrar por fecha:
                </Label>
                <Input
                  id="filter-date"
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    setViewAll(false);
                  }}
                  disabled={viewAll}
                  className="w-40"
                />
              </div>
              
              {!readOnly && commissionersData && (
                <div className="flex items-center gap-2">
                  <Label htmlFor="filter-commissioner" className="text-sm">
                    Comisionista:
                  </Label>
                  <Select value={selectedCommissioner} onValueChange={setSelectedCommissioner}>
                    <SelectTrigger className="w-48">
                      <SelectValue placeholder="Seleccionar comisionista" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="todos">Todos los comisionistas</SelectItem>
                      {commissionersData.map((commissioner: any) => (
                        <SelectItem key={commissioner.id} value={commissioner.id.toString()}>
                          {commissioner.firstName} {commissioner.lastName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <Button
                onClick={() => setViewAll(!viewAll)}
                variant={viewAll ? "default" : "outline"}
                size="sm"
                className="gap-2"
              >
                <Eye className="h-4 w-4" />
                {viewAll ? "Filtrar por fecha" : "Ver todas mis comisiones"}
              </Button>
            </div>

            {!readOnly && (
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleSelectAll}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <CheckSquare className="h-4 w-4" />
                  Seleccionar todo
                </Button>
                <Button
                  onClick={handleDeselectAll}
                  variant="outline"
                  size="sm"
                  className="gap-2"
                >
                  <Users className="h-4 w-4" />
                  Deseleccionar todo
                </Button>
              </div>
            )}
          </div>
          
          <TabsList className="grid w-full grid-cols-2 mt-4">
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
                {validCommissions.length === 0 && (
                  <p className="text-sm mt-2">
                    Solo se muestran reservaciones confirmadas y pagadas
                  </p>
                )}
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
                {validCommissions.length === 0 && (
                  <p className="text-sm mt-2">
                    Solo se muestran reservaciones confirmadas y pagadas
                  </p>
                )}
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
  const { toast } = useToast();
  const { user } = useAuth();
  const { downloadTicket60mm } = useCommissionTicketGenerator();
  
  // Función para obtener el badge de estado de la reservación
  const getReservationStatusBadge = (commission: any) => {
    const status = commission.status;
    const paymentStatus = commission.paymentStatus;
    
    if (status === "canceled") {
      return (
        <Badge variant="destructive" className="text-xs">
          <XCircle className="mr-1 h-3 w-3" />
          Cancelada
        </Badge>
      );
    }
    
    if (paymentStatus === "cancelado") {
      return (
        <Badge variant="destructive" className="text-xs">
          <RefreshCcw className="mr-1 h-3 w-3" />
          Con Reembolso
        </Badge>
      );
    }
    
    if (paymentStatus === "pagado") {
      return (
        <Badge variant="default" className="bg-green-100 text-green-800 text-xs">
          <CheckCircle2 className="mr-1 h-3 w-3" />
          Pagado
        </Badge>
      );
    }
    
    if (paymentStatus === "pendiente") {
      return (
        <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
          <HelpCircle className="mr-1 h-3 w-3" />
          Pendiente Cobro
        </Badge>
      );
    }
    
    return null;
  };
  
  // Función para generar boleto 60mm
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
                <div className="text-sm text-gray-500">
                  Comisión: {commission.createdByUser?.commissionPercentage || 0}%
                </div>
              </div>
            </div>
            
            <div className="flex flex-col gap-2">
              <Badge 
                variant={commission.commissionPaid ? "default" : "outline"}
                className={cn(
                  commission.commissionPaid 
                    ? "bg-green-100 text-green-800 hover:bg-green-200" 
                    : "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                )}
              >
                {commission.commissionPaid ? (
                  <>
                    <CheckCircle className="mr-1 h-3 w-3" /> Comisión pagada
                  </>
                ) : (
                  <>
                    <AlertCircle className="mr-1 h-3 w-3" /> Comisión pendiente
                  </>
                )}
              </Badge>
              {getReservationStatusBadge(commission)}
            </div>
          </div>

          {/* Información principal - optimizada para móvil */}
          <div className="space-y-3">
            {/* Información del pasajero principal */}
            <div>
              <div className="text-gray-500 text-xs mb-1">Nombre</div>
              <div className="flex items-center gap-2">
                <User className="h-3 w-3" />
                <span className="font-medium text-sm">
                  {commission.passengers && commission.passengers.length > 0 
                    ? `${commission.passengers[0].firstName} ${commission.passengers[0].lastName}`
                    : 'Sin información del pasajero'
                  }
                </span>
                <Badge variant="secondary" className="text-xs">
                  {commission.passengers?.length || 0} pasajero{commission.passengers?.length !== 1 ? 's' : ''}
                </Badge>
              </div>
            </div>
        
            <div>
              <div className="text-gray-500 text-xs mb-1">Trayecto</div>
              <div className="flex items-start gap-1">
                <MapPin className="h-3 w-3 mt-0.5 flex-shrink-0" />
                <span className="text-xs leading-tight break-words">
                  {commission.trip?.route?.origin} → {commission.trip?.route?.destination}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  <span className="text-xs">
                    {commission.trip?.departureDate ? formatDate(commission.trip.departureDate) : 'No especificada'}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  <span className="text-xs">
                    {commission.trip?.departureTime || 'Hora no especificada'}
                  </span>
                </div>
                <div className="text-xs">
                  <strong>Comisión:</strong> {formatCurrency(
                    (commission.totalAmount || 0) * (commission.createdByUser?.commissionPercentage || 0) / 100
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Información adicional y acciones - optimizada para móvil */}
          <div className="mt-3 pt-3 border-t space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
             
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                <span>
                  <strong>Total:</strong> {formatCurrency(commission.totalAmount || 0)}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" />
                <span className="text-gray-500">
                  Reservación #{commission.id}
                </span>
              </div>
            </div>
            
            {/* Información del comisionista */}
            <div className="text-xs bg-gray-50 p-2 rounded">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">
                  <strong>Comisionista:</strong> {commission.createdByUser?.firstName} {commission.createdByUser?.lastName}
                </span>
              
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => downloadTicket60mm(commission, user?.company || "TransRoute")}
                size="sm"
                variant="outline"
                className="gap-2 w-full sm:w-auto"
              >
                <Download className="h-4 w-4" />
                Descargar Boleto
              </Button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}