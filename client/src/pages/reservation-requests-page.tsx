import { useEffect, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { useTripInfo } from "@/hooks/use-trip-info";
import { useLocation } from "wouter";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sidebar } from "@/components/layout/sidebar";
import { Topbar } from "@/components/layout/topbar";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { formatPrice, generateReservationId } from "@/lib/utils";
import QRCode from "qrcode";
import { Check, X, CalendarIcon, CreditCard, MapPin, Phone, User, Printer } from "lucide-react";
import { TabType } from "@/hooks/use-active-tab";

// Función auxiliar para extraer solo el nombre de la ciudad de la dirección completa
function extractCityName(fullAddress?: string): string {
  if (!fullAddress) return "";
  
  // Retornar el valor completo en lugar de solo la ciudad
  return fullAddress;
}

// Interfaz para el tipo de solicitud de reservación
interface ReservationRequest {
  id: number;
  data: any; // JSON con todos los datos de la solicitud
  requesterId: number;
  requesterName?: string;
  companyId: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  reviewedBy: number | null;
  reviewNotes: string | null;
  reviewedAt: string | null;
  
  // Información adicional que puede venir del join
  tripOrigin?: string;
  tripDestination?: string;
  tripDate?: string;
  tripDepartureTime?: string;
  isSubTrip?: boolean;
  parentTripId?: number | null;
  segmentOrigin?: string;
  segmentDestination?: string;
}

