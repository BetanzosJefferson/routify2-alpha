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
        route: reservation.trip.route, // Incluir información de la ruta
        driver: reservation.trip.driver, // Incluir información del conductor
        vehicle: reservation.trip.vehicle // Incluir información del vehículo
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
          route: reservation.trip.route, // Incluir información de la ruta
          driver: reservation.trip.driver, // Incluir información del conductor
          vehicle: reservation.trip.vehicle // Incluir información del vehículo
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
        route: reservation.trip.route, // Incluir información de la ruta
        driver: reservation.trip.driver, // Incluir información del conductor
        vehicle: reservation.trip.vehicle // Incluir información del vehículo
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
        vehicle: parentTripInfo.vehicle, // Usar la información completa del vehículo del parentTripInfo
        driver: parentTripInfo.driver,   // Usar la información completa del conductor del parentTripInfo
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
    <div className="min-h-screen bg-gray-50">
      {/* Header optimizado para móvil */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Reservaciones en Lista</h1>
              <div className="text-sm text-gray-600 mt-1">
                Total: {filteredReservations.length} reservaciones en {Object.keys(groupedReservations).length} viajes
              </div>
            </div>
            
            {/* Selector de fecha compacto */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full md:w-48 text-sm"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Contenido principal con padding optimizado */}
      <div className="container mx-auto px-4 py-4 pb-20">

        {/* Lista de reservaciones agrupadas por viaje */}
        <div className="space-y-4">
          {paginatedGroups.map(([recordId, groupData]) => (
            <Card 
              key={recordId} 
              className="border border-gray-200 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer group overflow-hidden bg-white"
              onClick={() => handleTripClick(recordId, groupData.tripInfo, groupData.reservations)}
            >
              {/* Header con gradiente y ruta principal - optimizado para móvil */}
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-3 md:p-4">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 md:gap-0">
                  <div className="flex items-center gap-2 md:gap-3 flex-1">
                    <div className="bg-white/20 p-1.5 md:p-2 rounded-lg flex-shrink-0">
                      <MapPin className="h-4 w-4 md:h-5 md:w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-base md:text-lg leading-tight">
                        {groupData.tripInfo ? 
                          `${groupData.tripInfo.origin.split(' - ')[0]} → ${groupData.tripInfo.destination.split(' - ')[0]}` :
                          `Viaje ${recordId}`
                        }
                      </h3>
                      <p className="text-blue-100 text-xs md:text-sm mt-1">
                        {groupData.tripInfo && formatDate(groupData.tripInfo.departureDate)}
                      </p>
                    </div>
                  </div>
                  
                  {/* Contador de reservaciones */}
                  <div className="bg-white/20 px-2 md:px-3 py-1 rounded-full flex-shrink-0">
                    <span className="text-xs md:text-sm font-medium">
                      {groupData.reservations.length} reservación{groupData.reservations.length !== 1 ? 'es' : ''}
                    </span>
                  </div>
                </div>
              </div>

              {/* Contenido con información detallada - optimizado para móvil */}
              <CardContent className="p-3 md:p-4 bg-white group-hover:bg-gray-50/50 transition-colors">
                {groupData.tripInfo && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 md:gap-4">
                    {/* Horarios - optimizado para móvil */}
                    <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-green-50 rounded-lg border border-green-100">
                      <div className="bg-green-100 p-1.5 md:p-2 rounded-lg flex-shrink-0">
                        <Clock className="h-3 w-3 md:h-4 md:w-4 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-green-600 font-medium uppercase tracking-wide">Horario</p>
                        <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                          {groupData.tripInfo.departureTime || 'Sin horario'} - {groupData.tripInfo.arrivalTime || 'Sin horario'}
                        </p>
                      </div>
                    </div>
                    
                    {/* Unidad - optimizado para móvil */}
                    <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-orange-50 rounded-lg border border-orange-100">
                      <div className="bg-orange-100 p-1.5 md:p-2 rounded-lg flex-shrink-0">
                        <Truck className="h-3 w-3 md:h-4 md:w-4 text-orange-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-orange-600 font-medium uppercase tracking-wide">Unidad</p>
                        <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                          {groupData.tripInfo.vehicle?.plates ? 
                            `${groupData.tripInfo.vehicle.brand || ''} ${groupData.tripInfo.vehicle.model || ''} ${groupData.tripInfo.vehicle.plates}`.trim() : 
                            'Sin asignar'
                          }
                        </p>
                      </div>
                    </div>
                    
                    {/* Operador - optimizado para móvil */}
                    <div className="flex items-center gap-2 md:gap-3 p-2 md:p-3 bg-purple-50 rounded-lg border border-purple-100 md:col-span-1 col-span-1">
                      <div className="bg-purple-100 p-1.5 md:p-2 rounded-lg flex-shrink-0">
                        <UserCheck className="h-3 w-3 md:h-4 md:w-4 text-purple-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-purple-600 font-medium uppercase tracking-wide">Operador</p>
                        <p className="text-xs md:text-sm font-semibold text-gray-900 truncate">
                          {groupData.tripInfo.driver && groupData.tripInfo.driver.firstName ? 
                            `${groupData.tripInfo.driver.firstName} ${groupData.tripInfo.driver.lastName}` : 
                            'Sin asignar'
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Indicador de acción - optimizado para móvil */}
                <div className="mt-3 md:mt-4 flex items-center justify-center text-gray-400 group-hover:text-blue-600 transition-colors">
                  <span className="text-xs font-medium">Haz clic para ver detalles</span>
                  <div className="ml-2 transform group-hover:translate-x-1 transition-transform">
                    →
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Paginación optimizada para móvil */}
        {totalPages > 1 && (
          <div className="flex justify-center items-center gap-2 mt-6 md:mt-8">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="text-xs md:text-sm"
            >
              Anterior
            </Button>
            
            <span className="text-xs md:text-sm text-gray-600 px-2">
              Página {currentPage} de {totalPages}
            </span>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
              disabled={currentPage === totalPages}
              className="text-xs md:text-sm"
            >
              Siguiente
            </Button>
          </div>
        )}

        {/* Estado vacío optimizado para móvil */}
        {filteredReservations.length === 0 && (
          <div className="text-center py-8 md:py-12">
            <div className="text-gray-500 text-sm md:text-base">
              No hay reservaciones disponibles para la fecha seleccionada.
            </div>
          </div>
        )}
      </div>

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