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
  MapPin,
  Download,
  CalendarDays,
  Eye
} from "lucide-react";
import { cn, formatPrice, generateReservationId } from "@/lib/utils";
import { apiRequest } from "@/lib/queryClient";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

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
    return today.toISOString().split('T')[0];
  });
  const [viewAll, setViewAll] = useState(false);

  // Consulta para obtener las reservaciones de comisionistas
  const { data: commissionsData, isLoading, error } = useQuery({
    queryKey: ['/api/commissions/reservations', queryKeySuffix, filterDate, viewAll],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (!viewAll && filterDate) {
        params.append('date', filterDate);
      }
      if (viewAll) {
        params.append('viewAll', 'true');
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
  const pendingCommissions = commissionsData?.filter((comm: any) => !comm.commissionPaid) || [];
  const paidCommissions = commissionsData?.filter((comm: any) => comm.commissionPaid) || [];

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
          
          {/* Controles de filtro */}
          <div className="flex items-center gap-4 mt-4">
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
  const { toast } = useToast();
  const { user } = useAuth();
  
  // Función para generar boleto 60mm
  const downloadTicket60mm = async (reservation: any) => {
    try {
      toast({
        title: "Generando ticket térmico...",
        description: "Generando boleto de 60mm, por favor espera...",
      });

      const { jsPDF } = await import('jspdf');
      
      // Generar código QR para la reservación
      let qrCodeDataUrl;
      try {
        const verificationUrl = `${window.location.origin}/reservation-details?id=${reservation.id}`;
        qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { width: 100 });
      } catch (error) {
        console.error("Error al generar código QR:", error);
        qrCodeDataUrl = null;
      }
      
      // Crear documento PDF con dimensiones de ticket térmico (58mm x 160mm)
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [58, 160],
      });

      // Configuración de fuentes
      doc.setFont("courier", "normal");
      doc.setFontSize(10);

      // Margen superior
      let y = 10;

      // Encabezado
      doc.setFontSize(12);
      doc.setFont("courier", "bold");
      const companyName = user?.company || "TransRoute";
      const companyNameWidth = doc.getStringUnitWidth(companyName) * 12 / doc.internal.scaleFactor;
      const companyNameX = (58 - companyNameWidth) / 2;
      doc.text(companyName, companyNameX, y);
      
      y += 5;
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      doc.text("Boleto de reservación", 29, y, { align: "center" });
      
      // Línea separadora
      y += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(5, y, 53, y);
      
      // ID de la reservación
      y += 5;
      doc.setFontSize(10);
      doc.setFont("courier", "bold");
      doc.text(`RESERVACIÓN #${generateReservationId(reservation.id)}`, 29, y, { align: "center" });
      
      y += 4;
      doc.setFontSize(8);
      doc.text(format(new Date(reservation.createdAt), "dd/MM/yyyy HH:mm", { locale: es }), 29, y, { align: "center" });
      
      // Información del viaje
      if (reservation.trip) {
        y += 6;
        doc.setFontSize(9);
        doc.setFont("courier", "bold");
        doc.text("Ruta", 5, y);
        
        y += 4;
        doc.setFontSize(8);
        doc.setFont("courier", "normal");
        
        // Origen y destino específicos del trayecto
        const origen = reservation.specificOrigin || reservation.trip.route?.origin || "";
        const destino = reservation.specificDestination || reservation.trip.route?.destination || "";
        const maxWidth = 48;
        
        // Origen
        const origenCompleto = `Origen: ${origen}`;
        if (doc.getStringUnitWidth(origenCompleto) * 8 / doc.internal.scaleFactor > maxWidth) {
          doc.text("Origen:", 5, y);
          y += 3;
          const words = origen.split(' ');
          let line = '';
          for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > maxWidth) {
              doc.text(line, 5, y);
              line = words[i] + ' ';
              y += 3;
            } else {
              line = testLine;
            }
          }
          doc.text(line, 5, y);
          y += 4;
        } else {
          doc.text(origenCompleto, 5, y);
          y += 4;
        }
        
        // Destino
        const destinoCompleto = `Destino: ${destino}`;
        if (doc.getStringUnitWidth(destinoCompleto) * 8 / doc.internal.scaleFactor > maxWidth) {
          doc.text("Destino:", 5, y);
          y += 3;
          const words = destino.split(' ');
          let line = '';
          for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > maxWidth) {
              doc.text(line, 5, y);
              line = words[i] + ' ';
              y += 3;
            } else {
              line = testLine;
            }
          }
          doc.text(line, 5, y);
          y += 4;
        } else {
          doc.text(destinoCompleto, 5, y);
          y += 4;
        }
        
        // Fecha y hora del viaje
        y += 4;
        doc.text(`Fecha: ${reservation.trip.departureDate || 'No especificada'}`, 5, y);
        y += 4;
        doc.text(`Hora: ${reservation.trip.departureTime || 'No especificada'}`, 5, y);
      }

      // Información de pasajeros
      y += 6;
      doc.setFontSize(9);
      doc.setFont("courier", "bold");
      doc.text("Pasajeros", 5, y);
      
      y += 4;
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      
      if (reservation.passengers && reservation.passengers.length > 0) {
        reservation.passengers.forEach((passenger: any) => {
          const passengerName = `${passenger.firstName} ${passenger.lastName}`;
          doc.text(`• ${passengerName}`, 5, y);
          y += 3;
        });
      } else {
        doc.text("No especificado", 5, y);
        y += 3;
      }

      // Información de pago
      y += 6;
      doc.setFontSize(9);
      doc.setFont("courier", "bold");
      doc.text("Pago", 5, y);
      
      y += 4;
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      doc.text(`Total: ${formatPrice(reservation.totalAmount)}`, 5, y);
      y += 3;
      
      if (reservation.advancePayment > 0) {
        doc.text(`Anticipo: ${formatPrice(reservation.advancePayment)}`, 5, y);
        y += 3;
        doc.text(`Restante: ${formatPrice(reservation.remainingBalance)}`, 5, y);
        y += 3;
      }
      
      if (reservation.paymentMethod) {
        doc.text(`Método: ${reservation.paymentMethod}`, 5, y);
        y += 3;
      }

      // Contacto
      y += 6;
      doc.setFontSize(9);
      doc.setFont("courier", "bold");
      doc.text("Contacto", 5, y);
      
      y += 4;
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      
      if (reservation.phone) {
        doc.text(`Tel: ${reservation.phone}`, 5, y);
        y += 3;
      }
      
      if (reservation.email) {
        const emailText = doc.splitTextToSize(`Email: ${reservation.email}`, 48);
        doc.text(emailText, 5, y);
        y += emailText.length * 3;
      }

      // Código QR
      if (qrCodeDataUrl) {
        y += 8;
        const qrX = (58 - 25) / 2; // Centrar el QR (25mm de ancho)
        try {
          doc.addImage(qrCodeDataUrl, 'PNG', qrX, y, 25, 25);
          y += 27;
        } catch (error) {
          console.error("Error al añadir QR al PDF:", error);
          y += 5;
        }
      }

      // Pie de página
      y += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(5, y, 53, y);
      
      y += 4;
      doc.setFontSize(6);
      doc.text("Gracias por su preferencia", 29, y, { align: "center" });

      // Abrir el PDF en una nueva ventana usando about:blank (compatible con Android)
      const pdfWindow = window.open('', '_blank');
      if (pdfWindow) {
        pdfWindow.document.write(`
          <html>
            <head>
              <title>Reservación #${generateReservationId(reservation.id)} - 60mm</title>
              <style>
                body { margin: 0; }
                iframe { width: 100%; height: 100vh; border: none; }
              </style>
            </head>
            <body>
              <iframe src="${doc.output('datauristring')}" type="application/pdf"></iframe>
            </body>
          </html>
        `);
        pdfWindow.document.close();
      }
      
      toast({
        title: "Boleto generado",
        description: `El boleto térmico de 60mm ha sido generado para la reservación #${generateReservationId(reservation.id)}`,
      });
      
    } catch (error) {
      console.error('Error al generar boleto 60mm:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el boleto. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };
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
                  <CheckCircle className="mr-1 h-3 w-3" /> Pagada
                </>
              ) : (
                <>
                  <AlertCircle className="mr-1 h-3 w-3" /> Pendiente
                </>
              )}
            </Badge>
          </div>

          {/* Información principal - optimizada para móvil */}
          <div className="space-y-3">
            <div>
              <div className="text-gray-500 text-xs mb-1">Ruta</div>
              <div className="font-medium text-sm">{commission.trip?.route?.name}</div>
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
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div className="flex items-center gap-4 text-xs">
                <span>
                  <strong>Pasajeros:</strong> {commission.passengers?.length || 0}
                </span>
                <span>
                  <strong>Total:</strong> {formatCurrency(commission.totalAmount || 0)}
                </span>
              </div>
              <div className="text-xs text-gray-500">
                Reservación #{commission.id}
              </div>
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <Button
                onClick={() => downloadTicket60mm(commission)}
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