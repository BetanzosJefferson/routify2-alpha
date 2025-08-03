import { useState, useEffect } from "react";
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
  Search
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
import { TripWithRouteInfo, ReservationWithDetails } from "@shared/schema";

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
  const [selectedOriginTrip, setSelectedOriginTrip] = useState<TripSummary | null>(null);
  const [selectedDestinationTrip, setSelectedDestinationTrip] = useState<TripSummary | null>(null);
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);
  const [pendingTransfers, setPendingTransfers] = useState<TransferItem[]>([]);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Obtener viajes disponibles
  const { data: trips = [], isLoading: isLoadingTrips } = useQuery({
    queryKey: ["trips", searchDate],
    queryFn: async (): Promise<TripWithRouteInfo[]> => {
      const response = await fetch(`/api/trips?date=${searchDate}`);
      if (!response.ok) throw new Error("Error al cargar viajes");
      return response.json();
    }
  });

  // Obtener reservas para un viaje específico
  const fetchReservationsForTrip = async (tripId: number): Promise<ReservationWithDetails[]> => {
    const response = await fetch(`/api/reservations/trip/${tripId}`);
    if (!response.ok) throw new Error("Error al cargar reservas");
    return response.json();
  };

  // Preparar datos de viajes con reservas
  const [tripsWithReservations, setTripsWithReservations] = useState<TripSummary[]>([]);

  useEffect(() => {
    const loadTripsWithReservations = async () => {
      if (!trips.length) return;

      const enrichedTrips = await Promise.all(
        trips.map(async (trip) => {
          try {
            const reservations = await fetchReservationsForTrip(trip.id);
            const mainTrip = Array.isArray(trip.tripData) 
              ? trip.tripData.find((t: any) => t.isMainTrip) || trip.tripData[0]
              : trip.tripData;
            
            const totalReservedSeats = reservations.reduce((sum, reservation) => 
              sum + reservation.passengers.length, 0
            );

            return {
              ...trip,
              reservations,
              availableSeats: (mainTrip?.availableSeats || trip.capacity) - totalReservedSeats,
              transferItems: []
            } as TripSummary;
          } catch (error) {
            console.error(`Error loading reservations for trip ${trip.id}:`, error);
            return {
              ...trip,
              reservations: [],
              availableSeats: trip.capacity,
              transferItems: []
            } as TripSummary;
          }
        })
      );

      setTripsWithReservations(enrichedTrips);
    };

    loadTripsWithReservations();
  }, [trips]);

  // Mutación para transferir pasajeros
  const transferMutation = useMutation({
    mutationFn: async (transfers: TransferItem[]) => {
      const response = await fetch("/api/reservations/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transfers })
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || "Error al transferir pasajeros");
      }

      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Transferencia exitosa",
        description: "Los pasajeros han sido movidos al nuevo viaje",
      });
      
      // Limpiar estado
      setPendingTransfers([]);
      setSelectedOriginTrip(null);
      setSelectedDestinationTrip(null);
      setShowConfirmation(false);
      
      // Invalidar caché
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["reservations"] });
      
      onClose?.();
    },
    onError: (error: Error) => {
      toast({
        title: "Error en la transferencia",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  // Manejar drag and drop
  const handleDragEnd = (result: DropResult) => {
    const { source, destination, draggableId } = result;

    if (!destination) return;

    // Si se suelta en el mismo lugar, no hacer nada
    if (source.droppableId === destination.droppableId) return;

    // Buscar el elemento arrastrado
    const draggedItem = findTransferItem(draggableId);
    if (!draggedItem) return;

    // Validar capacidad en viaje destino
    if (destination.droppableId === 'destination') {
      if (!selectedDestinationTrip) return;
      
      const totalSeatsToTransfer = pendingTransfers
        .filter(item => item.tripId === selectedDestinationTrip.id)
        .reduce((sum, item) => sum + item.seats, 0) + draggedItem.seats;

      if (totalSeatsToTransfer > selectedDestinationTrip.availableSeats) {
        toast({
          title: "Capacidad insuficiente",
          description: `El viaje destino solo tiene ${selectedDestinationTrip.availableSeats} asientos disponibles`,
          variant: "destructive"
        });
        return;
      }
    }

    // Actualizar estado de transferencias
    setPendingTransfers(prev => {
      const updated = prev.filter(item => item.id !== draggableId);
      
      if (destination.droppableId === 'destination' && selectedDestinationTrip) {
        updated.push({
          ...draggedItem,
          tripId: selectedDestinationTrip.id
        });
      }
      
      return updated;
    });
  };

  const findTransferItem = (id: string): TransferItem | null => {
    // Buscar en pending transfers
    const pending = pendingTransfers.find(item => item.id === id);
    if (pending) return pending;

    // Buscar en reservas del viaje origen
    if (!selectedOriginTrip) return null;

    for (const reservation of selectedOriginTrip.reservations) {
      const itemId = `${reservation.id}-${reservation.passengers[0]?.firstName || 'passenger'}`;
      if (itemId === id) {
        return {
          id: itemId,
          reservationId: reservation.id,
          passengerName: `${reservation.passengers[0]?.firstName || ''} ${reservation.passengers[0]?.lastName || ''}`.trim() || 'Pasajero',
          seats: reservation.passengers.length,
          tripId: reservation.trip.id,
          originalTripId: reservation.trip.id
        };
      }
    }

    return null;
  };

  // Calcular resumen de cambios
  const getTransferSummary = () => {
    const seatsToFree = pendingTransfers.reduce((sum, item) => sum + item.seats, 0);
    const seatsToOccupy = pendingTransfers
      .filter(item => selectedDestinationTrip && item.tripId === selectedDestinationTrip.id)
      .reduce((sum, item) => sum + item.seats, 0);

    return { seatsToFree, seatsToOccupy };
  };

  // Confirmar transferencias
  const handleConfirmTransfer = () => {
    if (pendingTransfers.length === 0) {
      toast({
        title: "No hay transferencias pendientes",
        description: "Arrastra pasajeros al viaje destino para transferirlos",
        variant: "destructive"
      });
      return;
    }

    transferMutation.mutate(pendingTransfers);
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Mover Pasajeros</h1>
          <p className="text-gray-600">Arrastra pasajeros entre viajes para reorganizar reservas</p>
        </div>
        
        {pendingTransfers.length > 0 && (
          <Button 
            onClick={handleConfirmTransfer}
            disabled={transferMutation.isPending}
            className="bg-green-600 hover:bg-green-700"
          >
            <Check className="w-4 h-4 mr-2" />
            Confirmar Transferencias
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="w-5 h-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <div>
              <Label htmlFor="search-date">Fecha</Label>
              <Input
                id="search-date"
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Selector de viajes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Viaje Origen */}
        <Card>
          <CardHeader>
            <CardTitle>1. Seleccionar Viaje Origen</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {isLoadingTrips ? (
                <div className="text-center py-4">Cargando viajes...</div>
              ) : (
                tripsWithReservations.map((trip) => (
                  <div
                    key={trip.id}
                    onClick={() => setSelectedOriginTrip(trip)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedOriginTrip?.id === trip.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{trip.route.origin} → {trip.route.destination}</p>
                        <p className="text-sm text-gray-600">
                          {formatDate(Array.isArray(trip.tripData) ? trip.tripData[0]?.departureDate : trip.tripData?.departureDate)} - {Array.isArray(trip.tripData) ? trip.tripData[0]?.departureTime : trip.tripData?.departureTime}
                        </p>
                      </div>
                      <Badge variant="outline">
                        {trip.reservations.length} reservas
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* Viaje Destino */}
        <Card>
          <CardHeader>
            <CardTitle>2. Seleccionar Viaje Destino</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {tripsWithReservations
                .filter(trip => trip.id !== selectedOriginTrip?.id)
                .map((trip) => (
                  <div
                    key={trip.id}
                    onClick={() => setSelectedDestinationTrip(trip)}
                    className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                      selectedDestinationTrip?.id === trip.id
                        ? 'border-green-500 bg-green-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
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
          </CardContent>
        </Card>
      </div>

      {/* Área de transferencia con Drag & Drop */}
      {selectedOriginTrip && selectedDestinationTrip && (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Lista de pasajeros origen */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5" />
                  Pasajeros en Viaje Origen
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Droppable droppableId="origin">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] p-4 border-2 border-dashed rounded-lg transition-colors ${
                        snapshot.isDraggingOver 
                          ? 'border-blue-500 bg-blue-50' 
                          : 'border-gray-300'
                      }`}
                    >
                      {selectedOriginTrip.reservations
                        .filter(reservation => 
                          !pendingTransfers.some(transfer => transfer.reservationId === reservation.id)
                        )
                        .map((reservation, index) => {
                          const itemId = `${reservation.id}-${reservation.passengers[0]?.firstName || 'passenger'}`;
                          return (
                            <Draggable key={itemId} draggableId={itemId} index={index}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.draggableProps}
                                  {...provided.dragHandleProps}
                                  className={`p-3 mb-2 bg-white border rounded-lg shadow-sm cursor-move transition-transform ${
                                    snapshot.isDragging ? 'rotate-3 shadow-lg' : ''
                                  }`}
                                >
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="font-medium">
                                        {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
                                      </p>
                                      <p className="text-sm text-gray-600">
                                        Reserva #{reservation.id}
                                      </p>
                                    </div>
                                    <Badge>
                                      {reservation.passengers.length} asientos
                                    </Badge>
                                  </div>
                                </div>
                              )}
                            </Draggable>
                          );
                        })}
                      {provided.placeholder}
                      
                      {selectedOriginTrip.reservations.length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                          No hay reservas en este viaje
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </CardContent>
            </Card>

            {/* Lista de pasajeros destino */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="w-5 h-5" />
                  Transferir a Viaje Destino
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Droppable droppableId="destination">
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`min-h-[200px] p-4 border-2 border-dashed rounded-lg transition-colors ${
                        snapshot.isDraggingOver 
                          ? 'border-green-500 bg-green-50' 
                          : 'border-gray-300'
                      }`}
                    >
                      {pendingTransfers
                        .filter(transfer => transfer.tripId === selectedDestinationTrip.id)
                        .map((transfer, index) => (
                          <div
                            key={transfer.id}
                            className="p-3 mb-2 bg-green-50 border border-green-200 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">{transfer.passengerName}</p>
                                <p className="text-sm text-gray-600">
                                  Reserva #{transfer.reservationId}
                                </p>
                              </div>
                              <Badge variant="secondary">
                                {transfer.seats} asientos
                              </Badge>
                            </div>
                          </div>
                        ))}
                      {provided.placeholder}
                      
                      {pendingTransfers.filter(t => t.tripId === selectedDestinationTrip.id).length === 0 && (
                        <div className="text-center text-gray-500 py-8">
                          Arrastra pasajeros aquí para transferirlos
                        </div>
                      )}
                    </div>
                  )}
                </Droppable>
              </CardContent>
            </Card>
          </div>
        </DragDropContext>
      )}

      {/* Resumen de cambios */}
      {pendingTransfers.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>Resumen de transferencias:</strong>
            <ul className="mt-2 space-y-1">
              <li>• Se liberarán {getTransferSummary().seatsToFree} asientos en el viaje origen</li>
              <li>• Se ocuparán {getTransferSummary().seatsToOccupy} asientos en el viaje destino</li>
              <li>• Total de pasajeros a transferir: {pendingTransfers.length}</li>
            </ul>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}