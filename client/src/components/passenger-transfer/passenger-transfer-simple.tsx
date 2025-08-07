import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Search, 
  Loader2, 
  ArrowRight, 
  Calendar, 
  Clock,
  MapPin,
  Users,
  Check
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { TripWithRouteInfo, ReservationWithDetails } from "@shared/schema";
import { TripList } from "@/components/trips/trip-list";
import { getCurrentLocalDate } from "@/lib/utils";

// Función auxiliar para formatear fechas
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '';
  try {
    // Si la fecha está en formato YYYY-MM-DD, parsearla como fecha local
    if (dateString.includes('-') && dateString.length === 10) {
      const [year, month, day] = dateString.split('-');
      const date = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
      return date.toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric'
      });
    }
    
    // Para otros formatos, usar el método original
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric'
    });
  } catch {
    return dateString;
  }
};

interface PassengerTransferProps {
  onClose?: () => void;
}

export function PassengerTransfer({ onClose }: PassengerTransferProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Estados principales
  const [step, setStep] = useState<'search' | 'transfer' | 'confirmation'>('search');
  const [reservationCode, setReservationCode] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithDetails | null>(null);
  const [selectedTrip, setSelectedTrip] = useState<TripWithRouteInfo | null>(null);
  const [searchFilters, setSearchFilters] = useState({
    origin: '',
    destination: '',
    date: getCurrentLocalDate(),
    passengers: 1
  });

  // Buscar reservación
  const searchReservation = useMutation({
    mutationFn: async (code: string) => {
      const response = await fetch(`/api/reservations/search/${code}`);
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al buscar la reservación');
      }
      return response.json();
    },
    onSuccess: (data) => {
      console.log('[PassengerTransfer] Datos recibidos del backend:', data);
      console.log('[PassengerTransfer] data.reservation:', data.reservation);
      console.log('[PassengerTransfer] data.trip:', data.trip);
      console.log('[PassengerTransfer] data.userNames:', data.userNames);
      
      // Combinar la información del viaje en la reservación para compatibilidad
      const reservationWithTrip = {
        ...data.reservation,
        trip: data.trip, // El backend envía trip separado
        userNames: data.userNames // Agregar nombres de usuarios
      };
      
      setSelectedReservation(reservationWithTrip);
      setSearchFilters(prev => ({
        ...prev,
        passengers: data.reservation.passengers?.length || 1
      }));
      setStep('transfer');
      toast({
        title: "Reservación encontrada",
        description: `Reservación de ${data.reservation.passengers?.[0]?.firstName} ${data.reservation.passengers?.[0]?.lastName}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Transferir pasajero
  const transferPassenger = useMutation({
    mutationFn: async (data: { reservationId: number; newTripId: number; origin?: string; destination?: string }) => {
      const response = await fetch('/api/reservations/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Error al transferir el pasajero');
      }
      return response.json();
    },
    onSuccess: (data) => {
      setStep('confirmation');
      // Invalidar caché específico y general
      queryClient.invalidateQueries({ queryKey: ['/api/reservations'] });
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      
      // Forzar refetch completo de todos los trips
      queryClient.removeQueries({ queryKey: ['/api/trips'] });
      
      toast({
        title: "Transferencia exitosa",
        description: `Pasajero movido del viaje ${data.oldTripId} al viaje ${data.newTripId}. Asientos transferidos: ${data.seatsTransferred}`,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error en transferencia",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSearch = () => {
    if (!reservationCode.trim()) {
      toast({
        title: "Error",
        description: "Ingresa un código de reservación",
        variant: "destructive",
      });
      return;
    }
    searchReservation.mutate(reservationCode.trim());
  };

  const handleTripSelect = (trip: TripWithRouteInfo, tripData: any) => {
    console.log('[PassengerTransfer] handleTripSelect called with:', { trip, tripData });
    setSelectedTrip(trip);
    // Actualizar filtros basado en la selección del viaje
    setSearchFilters(prev => ({
      ...prev,
      origin: tripData.origin,
      destination: tripData.destination
    }));
    toast({
      title: "Viaje seleccionado",
      description: `Has seleccionado el viaje ${trip.id}`,
    });
  };

  const handleTransfer = () => {
    if (!selectedReservation || !selectedTrip) return;
    
    transferPassenger.mutate({
      reservationId: selectedReservation.id,
      newTripId: selectedTrip.id,
      origin: searchFilters.origin,
      destination: searchFilters.destination
    });
  };

  const resetTransfer = () => {
    setStep('search');
    setReservationCode('');
    setSelectedReservation(null);
    setSelectedTrip(null);
    setSearchFilters({
      origin: '',
      destination: '',
      date: getCurrentLocalDate(),
      passengers: 1
    });
  };

  if (step === 'confirmation') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <CardTitle className="text-2xl text-green-600">Transferencia Completada</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">
              El pasajero {selectedReservation?.passengers?.[0]?.firstName} {selectedReservation?.passengers?.[0]?.lastName} 
              ha sido transferido exitosamente al nuevo viaje.
            </p>
            <div className="flex gap-4 justify-center">
              <Button onClick={resetTransfer}>
                Nueva Transferencia
              </Button>
              {onClose && (
                <Button variant="outline" onClick={onClose}>
                  Cerrar
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'search') {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Buscar Reservación
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              <h3 className="text-lg font-medium">Ingresa el código de reservación</h3>
              
              <div className="space-y-2">
                <Label htmlFor="reservationCode">Código de Reservación</Label>
                <Input
                  id="reservationCode"
                  value={reservationCode}
                  onChange={(e) => setReservationCode(e.target.value)}
                  placeholder="RES129, RES426, etc."
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>

              <Button 
                onClick={handleSearch} 
                disabled={searchReservation.isPending}
                className="w-full"
              >
                {searchReservation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Buscar Reservación
                  </>
                )}
              </Button>

              {searchReservation.isError && (
                <Alert variant="destructive">
                  <AlertDescription>
                    No se encontró una reservación con ese código
                  </AlertDescription>
                </Alert>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (step === 'transfer' && selectedReservation) {
    return (
      <div className="max-w-6xl mx-auto p-6 space-y-6">
        {/* Información de la reservación encontrada */}
        <Card>
          <CardHeader>
            <CardTitle className="text-green-600">Reservación Encontrada</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              {/* Información básica del pasajero */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <Label className="text-sm font-medium text-gray-500">Pasajero:</Label>
                  <p className="font-medium">
                    {selectedReservation.passengers?.[0]?.firstName} {selectedReservation.passengers?.[0]?.lastName}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Asientos:</Label>
                  <p className="font-medium">{selectedReservation.passengers?.length || 0}</p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Fecha:</Label>
                  <p className="font-medium">
                    {formatDate(selectedReservation.trip?.departureDate || selectedReservation.trip?.date)}
                  </p>
                </div>
              </div>

              {/* Información del viaje */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <Label className="text-sm font-medium text-gray-500">Viaje Actual:</Label>
                  <p className="font-medium">
                    {selectedReservation.trip?.origin || selectedReservation.trip?.route?.origin || 'N/A'} → {selectedReservation.trip?.destination || selectedReservation.trip?.route?.destination || 'N/A'}
                  </p>
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-500">Hora de Salida:</Label>
                  <p className="font-medium">{selectedReservation.trip?.departureTime}</p>
                </div>
              </div>

              {/* Información de pago */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3">Información de Pago</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Estado de Pago:</Label>
                    <p className={`font-medium ${selectedReservation.paymentStatus === 'pagado' ? 'text-green-600' : 'text-red-600'}`}>
                      {selectedReservation.paymentStatus === 'pagado' ? 'Pagado' : 'Pendiente'}
                    </p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Total:</Label>
                    <p className="font-medium">${selectedReservation.totalAmount}</p>
                  </div>
                  {selectedReservation.advanceAmount > 0 && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Anticipo:</Label>
                      <p className="font-medium text-blue-600">${selectedReservation.advanceAmount}</p>
                    </div>
                  )}
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Resta:</Label>
                    <p className="font-medium">
                      ${(selectedReservation.totalAmount - (selectedReservation.advanceAmount || 0)).toFixed(2)}
                    </p>
                  </div>
                  {selectedReservation.paidBy && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Marcado como pagado por:</Label>
                      <p className="font-medium text-sm">
                        {selectedReservation.userNames?.[selectedReservation.paidBy] || `Usuario ID: ${selectedReservation.paidBy}`}
                      </p>
                    </div>
                  )}
                  {selectedReservation.markedAsPaidAt && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Fecha de pago:</Label>
                      <p className="font-medium text-sm">{formatDate(selectedReservation.markedAsPaidAt)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Información de cupón (si existe) */}
              {selectedReservation.couponCode && (
                <div className="border-t pt-4">
                  <h4 className="font-medium text-gray-700 mb-3">Información de Descuento</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Cupón:</Label>
                      <p className="font-medium text-purple-600">{selectedReservation.couponCode}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Descuento:</Label>
                      <p className="font-medium text-green-600">${selectedReservation.discountAmount}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Información de check */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3">Estado de Check</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Estado:</Label>
                    <p className={`font-medium ${selectedReservation.checkedAt ? 'text-green-600' : 'text-gray-500'}`}>
                      {selectedReservation.checkedAt ? 'Chequeado' : 'Sin chequear'}
                    </p>
                  </div>
                  {selectedReservation.checkedBy && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Chequeado por:</Label>
                      <p className="font-medium text-sm">
                        {selectedReservation.userNames?.[selectedReservation.checkedBy] || `Usuario ID: ${selectedReservation.checkedBy}`}
                      </p>
                    </div>
                  )}
                  {selectedReservation.checkedAt && (
                    <div>
                      <Label className="text-sm font-medium text-gray-500">Fecha de check:</Label>
                      <p className="font-medium text-sm">{formatDate(selectedReservation.checkedAt)}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Información de creación */}
              <div className="border-t pt-4">
                <h4 className="font-medium text-gray-700 mb-3">Información de Creación</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium text-gray-500">Creado por:</Label>
                    <p className="font-medium text-sm">
                      {selectedReservation.userNames?.[selectedReservation.createdBy] || `Usuario ID: ${selectedReservation.createdBy}`}
                    </p>
                  </div>

                </div>
              </div>
            </div>
   
          </CardContent>
        </Card>

        {/* Búsqueda de viajes */}
        <Card>
          <CardHeader>
            <CardTitle>Seleccionar Viaje Destino</CardTitle>
          </CardHeader>
          <CardContent>
            <TripList 
              customButtonText="Mover aquí"
              onTripSelect={handleTripSelect}
              defaultFilters={searchFilters}
              isTransferMode={true}
            />
            
            {selectedTrip && (
              <div className="mt-6 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900 mb-2">Viaje Seleccionado:</h4>
                <p className="text-blue-700">
                  {selectedTrip.route.origin} → {selectedTrip.route.destination}
                </p>
                <Button onClick={handleTransfer} className="mt-4 w-full" disabled={transferPassenger.isPending}>
                  {transferPassenger.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Transfiriendo...
                    </>
                  ) : (
                    'Confirmar Transferencia'
                  )}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}