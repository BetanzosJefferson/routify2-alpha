import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import { Loader2, CheckCircle, XCircle, ArrowLeft, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { hasRequiredRole } from "@/lib/role-based-permissions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import ReservationCanceledModal from "@/components/reservations/reservation-canceled-modal";

export default function ReservationDetails({ params }: { params?: { id?: string } }) {
  const [_, setLocation] = useLocation();
  const { toast } = useToast();
  const { user } = useAuth();
  const [reservationId, setReservationId] = useState<number | null>(null);
  const [isMarkingAsPaid, setIsMarkingAsPaid] = useState(false);
  const [isCanceledModalOpen, setIsCanceledModalOpen] = useState(false);
  const [hasAttemptedCheck, setHasAttemptedCheck] = useState(false);
  const [isCanceling, setIsCanceling] = useState(false);
  const [isCancelingWithRefund, setIsCancelingWithRefund] = useState(false);
  const [crossUserRefundDialog, setCrossUserRefundDialog] = useState<{
    isOpen: boolean;
    message: string;
    creators: string;
  }>({
    isOpen: false,
    message: '',
    creators: ''
  });

  // Extraer el ID de la reservación de los parámetros de ruta
  useEffect(() => {
    // Primero intentamos obtener el ID de los parámetros de ruta
    if (params?.id) {
      setReservationId(parseInt(params.id, 10));
    } else {
      // Si no está en los parámetros de ruta, intentamos usar los parámetros de consulta
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get("id");
      if (id) {
        setReservationId(parseInt(id, 10));
      }
    }
  }, [params]);

  // Cargar los detalles de la reservación usando el endpoint público
  const { data: reservation, isLoading, error, refetch } = useQuery({
    queryKey: ["/api/public/reservations", reservationId],
    queryFn: async () => {
      if (!reservationId) return null;
      const response = await fetch(`/api/public/reservations/${reservationId}`);
      if (!response.ok) {
        throw new Error("Error al cargar los detalles de la reservación");
      }
      return response.json();
    },
    enabled: !!reservationId,
  });

  // Mutación para verificar automáticamente el ticket
  const checkTicketMutation = useMutation({
    mutationFn: async () => {
      if (!reservationId || !user) return null;
      
      const response = await apiRequest("POST", `/api/reservations/${reservationId}/check`);
      if (!response.ok) {
        const errorData = await response.json();
        if (errorData.isAlreadyChecked) {
          return { isAlreadyChecked: true, message: errorData.message };
        }
        throw new Error(errorData.message || "Error al verificar el ticket");
      }
      return response.json();
    },
    onSuccess: (data) => {
      if (!data) return;
      
      if (data.isAlreadyChecked) {
        // No mostrar alerta si ya estaba verificado
        return;
      }
      
      // Mostrar alerta de éxito
      toast({
        title: "¡Ticket Verificado!",
        description: "El ticket ha sido escaneado y verificado correctamente.",
        variant: "default",
      });
      
      // Refrescar los datos para mostrar el estado actualizado
      refetch();
    },
    onError: (error) => {
      // Solo mostrar error si no es porque ya está verificado
      if (error instanceof Error && !error.message.includes('ya ha sido verificado')) {
        toast({
          title: "Error al verificar ticket",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  // Efecto para intentar verificar automáticamente el ticket cuando se carga
  useEffect(() => {
    console.log('[FRONTEND DEBUG] useEffect ejecutándose');
    console.log('[FRONTEND DEBUG] user:', !!user, user ? `ID: ${user.id}, Company: ${user.company}` : 'null');
    console.log('[FRONTEND DEBUG] reservation:', !!reservation, reservation ? `ID: ${reservation.id}, checkedBy: ${reservation.checkedBy}` : 'null');
    console.log('[FRONTEND DEBUG] hasAttemptedCheck:', hasAttemptedCheck);
    
    if (user && reservation && !reservation.checkedBy && !hasAttemptedCheck) {
      console.log('[FRONTEND DEBUG] Todas las condiciones cumplidas, ejecutando verificación automática');
      setHasAttemptedCheck(true);
      checkTicketMutation.mutate();
    } else {
      console.log('[FRONTEND DEBUG] Condiciones NO cumplidas para verificación automática');
      if (!user) console.log('[FRONTEND DEBUG] - No hay usuario');
      if (!reservation) console.log('[FRONTEND DEBUG] - No hay reservación');
      if (reservation && reservation.checkedBy) console.log('[FRONTEND DEBUG] - Ticket ya verificado por:', reservation.checkedBy);
      if (hasAttemptedCheck) console.log('[FRONTEND DEBUG] - Ya se intentó verificar anteriormente');
    }
  }, [user, reservation, hasAttemptedCheck]);


  // Función para marcar como pagado
  const markAsPaid = async () => {
    if (!reservationId || !user) return;
    
    // Verificar si la reservación está cancelada
    if (reservation.status === 'canceled') {
      toast({
        title: "No se puede procesar",
        description: "Las reservaciones canceladas no pueden ser marcadas como pagadas.",
        variant: "destructive",
      });
      return;
    }
    
    setIsMarkingAsPaid(true);
    try {
      let response = await apiRequest(
        "PUT", 
        `/api/reservations/${reservationId}`, 
        { 
          paymentStatus: "pagado",
          paidBy: user.id // Guardamos el ID del usuario que marca como pagado
        }
      );
      
      if (!response.ok) {
        toast({
          title: "Autenticación requerida",
          description: "Para marcar como pagado necesita iniciar sesión con una cuenta autorizada.",
          variant: "destructive",
        });
        return;
      }
      
      toast({
        title: "Pago actualizado",
        description: "La reservación ha sido marcada como pagada.",
        variant: "default",
      });
      
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Ha ocurrido un error",
        variant: "destructive",
      });
    } finally {
      setIsMarkingAsPaid(false);
    }
  };

  // Función para cancelar reservación simple
  const cancelReservation = async () => {
    if (!reservationId || !user) return;
    
    setIsCanceling(true);
    try {
      const response = await fetch(`/api/reservations/${reservationId}/cancel`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      });
      
      if (!response.ok) {
        let errorMessage = "Error al cancelar la reservación";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          console.error("Error parsing error response:", parseError);
        }
        throw new Error(errorMessage);
      }
      
      toast({
        title: "Reservación cancelada",
        description: "La reservación ha sido cancelada exitosamente.",
        variant: "default",
      });
      
      refetch();
    } catch (error) {
      toast({
        title: "Error al cancelar",
        description: error instanceof Error ? error.message : "Error al cancelar la reservación",
        variant: "destructive",
      });
    } finally {
      setIsCanceling(false);
    }
  };

  // Función para cancelar con reembolso
  const cancelWithRefund = async (forceRefund = false) => {
    if (!reservationId || !user) return;
    
    setIsCancelingWithRefund(true);
    try {
      // Usar fetch directamente para evitar problemas de serialización
      const url = `/api/reservations/${reservationId}/cancel-refund`;
      const options: RequestInit = {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
      };
      
      // Solo agregar body si forceRefund es true
      if (forceRefund) {
        options.body = JSON.stringify({ forceRefund: true });
      }
      
      const response = await fetch(url, options);
      
      if (!response.ok) {
        let errorMessage = "Error al cancelar con reembolso";
        try {
          const errorData = await response.json();
          
          // Si es error de validación de usuario cruzado, mostrar modal
          if (errorData.error === "cross_user_refund") {
            setCrossUserRefundDialog({
              isOpen: true,
              message: errorData.message,
              creators: errorData.details?.creatorNames || 'otros usuarios'
            });
            return;
          }
          
          errorMessage = errorData.message || errorMessage;
        } catch (parseError) {
          // Si no se puede parsear el error, usar el mensaje por defecto
          console.error("Error parsing error response:", parseError);
        }
        
        throw new Error(errorMessage);
      }
      
      toast({
        title: "Reservación cancelada y reembolsada",
        description: "La reservación ha sido cancelada y el reembolso ha sido procesado.",
        variant: "default",
      });
      
      refetch();
    } catch (error) {
      toast({
        title: "Error al cancelar con reembolso",
        description: error instanceof Error ? error.message : "Error al cancelar con reembolso",
        variant: "destructive",
      });
    } finally {
      setIsCancelingWithRefund(false);
    }
  };

  // Función para confirmar reembolso forzado
  const handleConfirmForceRefund = () => {
    setCrossUserRefundDialog({
      isOpen: false,
      message: '',
      creators: ''
    });
    cancelWithRefund(true);
  };



  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
        <p className="text-lg text-center text-gray-700">Cargando detalles de la reservación...</p>
      </div>
    );
  }

  if (error || !reservation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-4">
        <XCircle className="h-16 w-16 text-red-500 mb-4" />
        <h1 className="text-xl font-bold text-center mb-2">Reservación no encontrada</h1>
        <p className="text-gray-600 text-center mb-6">
          No se encontró la reservación solicitada o ha ocurrido un error.
        </p>
        <Button onClick={() => setLocation("/")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Volver al inicio
        </Button>
      </div>
    );
  }

  // Obtener iniciales de la empresa para el avatar
  const getCompanyInitials = () => {
    const companyName = reservation.trip?.companyName || "TR";
    return companyName.substring(0, 2).toUpperCase();
  };

  return (
    <div className="container max-w-2xl mx-auto px-4 py-6">
      <div className="flex items-center mb-6">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => setLocation("/")}
          className="rounded-full"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="ml-2">Volver</span>
        </Button>
      </div>
      
      <Card className="p-4 sm:p-6 mb-4 border-0 shadow-md">
        {/* Logo/Avatar de la empresa */}
        <div className="flex flex-col items-center mb-6">
          <Avatar className="h-20 w-20 mb-4 border-2 border-gray-200">
            <AvatarImage src={reservation.trip?.companyLogo} alt={reservation.trip?.companyName || "Empresa"} />
            <AvatarFallback className="bg-primary text-white text-xl">
              {getCompanyInitials()}
            </AvatarFallback>
          </Avatar>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            Reservación #{generateReservationId(reservation.id)}
          </h1>
          <div className="text-xl font-medium text-gray-800">
            {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
            {reservation.passengers.length > 1 && ` +${reservation.passengers.length - 1}`}
          </div>
        </div>

        {/* Estado del pago y transferencia */}
        <div className="text-center mb-6 flex flex-col items-center gap-2">
          <Badge 
            className={`text-lg px-6 py-1.5 rounded-full ${
              reservation.paymentStatus === 'pagado' 
                ? 'bg-green-100 text-green-800 border-green-300' 
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}
          >
            {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
          </Badge>
          
          {/* Indicador de transferencia si corresponde */}
          {reservation.notes && reservation.notes.includes("Transferido desde") && (
            <Badge 
              variant="outline" 
              className="bg-blue-50 text-blue-700 border-blue-200 px-3"
            >
              TRANSFERENCIA RECIBIDA
            </Badge>
          )}
        </div>

        {/* Información del pasajero */}
        <div className="mb-6">
          <h2 className="text-base font-medium mb-3 border-b pb-2">Información del Pasajero</h2>
          <div className="bg-gray-50 p-4 rounded-md">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 font-medium">CONTACTO</div>
                <div className="break-words">{reservation.email || '-'}</div>
                <div>{reservation.phone || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium">PASAJEROS</div>
                <div>{reservation.passengers.length}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Detalles del viaje */}
        <div className="mb-6">
          <h2 className="text-base font-medium mb-3 border-b pb-2">Detalles del Viaje</h2>
          <div className="bg-gray-50 p-4 rounded-md">            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-3">
              <div>
                <div className="text-sm text-gray-500 font-medium">ORIGEN</div>
                <div>{reservation.trip.origin}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium">DESTINO</div>
                <div>{reservation.trip.destination}</div>
              </div>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-500 font-medium">FECHA</div>
                <div>{formatDate(reservation.trip.departureDate)}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500 font-medium">HORA</div>
                <div>{reservation.trip.departureTime}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Información de pago */}
        <div className="mb-6">
          <h2 className="text-base font-medium mb-3 border-b pb-2">Información de Pago</h2>
          <div className="bg-gray-50 p-4 rounded-md">
            {/* Visualización para reservaciones canceladas */}
            {reservation.status === 'canceled' ? (
              <>
                {reservation.paymentStatus === 'pagado' ? (
                  <>
                    {/* Visualización para reservaciones canceladas pero pagadas */}
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">TOTAL PAGADO</div>
                      <div className="text-right font-medium">{formatPrice(reservation.totalAmount)}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">MÉTODO DE PAGO</div>
                      <div className="text-right">{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Visualización para reservaciones canceladas sin pagar */}
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">PRECIO ORIGINAL</div>
                      <div className="text-right font-medium line-through text-gray-500">{formatPrice(reservation.totalAmount)}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">INGRESO REAL</div>
                      <div className="text-right font-medium">{formatPrice(reservation.advanceAmount || 0)}</div>
                    </div>
                  </>
                )}
                
                {/* Para ambos casos de reservación cancelada, mostrar información de anticipo si existe */}
                {(reservation.advanceAmount && reservation.advanceAmount > 0) && (
                  <>
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">ANTICIPO RETENIDO</div>
                      <div className="text-right font-medium">{formatPrice(reservation.advanceAmount)}</div>
                    </div>
                    
                    <div className="grid grid-cols-2 items-center mb-3">
                      <div className="text-sm text-gray-500 font-medium">MÉTODO ANTICIPO</div>
                      <div className="text-right">{reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</div>
                    </div>
                  </>
                )}
              </>
            ) : (
              <>
                {/* NUEVO FORMATO MEJORADO PARA INFORMACIÓN DE PAGO */}
                {(() => {
                  const hasAdvance = reservation.advanceAmount && reservation.advanceAmount > 0;
                  const isPaid = reservation.paymentStatus === 'pagado';
                  const remainingAmount = reservation.totalAmount - (reservation.advanceAmount || 0);
                  
                  if (hasAdvance && isPaid) {
                    // Escenario 3: Hay anticipo Y ya está pagado completamente
                    return (
                      <>
                        <div className="grid grid-cols-2 items-center mb-3">
                          <div className="text-sm text-gray-500 font-medium">ANTICIPO</div>
                          <div className="text-right font-medium">{formatPrice(reservation.advanceAmount)} ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                        </div>
                        
                        <div className="grid grid-cols-2 items-center mb-3">
                          <div className="text-sm text-gray-500 font-medium">PAGÓ</div>
                          <div className="text-right font-medium">{formatPrice(remainingAmount)} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                        </div>
                        
                        <div className="grid grid-cols-2 items-center font-semibold">
                          <div className="text-sm text-gray-700 font-medium">TOTAL</div>
                          <div className="text-right">{formatPrice(reservation.totalAmount)}</div>
                        </div>
                      </>
                    );
                  } else if (hasAdvance && !isPaid) {
                    // Escenario 1: Hay anticipo PERO el restante no está pagado aún
                    return (
                      <>
                        <div className="grid grid-cols-2 items-center mb-3">
                          <div className="text-sm text-gray-500 font-medium">ANTICIPO</div>
                          <div className="text-right font-medium">{formatPrice(reservation.advanceAmount)} ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                        </div>
                        
                        <div className="grid grid-cols-2 items-center mb-3">
                          <div className="text-sm text-gray-500 font-medium">RESTA</div>
                          <div className="text-right font-medium">{formatPrice(remainingAmount)} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                        </div>
                        
                        <div className="grid grid-cols-2 items-center font-semibold">
                          <div className="text-sm text-gray-700 font-medium">TOTAL</div>
                          <div className="text-right">{formatPrice(reservation.totalAmount)}</div>
                        </div>
                      </>
                    );
                  } else {
                    // Escenario 2: NO existe anticipo
                    return (
                      <>
                        <div className="grid grid-cols-2 items-center mb-3">
                          <div className="text-sm text-gray-500 font-medium">RESTA</div>
                          <div className="text-right font-medium">{formatPrice(reservation.totalAmount)} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</div>
                        </div>
                        
                        <div className="grid grid-cols-2 items-center font-semibold">
                          <div className="text-sm text-gray-700 font-medium">TOTAL</div>
                          <div className="text-right">{formatPrice(reservation.totalAmount)}</div>
                        </div>
                      </>
                    );
                  }
                })()}
              </>
            )}
            
            {/* Botón para marcar como pagado */}
            {reservation.paymentStatus !== 'pagado' && user && reservation.status !== 'canceled' && (
              <Button 
                onClick={(e) => {
                  e.preventDefault();
                  markAsPaid();
                }}
                disabled={isMarkingAsPaid}
                className="w-full mt-4 bg-green-600 hover:bg-green-700 text-white"
              >
                {isMarkingAsPaid ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                    Procesando...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Marcar como pagado
                  </>
                )}
              </Button>
            )}
            
            {/* Botones de cancelación solo para usuarios autenticados y reservaciones no canceladas */}
            {user && reservation.status !== 'canceled' && (
              <div className="mt-4 space-y-2">
                {/* Botón Cancelar con reembolso - Solo si hay anticipo o está pagada y tiene permisos */}
                {hasRequiredRole(user, ['superAdmin', 'admin', 'dueño', 'checador']) && 
                 ((reservation.advanceAmount && reservation.advanceAmount > 0) || reservation.paymentStatus === 'pagado') && (
                  <Button 
                    onClick={(e) => {
                      e.preventDefault();
                      cancelWithRefund(false);
                    }}
                    disabled={isCancelingWithRefund}
                    className="w-full bg-orange-600 hover:bg-orange-700 text-white"
                  >
                    {isCancelingWithRefund ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                        Procesando reembolso...
                      </>
                    ) : (
                      <>
                        <X className="mr-2 h-4 w-4" />
                        Cancelar con reembolso
                      </>
                    )}
                  </Button>
                )}
                
                {/* Botón Cancelar Reservación */}
                <Button 
                  onClick={(e) => {
                    e.preventDefault();
                    cancelReservation();
                  }}
                  disabled={isCanceling}
                  variant="destructive"
                  className="w-full"
                >
                  {isCanceling ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                      Cancelando...
                    </>
                  ) : (
                    <>
                      <X className="mr-2 h-4 w-4" />
                      Cancelar Reservación
                    </>
                  )}
                </Button>
              </div>
            )}
            
            {/* Mensaje si está cancelada */}
            {reservation.status === 'canceled' && (
              <div className="w-full mt-4 p-3 bg-red-50 border border-red-200 rounded text-center text-red-600 text-sm">
                Esta reservación está cancelada y no puede ser procesada.
              </div>
            )}
          </div>
        </div>
        
        {/* Notas */}
        {reservation.notes && (
          <div className="mb-6">
            <h2 className="text-base font-medium mb-3 border-b pb-2">Notas</h2>
            <div className="bg-gray-50 p-4 rounded-md">
              <p>{reservation.notes}</p>
            </div>
          </div>
        )}
        
        {/* Información de verificación (si ya se verificó) */}
        {reservation.checkedBy && (
          <div className="text-center text-sm text-green-600 bg-green-50 p-3 rounded-md flex items-center justify-center mb-4">
            <CheckCircle className="w-5 h-5 mr-2" />
            {reservation.checkCount > 1 
              ? `Ticket verificado ${reservation.checkCount} veces`
              : 'Ticket verificado correctamente'}
          </div>
        )}
      </Card>
      

      
      {/* Modal de reservación cancelada */}
      {reservation && (
        <ReservationCanceledModal
          isOpen={isCanceledModalOpen}
          onClose={() => setIsCanceledModalOpen(false)}
          reservation={reservation}
        />
      )}

      {/* Modal de confirmación para reembolso cruzado */}
      <AlertDialog open={crossUserRefundDialog.isOpen} onOpenChange={(open) => {
        if (!open) {
          setCrossUserRefundDialog({
            isOpen: false,
            message: '',
            creators: ''
          });
        }
      }}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-orange-600">
              <X className="h-5 w-5" />
              Confirmar Reembolso
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left space-y-2">
              <p className="font-medium text-gray-700">
                {crossUserRefundDialog.message}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-medium">Creadores de transacciones:</span><br />
                {crossUserRefundDialog.creators}
              </p>
              <p className="text-sm text-orange-600 font-medium">
                ¿Está seguro de que desea continuar con el reembolso?
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col sm:flex-row gap-2">
            <AlertDialogCancel
              className="w-full sm:w-auto"
              onClick={() => setCrossUserRefundDialog({
                isOpen: false,
                message: '',
                creators: ''
              })}
            >
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmForceRefund}
              className="w-full sm:w-auto bg-orange-600 hover:bg-orange-700"
            >
              Confirmar Reembolso
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}