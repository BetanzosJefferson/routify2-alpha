import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { DragDropContext, Droppable, Draggable, DropResult } from "@hello-pangea/dnd";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { 
  Users, 
  ArrowRight, 
  Calendar, 
  Clock,
  MapPin,
  AlertTriangle,
  Check,
  Search,
  Loader2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { TripWithRouteInfo, ReservationWithDetails } from "@shared/schema";

// Función auxiliar para formatear fechas
const formatDate = (dateString: string | undefined) => {
  if (!dateString) return '';
  try {
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

interface TransferItem {
  id: string;
  reservationId: number;
  passengerName: string;
  seats: number;
  tripId: number;
  originalTripId: number;
}

interface TripSummary extends TripWithRouteInfo {
  reservations: ReservationWithDetails[];
  availableSeats: number;
  transferItems: TransferItem[];
}

export function PassengerTransfer({ onClose }: PassengerTransferProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Estados principales
  const [step, setStep] = useState<'search' | 'transfer'>('search');
  const [reservationCode, setReservationCode] = useState('');
  const [selectedReservation, setSelectedReservation] = useState<ReservationWithDetails | null>(null);
  const [sourceTrip, setSourceTrip] = useState<TripWithRouteInfo | null>(null);
  const [selectedDestinationTrip, setSelectedDestinationTrip] = useState<TripSummary | null>(null);
  const [pendingTransfers, setPendingTransfers] = useState<TransferItem[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Obtener fecha actual global (definida globalmente en el sistema)
  const currentDate = new Date().toISOString().split('T')[0];

  // Buscar reservación por código
  const { data: reservationData, isLoading: isLoadingReservation, error: reservationError, refetch: searchReservation } = useQuery({
    queryKey: ["reservation-search", reservationCode],
    queryFn: async (): Promise<{ reservation: ReservationWithDetails, trip: TripWithRouteInfo }> => {
      if (!reservationCode.trim()) throw new Error("Código de reservación requerido");
      
      const response = await fetch(`/api/reservations/search/${encodeURIComponent(reservationCode)}`);
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("No se encontró una reservación con ese código");
        }
        throw new Error("Error al buscar la reservación");
      }
      return response.json();
    },
    enabled: false // Solo ejecutar cuando se llame manualmente
  });

  // Obtener viajes disponibles para la fecha actual
  const { data: availableTrips = [], isLoading: isLoadingTrips } = useQuery({
    queryKey: ["trips", currentDate],
    queryFn: async (): Promise<TripWithRouteInfo[]> => {
      const response = await fetch(`/api/trips?date=${currentDate}`);
      if (!response.ok) throw new Error("Error al cargar viajes");
      return response.json();
    },
    enabled: step === 'transfer' && !!selectedReservation
  });

  // Obtener reservaciones para cada viaje disponible
  const tripsWithReservations = useQuery({
    queryKey: ["trips-with-reservations", currentDate, availableTrips.map(t => t.id)],
    queryFn: async (): Promise<TripSummary[]> => {
      const tripsData = await Promise.all(
        availableTrips.map(async (trip) => {
          try {
            const response = await fetch(`/api/reservations/trip/${trip.id}`);
            const reservations: ReservationWithDetails[] = response.ok ? await response.json() : [];
            
            // Calcular asientos disponibles
            const mainTripData = Array.isArray(trip.tripData) 
              ? trip.tripData.find(td => td.isMainTrip) || trip.tripData[0]
              : trip.tripData;
            
            const usedSeats = reservations.reduce((sum, res) => sum + (res.passengers?.length || 0), 0);
            const availableSeats = (mainTripData?.capacity || 0) - usedSeats;

            return {
              ...trip,
              reservations,
              availableSeats,
              transferItems: []
            } as TripSummary;
          } catch (error) {
            console.error(`Error loading reservations for trip ${trip.id}:`, error);
            return {
              ...trip,
              reservations: [],
              availableSeats: 0,
              transferItems: []
            } as TripSummary;
          }
        })
      );
      return tripsData;
    },
    enabled: step === 'transfer' && availableTrips.length > 0
  });

  // Mutación para transferir pasajeros
  const transferMutation = useMutation({
    mutationFn: async (transfers: TransferItem[]) => {
      const response = await fetch('/api/reservations/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transfers })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Error al transferir pasajeros');
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transferencia exitosa",
        description: `Se transfirieron ${pendingTransfers.length} pasajeros correctamente`,
      });
      
      // Limpiar estado y volver al inicio
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Error en la transferencia",
        description: error.message,
        variant: "destructive",
      });
    }
  });

  const handleSearch = () => {
    if (!reservationCode.trim()) {
      toast({
        title: "Código requerido",
        description: "Por favor ingresa un código de reservación",
        variant: "destructive",
      });
      return;
    }
    searchReservation();
  };

  const handleReservationFound = () => {
    if (reservationData) {
      setSelectedReservation(reservationData.reservation);
      setSourceTrip(reservationData.trip);
      setStep('transfer');
    }
  };

  const resetForm = () => {
    setStep('search');
    setReservationCode('');
    setSelectedReservation(null);
    setSourceTrip(null);
    setSelectedDestinationTrip(null);
    setPendingTransfers([]);
    setShowConfirmation(false);
  };

  const onDragEnd = (result: DropResult) => {
    const { destination, source, draggableId } = result;

    if (!destination) return;

    // Solo permitir mover desde origen a destino
    if (source.droppableId === 'source-trip' && destination.droppableId === 'destination-trip') {
      if (!selectedDestinationTrip || !selectedReservation) return;

      // Verificar capacidad
      const transferredSeats = pendingTransfers.reduce((sum, t) => sum + t.seats, 0);
      const reservationSeats = selectedReservation.passengers?.length || 0;
      if (transferredSeats + reservationSeats > selectedDestinationTrip.availableSeats) {
        toast({
          title: "Sin capacidad suficiente",
          description: "No hay suficientes asientos disponibles en el viaje destino",
          variant: "destructive",
        });
        return;
      }

      // Crear item de transferencia
      const passengerName = selectedReservation.passengers?.[0]?.name || 'Pasajero';
      const transferItem: TransferItem = {
        id: `transfer-${Date.now()}`,
        reservationId: selectedReservation.id,
        passengerName,
        seats: reservationSeats,
        tripId: selectedDestinationTrip.id,
        originalTripId: sourceTrip!.id
      };

      setPendingTransfers([transferItem]);
      setShowConfirmation(true);
    }
  };

  const executeTransfer = () => {
    if (pendingTransfers.length > 0) {
      transferMutation.mutate(pendingTransfers);
    }
  };

  if (step === 'search') {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-2">
          <Search className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Buscar Reservación</h2>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Ingresa el código de reservación</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="reservation-code">Código de Reservación</Label>
              <Input
                id="reservation-code"
                value={reservationCode}
                onChange={(e) => setReservationCode(e.target.value)}
                placeholder="Ejemplo: RES001, ABC123..."
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
              />
            </div>

            <Button 
              onClick={handleSearch} 
              disabled={isLoadingReservation || !reservationCode.trim()}
              className="w-full"
            >
              {isLoadingReservation ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Buscando...
                </>
              ) : (
                <>
                  <Search className="mr-2 h-4 w-4" />
                  Buscar Reservación
                </>
              )}
            </Button>

            {reservationError && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>
                  {reservationError.message}
                </AlertDescription>
              </Alert>
            )}

            {reservationData && (
              <Card className="bg-green-50 border-green-200">
                <CardHeader>
                  <CardTitle className="text-green-800">Reservación Encontrada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Pasajero:</p>
                      <p className="font-medium">{reservationData.reservation.passengers?.[0]?.name || 'Pasajero'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Asientos:</p>
                      <p className="font-medium">{reservationData.reservation.passengers?.length || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Viaje Actual:</p>
                      <p className="font-medium">
                        {reservationData.trip.route.origin} → {reservationData.trip.route.destination}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Fecha:</p>
                      <p className="font-medium">
                        {formatDate(Array.isArray(reservationData.trip.tripData) 
                          ? reservationData.trip.tripData[0]?.departureDate 
                          : reservationData.trip.tripData?.departureDate)}
                      </p>
                    </div>
                  </div>

                  <Button 
                    onClick={handleReservationFound}
                    className="w-full mt-4"
                  >
                    Proceder a Transferir
                  </Button>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Paso de transferencia
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="h-5 w-5 text-blue-600" />
          <h2 className="text-xl font-semibold">Transferir Pasajero</h2>
        </div>
        <Button variant="outline" onClick={resetForm}>
          Nueva Búsqueda
        </Button>
      </div>

      {/* Información de la reservación */}
      {selectedReservation && sourceTrip && (
        <Card className="bg-blue-50 border-blue-200">
          <CardHeader>
            <CardTitle className="text-blue-800">Reservación a Transferir</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Pasajero:</p>
                <p className="font-medium">{selectedReservation.passengers?.[0]?.name || 'Pasajero'}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Asientos:</p>
                <p className="font-medium">{selectedReservation.passengers?.length || 0}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Viaje Actual:</p>
                <p className="font-medium">
                  {sourceTrip.route.origin} → {sourceTrip.route.destination}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Viajes disponibles para transferir */}
      <Card>
        <CardHeader>
          <CardTitle>Viajes Disponibles ({formatDate(currentDate)})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoadingTrips ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin mr-2" />
              <span>Cargando viajes...</span>
            </div>
          ) : (
            <DragDropContext onDragEnd={onDragEnd}>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Viaje origen */}
                <div>
                  <h3 className="font-medium mb-3">Viaje Actual</h3>
                  <Droppable droppableId="source-trip">
                    {(provided) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className="min-h-[100px] p-3 border border-gray-200 rounded-lg bg-gray-50"
                      >
                        {selectedReservation && !pendingTransfers.length && (
                          <Draggable
                            draggableId={`reservation-${selectedReservation.id}`}
                            index={0}
                          >
                            {(provided, snapshot) => (
                              <div
                                ref={provided.innerRef}
                                {...provided.draggableProps}
                                {...provided.dragHandleProps}
                                className={`p-3 bg-white border rounded-lg cursor-move transition-all ${
                                  snapshot.isDragging ? 'rotate-2 shadow-lg' : 'hover:shadow-md'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-medium">{selectedReservation.passengers?.[0]?.firstName} {selectedReservation.passengers?.[0]?.lastName}</p>
                                    <p className="text-sm text-gray-600">
                                      {selectedReservation.passengers?.length || 0} asiento{(selectedReservation.passengers?.length || 0) > 1 ? 's' : ''}
                                    </p>
                                  </div>
                                  <Badge variant="outline">Arrastrar</Badge>
                                </div>
                              </div>
                            )}
                          </Draggable>
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>

                {/* Viajes destino */}
                <div>
                  <h3 className="font-medium mb-3">Seleccionar Viaje Destino</h3>
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {tripsWithReservations.data?.map((trip) => (
                      <div
                        key={trip.id}
                        className={`border rounded-lg p-3 cursor-pointer transition-colors ${
                          selectedDestinationTrip?.id === trip.id
                            ? 'border-green-500 bg-green-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                        onClick={() => setSelectedDestinationTrip(trip)}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{trip.route.origin} → {trip.route.destination}</p>
                            <p className="text-sm text-gray-600">
                              {formatDate(Array.isArray(trip.tripData) ? trip.tripData[0]?.departureDate : trip.tripData?.departureDate)} - {Array.isArray(trip.tripData) ? trip.tripData[0]?.departureTime : trip.tripData?.departureTime}
                            </p>
                          </div>
                          <Badge variant="outline" className="text-green-600">
                            {trip.availableSeats} disponibles
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>

                  {selectedDestinationTrip && (
                    <Droppable droppableId="destination-trip">
                      {(provided, snapshot) => (
                        <div
                          ref={provided.innerRef}
                          {...provided.droppableProps}
                          className={`mt-4 min-h-[100px] p-3 border-2 border-dashed rounded-lg transition-colors ${
                            snapshot.isDraggingOver
                              ? 'border-green-500 bg-green-50'
                              : 'border-gray-300 bg-gray-50'
                          }`}
                        >
                          <div className="text-center text-gray-600">
                            <ArrowRight className="mx-auto h-6 w-6 mb-2" />
                            <p>Arrastra aquí para transferir</p>
                          </div>
                          {provided.placeholder}
                        </div>
                      )}
                    </Droppable>
                  )}
                </div>
              </div>
            </DragDropContext>
          )}
        </CardContent>
      </Card>

      {/* Diálogo de confirmación */}
      {showConfirmation && (
        <Card className="border-green-500 bg-green-50">
          <CardHeader>
            <CardTitle className="text-green-800">Confirmar Transferencia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Check className="h-4 w-4" />
              <AlertDescription>
                ¿Estás seguro de transferir {pendingTransfers.length} pasajero(s) al nuevo viaje?
              </AlertDescription>
            </Alert>

            <div className="flex space-x-3">
              <Button
                onClick={executeTransfer}
                disabled={transferMutation.isPending}
                className="flex-1"
              >
                {transferMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Transfiriendo...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Confirmar Transferencia
                  </>
                )}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowConfirmation(false);
                  setPendingTransfers([]);
                }}
                className="flex-1"
              >
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}