export default function ReservationRequestsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [location] = useLocation();
  const [activeTab, setActiveTab] = useState<string>("pending");
  const [selectedRequest, setSelectedRequest] = useState<ReservationRequest | null>(null);
  const [isReviewDialogOpen, setIsReviewDialogOpen] = useState<boolean>(false);
  const [reviewNotes, setReviewNotes] = useState<string>("");
  const [highlightedRequestId, setHighlightedRequestId] = useState<number | null>(null);

  // Efecto para manejar parámetros de URL desde notificaciones
  useEffect(() => {
    const urlParams = new URLSearchParams(location.split('?')[1] || '');
    const requestId = urlParams.get('requestId');
    
    if (requestId) {
      const id = parseInt(requestId);
      if (!isNaN(id)) {
        setHighlightedRequestId(id);
        setActiveTab("pending"); // Cambiar a pestaña pendientes para mostrar la solicitud
        
        // Limpiar el highlighting después de 3 segundos
        setTimeout(() => {
          setHighlightedRequestId(null);
        }, 3000);
      }
    }
  }, [location]);

  // Consulta para obtener solicitudes de reservación
  const { data: requests, isLoading, refetch } = useQuery<ReservationRequest[]>({
    queryKey: ["/api/reservation-requests", activeTab],
    queryFn: async () => {
      const url = `/api/reservation-requests${activeTab === "pending" ? "?status=pendiente" : ""}`;
      const response = await apiRequest("GET", url);
      return await response.json();
    },
  });

  // Mutación para aprobar/rechazar solicitudes
  const updateRequestMutation = useMutation({
    mutationFn: async ({ id, status, reviewNotes }: { id: number; status: string; reviewNotes?: string }) => {
      const response = await apiRequest("POST", `/api/reservation-requests/${id}/update-status`, {
        status,
        reviewNotes: reviewNotes || ""
      });
      return await response.json();
    },
    onSuccess: (data) => {
      // Invalidar las solicitudes de reservación para actualizar la lista
      queryClient.invalidateQueries({ queryKey: ["/api/reservation-requests"] });
      
      // Invalidar también las consultas de viajes para actualizar los asientos disponibles en tiempo real
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      // Invalidar las reservaciones
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      
      console.log("Solicitud procesada correctamente. Actualizando datos en tiempo real...");
      
      refetch();
      setSelectedRequest(null);
      setIsReviewDialogOpen(false);
      setReviewNotes("");
      
      // Mostrar un mensaje diferente según si se aprobó o rechazó
      const actionText = data.request?.status === "aprobada" ? "aprobada" : "rechazada";
      
      toast({
        title: `Solicitud ${actionText}`,
        description: `La solicitud ha sido ${actionText} correctamente.`,
        variant: "default",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error al procesar la solicitud",
        description: error.message || "Ha ocurrido un error. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  });

  const handleApprove = async () => {
    if (!selectedRequest) return;

    // La transacción se creará automáticamente cuando se apruebe la solicitud
    console.log(`[handleApprove] Aprobando solicitud ${selectedRequest.id}. La transacción se creará automáticamente si hay anticipo.`);
    
    // Proceder con la aprobación normal
    updateRequestMutation.mutate({ 
      id: selectedRequest.id, 
      status: "aprobada", 
      reviewNotes 
    });
  };

  const handleReject = () => {
    if (!selectedRequest) return;
    updateRequestMutation.mutate({ 
      id: selectedRequest.id, 
      status: "rechazada", 
      reviewNotes 
    });
  };

  const openReviewDialog = (request: ReservationRequest) => {
    setSelectedRequest(request);
    setReviewNotes("");
    setIsReviewDialogOpen(true);
  };

  // Filtrar solicitudes por estado
  const pendingRequests = requests?.filter(req => req.status === "pendiente") || [];
  const processedRequests = requests?.filter(req => req.status !== "pendiente") || [];

  // Función para el cambio de pestañas en el sidebar
  const [, setLocation] = useLocation();
  const [sidebarActiveTab, setSidebarActiveTab] = useState<TabType>("reservation-requests");
  
  const handleTabChange = (tab: TabType) => {
    // Redirigir al dashboard con la pestaña seleccionada utilizando wouter
    setLocation(`/?tab=${tab}`);
  };

  // Componente de contenido de solicitudes de reservación
  function ReservationRequestsContent() {
    return (
      <div className="container mx-auto py-6 px-4 md:px-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-3xl font-bold">Solicitudes de Reservación</h1>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="mb-4">
            <TabsTrigger value="pending" className="relative">
              Pendientes
              {pendingRequests.length > 0 && (
                <Badge className="ml-2 bg-primary text-white" variant="outline">
                  {pendingRequests.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="processed">Procesadas</TabsTrigger>
          </TabsList>

          <TabsContent value="pending">
            {isLoading ? (
              <div className="flex justify-center my-12">
                <Spinner size="md" />
              </div>
            ) : pendingRequests.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-muted-foreground">No hay solicitudes pendientes.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingRequests.map((request) => (
                  <RequestCard 
                    key={request.id} 
                    request={request} 
                    onReview={openReviewDialog}
                    isHighlighted={highlightedRequestId === request.id}
                  />
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="processed">
            {isLoading ? (
              <div className="flex justify-center my-12">
                <Spinner size="md" />
              </div>
            ) : processedRequests.length === 0 ? (
              <Card>
                <CardContent className="py-10 text-center">
                  <p className="text-muted-foreground">No hay solicitudes procesadas.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {processedRequests.map((request) => (
                  <RequestCard 
                    key={request.id} 
                    request={request} 
                    isProcessed 
                  />
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Diálogo de revisión */}
        <Dialog open={isReviewDialogOpen} onOpenChange={setIsReviewDialogOpen}>
          <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Revisar Solicitud de Reservación</DialogTitle>
              <DialogDescription>
                Revisa los detalles y selecciona si deseas aprobar o rechazar esta
                solicitud.
              </DialogDescription>
            </DialogHeader>

            {selectedRequest && (() => {
              const requestData = selectedRequest.data || {};
              const tripDetails = requestData.trip_details || {};
              const passengers = requestData.passengers || [];
              const passengerNames = passengers.map((p: any) => 
                `${p.firstName || ''} ${p.lastName || ''}`.trim()
              ).filter(Boolean);
              
              // Extraer información del viaje usando tripId
              const tripId = tripDetails.tripId; // Formato: "recordId_índice"
              const { data: tripInfo, isLoading: tripInfoLoading } = useTripInfo(tripId);
              
              return (
                <div className="space-y-6 py-4">
                  {/* Resumen del viaje */}
                  <div className="bg-muted/40 p-4 rounded-lg space-y-2">
                    <h3 className="font-semibold text-base">Detalles del Viaje</h3>

                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center">
                        <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div>
                          <span className="font-medium">Ruta:</span>{" "}
                          <span className="text-muted-foreground">
                            {tripInfoLoading ? (
                              "Cargando información..."
                            ) : tripInfo ? (
                              `${extractCityName(tripInfo.origin)} - ${extractCityName(tripInfo.destination)}`
                            ) : (
                              "Información no disponible"
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div>
                          <span className="font-medium">Fecha y hora:</span>{" "}
                          <span className="text-muted-foreground">
                            {tripInfoLoading ? (
                              "Cargando información..."
                            ) : tripInfo ? (
                              `${tripInfo.departureDate} • ${tripInfo.departureTime}`
                            ) : (
                              "Información no disponible"
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-start">
                        <User className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground mt-0.5" />
                        <div>
                          <span className="font-medium">Asientos:</span>{" "}
                          <span className="text-muted-foreground">
                            {passengers.length}
                          </span>
                          {passengerNames.length > 0 && (
                            <div className="mt-1 text-xs text-muted-foreground">
                              {passengerNames.map((name, index) => (
                                <div key={index} className="mb-0.5">
                                  • {name}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Información de pagos */}
                  <div className="bg-muted/40 p-4 rounded-lg space-y-2">
                    <h3 className="font-semibold text-base">Información de Pago</h3>

                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center">
                        <CreditCard className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div>
                          <span className="font-medium">Total:</span>{" "}
                          <span className="text-muted-foreground font-semibold">
                            {formatPrice(requestData.total_amount || 0)}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <CreditCard className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div>
                          <span className="font-medium">Método de pago:</span>{" "}
                          <span className="text-muted-foreground">
                            {requestData.payment_method === "efectivo"
                              ? "Efectivo"
                              : "Transferencia"}
                          </span>
                        </div>
                      </div>

                      {(requestData.advance_amount || 0) > 0 && (
                        <>
                          <div className="flex items-center">
                            <CreditCard className="mr-2 h-4 w-4 flex-shrink-0 text-green-500" />
                            <div>
                              <span className="font-medium">Anticipo:</span>{" "}
                              <span className="text-muted-foreground">
                                {formatPrice(requestData.advance_amount || 0)} (
                                {requestData.advance_payment_method === "efectivo"
                                  ? "Efectivo"
                                  : "Transferencia"}
                                )
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center">
                            <CreditCard className="mr-2 h-4 w-4 flex-shrink-0 text-blue-500" />
                            <div>
                              <span className="font-medium">Restante:</span>{" "}
                              <span className="text-muted-foreground">
                                {formatPrice((requestData.total_amount || 0) - (requestData.advance_amount || 0))} (
                                {requestData.payment_method === "efectivo"
                                  ? "Efectivo"
                                  : "Transferencia"}
                                )
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Información del solicitante */}
                  <div className="bg-muted/40 p-4 rounded-lg space-y-2">
                    <h3 className="font-semibold text-base">Información del Solicitante</h3>
                    <div className="grid grid-cols-1 gap-2 text-sm">
                      <div className="flex items-center">
                        <User className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div>
                          <span className="font-medium">Solicitado por:</span>{" "}
                          <span className="text-muted-foreground">
                            {selectedRequest.requesterName || `Agente #${selectedRequest.requesterId}`}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <Phone className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                        <div>
                          <span className="font-medium">Teléfono:</span>{" "}
                          <span className="text-muted-foreground">
                            {requestData.phone || "No especificado"}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center">
                        <span className="mr-2 flex-shrink-0">📧</span>
                        <div>
                          <span className="font-medium">Email:</span>{" "}
                          <span className="text-muted-foreground">
                            {requestData.email || "No especificado"}
                          </span>
                        </div>
                      </div>

                      {requestData.notes && (
                        <div className="flex items-start">
                          <span className="mr-2 flex-shrink-0 mt-0.5">📝</span>
                          <div>
                            <span className="font-medium">Notas:</span>{" "}
                            <span className="text-muted-foreground">
                              {requestData.notes}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}

            {selectedRequest && (
              <>
                {/* Notas de revisión */}
                <div className="space-y-2">
                  <Label>Notas sobre la revisión (opcional)</Label>
                  <Textarea
                    placeholder="Escribe algún comentario si es necesario"
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                  />
                </div>
              </>
            )}

            <DialogFooter className="flex justify-between sm:justify-between">
              <Button
                type="button"
                variant="destructive"
                onClick={handleReject}
                disabled={updateRequestMutation.isPending}
              >
                <X className="mr-2 h-4 w-4" /> Rechazar
              </Button>
              <Button
                type="button"
                onClick={handleApprove}
                disabled={updateRequestMutation.isPending}
              >
                <Check className="mr-2 h-4 w-4" /> Aprobar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    );
  }
  
  // Layout principal
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar activeTab={sidebarActiveTab} onTabChange={handleTabChange} />
      
      <div className="flex flex-col flex-1 w-0 overflow-hidden">
        <Topbar />
        
        <div className="flex-1 overflow-auto focus:outline-none">
          <main className="relative z-0 flex-1 overflow-y-auto">
            <ReservationRequestsContent />
          </main>
        </div>
      </div>
    </div>
  );
}

interface RequestCardProps {
  request: ReservationRequest;
  isProcessed?: boolean;
  onReview?: (request: ReservationRequest) => void;
  isHighlighted?: boolean;
}

function RequestCard({ request, isProcessed, onReview, isHighlighted }: RequestCardProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Extraer datos de la solicitud desde el campo JSON
  const requestData = request.data || {};
  const tripDetails = requestData.trip_details || {};
  const passengers = requestData.passengers || [];
  
  // Obtener información real del viaje
  const tripId = tripDetails.tripId;
  const { data: tripInfo, isLoading: tripInfoLoading } = useTripInfo(tripId);
  
  // Formatear fechas
  const formattedCreatedAt = format(new Date(request.createdAt), "dd MMM yyyy, HH:mm", { locale: es });
  const formattedReviewedAt = request.reviewedAt 
    ? format(new Date(request.reviewedAt), "dd MMM yyyy, HH:mm", { locale: es }) 
    : null;

  // Verificar si el usuario actual puede revisar esta solicitud
  // Un usuario no puede revisar sus propias solicitudes
  const canReview = user && user.id !== request.requesterId;
  
  // Extraer información de pagos
  const totalAmount = requestData.total_amount || 0;
  const advanceAmount = requestData.advance_amount || 0;
  const advancePaymentMethod = requestData.advance_payment_method || '';
  const paymentMethod = requestData.payment_method || '';
  
  // Nombres de pasajeros
  const passengerNames = passengers.map((p: any) => 
    `${p.firstName || ''} ${p.lastName || ''}`.trim()
  ).filter(Boolean);
  
  // Información de contacto
  const email = requestData.email || '';
  const phone = requestData.phone || '';
  const notes = requestData.notes || null;
  
  // Estado con colores
  const getStatusBadge = () => {
    switch (request.status) {
      case "pendiente":
        return <Badge variant="outline" className="bg-yellow-100 text-yellow-800 border-yellow-300">Pendiente</Badge>;
      case "aprobada":
        return <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">Aprobada</Badge>;
      case "rechazada":
        return <Badge variant="outline" className="bg-red-100 text-red-800 border-red-300">Rechazada</Badge>;
      default:
        return <Badge>{request.status}</Badge>;
    }
  };

  // Función para generar boleto 60mm (formato térmico como paquetes)
  const downloadTicket60mm = async () => {
    try {
      toast({
        title: "Generando ticket térmico...",
        description: "Generando boleto de 60mm, por favor espera...",
      });

      const { jsPDF } = await import('jspdf');
      
      // Generar código QR para la reservación
      let qrCodeDataUrl;
      try {
        const verificationUrl = `${window.location.origin}/reservation-request/${request.id}`;
        qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { width: 100 });
      } catch (error) {
        console.error("Error al generar código QR:", error);
        qrCodeDataUrl = null;
      }
      
      // Crear documento PDF con dimensiones de ticket térmico (58mm x 160mm)
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [58, 160], // Mismo formato que paquetes
      });

      // Configuración de fuentes (igual que paquetes)
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
      
      // ID de la solicitud
      y += 5;
      doc.setFontSize(10);
      doc.setFont("courier", "bold");
      doc.text(`SOLICITUD #${request.id}`, 29, y, { align: "center" });
      
      y += 4;
      doc.setFontSize(8);
      doc.text(format(new Date(request.createdAt), "dd/MM/yyyy HH:mm", { locale: es }), 29, y, { align: "center" });
      
      // Información del viaje
      if (tripInfo) {
        y += 6;
        doc.setFontSize(9);
        doc.setFont("courier", "bold");
        doc.text("Ruta", 5, y);
        
        y += 4;
        doc.setFontSize(8);
        doc.setFont("courier", "normal");
        
        // Origen con ajuste de texto
        const origen = tripInfo.origin || "";
        const origenCompleto = `Origen: ${origen}`;
        const maxWidthOrigen = 48; // Ancho máximo en mm
        
        if (doc.getStringUnitWidth(origenCompleto) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
          doc.text("Origen:", 5, y);
          y += 3;
          const words = origen.split(' ');
          let line = '';
          for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
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
        
        // Destino con ajuste de texto
        const destino = tripInfo.destination || "";
        const destinoCompleto = `Destino: ${destino}`;
        
        if (doc.getStringUnitWidth(destinoCompleto) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
          doc.text("Destino:", 5, y);
          y += 3;
          const words = destino.split(' ');
          let line = '';
          for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
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
        doc.text(`Fecha: ${tripInfo.departureDate}`, 5, y);
        y += 4;
        doc.text(`Hora: ${tripInfo.departureTime}`, 5, y);
      }

      // Información de pasajeros
      y += 6;
      doc.setFontSize(9);
      doc.setFont("courier", "bold");
      doc.text("Pasajeros", 5, y);
      
      y += 4;
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      
      if (passengerNames.length > 0) {
        passengerNames.forEach(name => {
          doc.text(`• ${name}`, 5, y);
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
      doc.text(`Total: ${formatPrice(totalAmount)}`, 5, y);
      y += 3;
      
      if (advanceAmount > 0) {
        doc.text(`Anticipo: ${formatPrice(advanceAmount)}`, 5, y);
        y += 3;
        doc.text(`Restante: ${formatPrice(totalAmount - advanceAmount)}`, 5, y);
        y += 3;
        
        if (advancePaymentMethod) {
          doc.text(`Método anticipo: ${advancePaymentMethod}`, 5, y);
          y += 3;
        }
        
        if (paymentMethod) {
          doc.text(`Método abordo: ${paymentMethod}`, 5, y);
          y += 3;
        }
      } else {
        if (paymentMethod) {
          doc.text(`Método: ${paymentMethod}`, 5, y);
          y += 3;
        }
      }

      // Contacto
      y += 6;
      doc.setFontSize(9);
      doc.setFont("courier", "bold");
      doc.text("Contacto", 5, y);
      
      y += 4;
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      doc.text(`Tel: ${phone}`, 5, y);
      y += 3;
      
      const emailText = doc.splitTextToSize(`Email: ${email}`, 48);
      doc.text(emailText, 5, y);
      y += emailText.length * 3;

      // Código QR
      if (qrCodeDataUrl) {
        y += 8;
        const qrX = (58 - 25) / 2; // Centrar el QR (25mm de ancho)
        try {
          doc.addImage(qrCodeDataUrl, 'PNG', qrX, y, 25, 25);
          y += 27; // Espacio para el QR + margen
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

      // Abrir en nueva ventana para imprimir (igual que paquetes)
      window.open(URL.createObjectURL(doc.output('blob')));
      
      toast({
        title: "Boleto generado",
        description: `El boleto térmico de 60mm ha sido generado para la solicitud #${request.id}`,
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
    <Card className={`${request.status === "rechazada" ? "border-red-200 bg-red-50" : ""} ${isHighlighted ? "ring-2 ring-blue-500 ring-opacity-50 bg-blue-50/30 transition-all duration-500" : ""}`}>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div>
            <CardTitle className="text-xl flex items-center">
              Solicitud #{request.id} 
              <span className="ml-3">{getStatusBadge()}</span>
            </CardTitle>
            <CardDescription>
              {formattedCreatedAt}
            </CardDescription>
          </div>
          {!isProcessed && onReview && canReview && (
            <Button onClick={() => onReview(request)}>
              Revisar
            </Button>
          )}
          {!isProcessed && onReview && !canReview && (
            <div className="text-xs text-muted-foreground italic">
              No puedes revisar tu propia solicitud
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <div className="flex items-start text-sm">
              <MapPin className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                {tripInfoLoading ? (
                  <div className="text-muted-foreground">Cargando información...</div>
                ) : tripInfo ? (
                  <>
                    <div className="break-words">
                      {extractCityName(tripInfo.origin)}
                    </div>
                    <div className="text-xs text-muted-foreground">↓</div>
                    <div className="break-words">
                      {extractCityName(tripInfo.destination)}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="break-words text-muted-foreground">
                      Origen no especificado
                    </div>
                    <div className="text-xs text-muted-foreground">↓</div>
                    <div className="break-words text-muted-foreground">
                      Destino no especificado
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="flex items-center text-sm">
              <CalendarIcon className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span>
                {tripInfoLoading ? (
                  "Cargando información..."
                ) : tripInfo ? (
                  `${tripInfo.departureDate} • ${tripInfo.departureTime}`
                ) : (
                  "Fecha no especificada • Hora no especificada"
                )}
              </span>
            </div>
            <div className="flex items-center text-sm">
              <User className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span>
                Solicitado por{" "}
                <span className="font-medium">{request.requesterName || `Usuario #${request.requesterId}`}</span>
              </span>
            </div>
          </div>
          <div className="space-y-3">
            <div className="flex items-center text-sm">
              <CreditCard className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span>Total: <strong>{formatPrice(totalAmount)}</strong></span>
            </div>
            
            {/* Información de anticipo */}
            {advanceAmount > 0 && (
              <div className="flex items-center text-sm">
                <CreditCard className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground text-green-500" />
                <span>
                  Anticipo: <strong>{formatPrice(advanceAmount)}</strong> ({advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                </span>
              </div>
            )}
            
            {/* Método de pago restante */}
            {advanceAmount > 0 && advanceAmount < totalAmount && (
              <div className="flex items-center text-sm">
                <CreditCard className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground text-blue-500" />
                <span>
                  Restante: <strong>{formatPrice(totalAmount - advanceAmount)}</strong> ({paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                </span>
              </div>
            )}
            
            <div className="flex items-center text-sm">
              <User className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <div className="flex flex-col">
                <span>{passengers.length} asientos</span>
                {passengerNames.length > 0 && (
                  <span className="text-xs text-muted-foreground mt-1">
                    {passengerNames.join(', ')}
                  </span>
                )}
              </div>
            </div>
            
            <div className="flex items-center text-sm">
              <Phone className="mr-2 h-4 w-4 flex-shrink-0 text-muted-foreground" />
              <span className="truncate">{phone}</span>
            </div>
            
            <div className="flex items-center text-sm">
              <span className="mr-2 flex-shrink-0">📧</span>
              <span className="truncate">{email}</span>
            </div>
          </div>
        </div>
        
        {notes && (
          <div className="text-sm mt-2">
            <p className="font-medium">Notas:</p>
            <p className="text-muted-foreground">{notes}</p>
          </div>
        )}
        
        {/* Información de revisión para solicitudes procesadas */}
        {isProcessed && (
          <div className="text-sm mt-2 pt-4 border-t border-border">
            <p className="font-medium">Revisado el {formattedReviewedAt}</p>
            {request.reviewNotes && (
              <p className="text-muted-foreground">{request.reviewNotes}</p>
            )}
          </div>
        )}
        
        {/* Botón de descarga de boleto 60mm para comisionistas en solicitudes aprobadas */}
        {isProcessed && 
         request.status === "aprobada" && 
         user?.role === "comisionista" && (
          <div className="mt-4 pt-4 border-t border-border">
            <Button 
              onClick={downloadTicket60mm}
              variant="outline"
              size="sm"
              className="bg-blue-50 hover:bg-blue-100 text-blue-700 border-blue-200"
            >
              <Printer className="mr-2 h-4 w-4" />
              Descargar Boleto 60mm
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}