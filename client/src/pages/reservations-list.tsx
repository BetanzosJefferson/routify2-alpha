import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useReservations } from "@/hooks/use-reservations";
import { formatDate, formatPrice, formatTime, formatDateForInput, normalizeToStartOfDay, isSameLocalDay } from "@/lib/utils";
import { Search, Calendar, MapPin, Users, CreditCard, Building2, User, ChevronDown, ChevronUp, Clock, Truck, UserCheck } from "lucide-react";
import { ReservationWithDetails } from "@shared/schema";
import DefaultLayout from "@/components/layout/default-layout";
import { ReservationDetailsSidebar } from "@/components/reservations/reservation-details-sidebar";

function ReservationsListContent() {
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedDate, setSelectedDate] = useState(formatDateForInput(new Date()));
  const [selectedTrip, setSelectedTrip] = useState<{
    recordId: string;
    tripInfo: any;
    reservations: ReservationWithDetails[];
  } | null>(null);
  const itemsPerPage = 50;

  const { 
    data: reservations = [], 
    isLoading, 
    error 
  } = useReservations({});

  // Filtrar reservaciones por fecha seleccionada y término de búsqueda
  const filteredReservations = reservations.filter((reservation) => {
    // Filtrar por fecha usando la fecha del viaje padre si está disponible
    let reservationDate = reservation.trip?.departureDate;
    
    // Si hay información del viaje padre, usar su fecha en lugar del segmento específico
    if (reservation.trip?.parentTrip?.departureDate) {
      reservationDate = reservation.trip.parentTrip.departureDate;
    }
    
    if (reservationDate) {
      const tripDateNormalized = normalizeToStartOfDay(reservationDate);
      const selectedDateNormalized = normalizeToStartOfDay(selectedDate);
      
      if (!isSameLocalDay(tripDateNormalized, selectedDateNormalized)) {
        return false;
      }
    }
    
    // Filtrar por término de búsqueda
    const searchLower = searchTerm.toLowerCase();
    return (
      reservation.id.toString().includes(searchLower) ||
      reservation.phone?.toLowerCase().includes(searchLower) ||
      reservation.email?.toLowerCase().includes(searchLower) ||
      reservation.trip?.origin?.toLowerCase().includes(searchLower) ||
      reservation.trip?.destination?.toLowerCase().includes(searchLower) ||
      reservation.createdByUser?.firstName?.toLowerCase().includes(searchLower) ||
      reservation.createdByUser?.lastName?.toLowerCase().includes(searchLower)
    );
  });

  // Agrupar reservaciones por viaje padre (buscar el viaje principal con isMainTrip = true)
  const groupedReservations = filteredReservations.reduce((groups, reservation) => {
    // Analizar tripDetails para encontrar el viaje padre
    const tripDetails = reservation.tripDetails as any;
    
    // Usar información del viaje padre del backend para agrupación
    let parentTripInfo = null;
    let parentTripKey = 'sin-viaje-padre';
    
    if (reservation.trip?.parentTrip) {
      // Usar información del viaje padre desde el backend
      const parentTrip = reservation.trip.parentTrip;
      parentTripKey = `${parentTrip.departureDate}_${parentTrip.origin}_${parentTrip.destination}`;
      parentTripInfo = {
        origin: parentTrip.origin,
        destination: parentTrip.destination,
        departureDate: parentTrip.departureDate,
        departureTime: parentTrip.departureTime,
        arrivalTime: parentTrip.arrivalTime,
        recordId: reservation.trip.recordId,
        isParentTrip: true,
        route: reservation.trip.route // Incluir información de la ruta
      };
    } else if (tripDetails && typeof tripDetails === 'object' && tripDetails.recordId) {
      // Fallback: usar el recordId como clave de agrupación
      parentTripKey = tripDetails.recordId.toString();
      
      // Usar la información del trip asociado para el viaje padre
      if (reservation.trip) {
        parentTripInfo = {
          origin: reservation.trip.origin,
          destination: reservation.trip.destination,
          departureDate: reservation.trip.departureDate,
          departureTime: reservation.trip.departureTime,
          arrivalTime: reservation.trip.arrivalTime,
          tripId: parentTripKey,
          recordId: tripDetails.recordId,
          route: reservation.trip.route // Incluir información de la ruta
        };
      }
    } else if (reservation.trip) {
      // Último fallback: usar información del trip si no hay nada más
      parentTripKey = `${reservation.trip.departureDate}_${reservation.trip.origin}_${reservation.trip.destination}`;
      parentTripInfo = {
        origin: reservation.trip.origin,
        destination: reservation.trip.destination,
        departureDate: reservation.trip.departureDate,
        departureTime: reservation.trip.departureTime,
        arrivalTime: reservation.trip.arrivalTime,
        tripId: 'fallback',
        route: reservation.trip.route // Incluir información de la ruta
      };
    }
    
    if (!groups[parentTripKey]) {
      groups[parentTripKey] = {
        reservations: [],
        tripInfo: null
      };
    }
    
    groups[parentTripKey].reservations.push(reservation);
    
    // Guardar información del viaje padre para mostrar en el header
    if (!groups[parentTripKey].tripInfo && parentTripInfo) {
      groups[parentTripKey].tripInfo = {
        origin: parentTripInfo.origin,
        destination: parentTripInfo.destination,
        departureDate: parentTripInfo.departureDate,
        departureTime: parentTripInfo.departureTime,
        arrivalTime: parentTripInfo.arrivalTime,
        vehicle: reservation.trip?.vehicleId || "Sin asignar",
        driver: reservation.trip?.driverId || "Sin asignar",
        recordId: parentTripKey,
        isParentTrip: true
      };
    }
    
    return groups;
  }, {} as Record<string, { reservations: ReservationWithDetails[], tripInfo: any }>);

  // Paginación aplicada a los grupos
  const totalGroups = Object.keys(groupedReservations).length;
  const totalPages = Math.ceil(totalGroups / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedGroups = Object.entries(groupedReservations).slice(startIndex, startIndex + itemsPerPage);

  const handleTripClick = (recordId: string, tripInfo: any, reservations: ReservationWithDetails[]) => {
    setSelectedTrip({
      recordId,
      tripInfo,
      reservations
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'confirmed':
        return <Badge variant="default" className="bg-green-100 text-green-800">Confirmada</Badge>;
      case 'pending':
        return <Badge variant="secondary">Pendiente</Badge>;
      case 'canceled':
        return <Badge variant="destructive">Cancelada</Badge>;
      case 'canceledAndRefund':
        return <Badge variant="destructive">Cancelada y reembolsada</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getPaymentBadge = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'pagado':
        return <Badge variant="default" className="bg-blue-100 text-blue-800">Pagado</Badge>;
      case 'anticipo':
        return <Badge variant="secondary">Anticipo</Badge>;
      case 'pendiente':
        return <Badge variant="outline">Pendiente</Badge>;
      default:
        return <Badge variant="outline">{paymentStatus}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Cargando reservaciones...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg text-red-600">Error al cargar reservaciones</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Reservaciones en Lista</h1>
        <div className="text-sm text-gray-600">
          Total: {filteredReservations.length} reservaciones en {Object.keys(groupedReservations).length} viajes
        </div>
      </div>

      {/* Filtros de búsqueda y fecha */}
      <div className="mb-6 space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Selector de fecha */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <Input
              type="date"
              value={selectedDate}
              onChange={(e) => {
                setSelectedDate(e.target.value);
                setCurrentPage(1);
              }}
              className="w-48"
            />
          </div>
          
        </div>
      </div>

      {/* Lista de reservaciones agrupadas por viaje */}
      <div className="space-y-6">
        {paginatedGroups.map(([recordId, groupData]) => (
          <Card key={recordId} className="border-2 border-gray-200">
            <CardHeader 
              className="bg-gray-50 pb-3 cursor-pointer hover:bg-gray-100 transition-colors"
              onClick={() => handleTripClick(recordId, groupData.tripInfo, groupData.reservations)}
            >
              <CardTitle className="text-lg font-semibold text-gray-800">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-blue-600" />
                    {groupData.tripInfo ? 
                      `${groupData.tripInfo.origin} → ${groupData.tripInfo.destination} - ${formatDate(groupData.tripInfo.departureDate)}` :
                      `Viaje ${recordId}`
                    }
                  </div>

                </div>
                
                {/* Información adicional del viaje */}
                {groupData.tripInfo && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-sm font-normal text-gray-600">
                    {/* Horarios */}
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-green-600" />
                      <span>
                        {groupData.tripInfo.departureTime || 'Sin horario'} - {groupData.tripInfo.arrivalTime || 'Sin horario'}
                      </span>
                    </div>
                    
                    {/* Unidad */}
                    <div className="flex items-center gap-2">
                      <Truck className="h-4 w-4 text-orange-600" />
                      <span>
                        {groupData.tripInfo.vehicle?.licensePlate || 'Sin asignar'}
                      </span>
                    </div>
                    
                    {/* Operador */}
                    <div className="flex items-center gap-2">
                      <UserCheck className="h-4 w-4 text-purple-600" />
                      <span>
                        {groupData.tripInfo.driver ? 
                          `${groupData.tripInfo.driver.firstName} ${groupData.tripInfo.driver.lastName}` : 
                          'Sin asignar'
                        }
                      </span>
                    </div>
                  </div>
                )}
                
                <div className="text-sm font-normal text-gray-600 mt-2">
                  {groupData.reservations.length} reservación{groupData.reservations.length !== 1 ? 'es' : ''}
                </div>
              </CardTitle>
            </CardHeader>

          </Card>
        ))}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-2 mt-8">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
          >
            Anterior
          </Button>
          
          <span className="text-sm text-gray-600">
            Página {currentPage} de {totalPages}
          </span>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
          >
            Siguiente
          </Button>
        </div>
      )}

      {filteredReservations.length === 0 && (
        <div className="text-center py-12">
          <div className="text-gray-500">
            {searchTerm ? 'No se encontraron reservaciones que coincidan con la búsqueda.' : 'No hay reservaciones disponibles.'}
          </div>
        </div>
      )}

      {/* Sidebar de detalles de reservaciones */}
      {selectedTrip && (
        <ReservationDetailsSidebar
          recordId={selectedTrip.recordId}
          tripInfo={selectedTrip.tripInfo}
          reservations={selectedTrip.reservations}
          onClose={() => setSelectedTrip(null)}
        />
      )}
    </div>
  );
}

export function ReservationsListPage() {
  return (
    <DefaultLayout activeTab="reservations">
      <ReservationsListContent />
    </DefaultLayout>
  );
}