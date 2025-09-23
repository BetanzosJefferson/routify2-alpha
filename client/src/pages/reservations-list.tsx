import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReservations } from "@/hooks/use-reservations";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatPrice, formatTime, formatDateForInput, normalizeToStartOfDay, isSameLocalDay, getCurrentLocalDate } from "@/lib/utils";
import { Search, Calendar, Users, CreditCard, Building2, User, ChevronDown, ChevronUp, Truck, UserCheck, Filter, MapPin, Clock } from "lucide-react";

import { ReservationWithDetails } from "@shared/schema";
import DefaultLayout from "@/components/layout/default-layout";
import { ReservationDetailsSidebar } from "@/components/reservations/reservation-details-sidebar";
import { useQueryClient } from "@tanstack/react-query";
import { cacheInvalidation } from "@/lib/queryClient";
import { ErrorBoundary } from "@/components/error-boundary";
import { withErrorHandling } from "@/lib/error-handler";

function ReservationsListContent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [hasError, setHasError] = useState(false);
  const [routeFilter, setRouteFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");
  
  // Verificar si el usuario es chofer
  const isDriver = user?.role === 'chofer';

  // Usar la función global getCurrentLocalDate() para consistencia
  const currentDate = getCurrentLocalDate();
  const [selectedDate, setSelectedDate] = useState(currentDate);
  const [searchDate, setSearchDate] = useState(currentDate); // Usar fecha actual por defecto
  
  // Component initialized
  
  // Agregar opción para que el usuario pueda especificar la fecha actual manualmente
  const [manualDateMode, setManualDateMode] = useState(false);
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
  } = useReservations({
    // ✅ OPTIMIZACIÓN: Filtrar por fecha actual por defecto para mejorar performance
    date: searchDate, // Usar searchDate que por defecto es la fecha actual
    enabled: true,
    parentTripFilter: true // 🎯 FILTRO POR VIAJE PADRE: Incluir sub-viajes del mismo día padre
  });

  // Manejo silencioso de errores - solo log sin modal
  if (error && !hasError) {
    setHasError(true);
    console.warn('Error en reservaciones-list (silenciado):', error);
  }

  // Reservations loaded
  
  // Función para realizar búsqueda con invalidación de cache
  const handleSearch = async () => {
    // Starting search
    
    // CORREGIDO: Invalidar cache usando queryKeys exactos para evitar problemas de invalidación
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.includes('/api/reservations');
      }
    });
    
    // Aplicar filtro de fecha
    setSearchDate(selectedDate);
    setCurrentPage(1);
  };

  // Actualizar fecha seleccionada CON búsqueda automática
  const handleDateChange = async (newDate: string) => {
    setSelectedDate(newDate);
    setSearchDate(newDate); // Actualizar inmediatamente para búsqueda automática
    setCurrentPage(1);
    
    // Invalidar cache automáticamente
    await queryClient.invalidateQueries({
      predicate: (query) => {
        const key = query.queryKey[0];
        return typeof key === 'string' && key.includes('/api/reservations');
      }
    });
  };
  
  // Búsqueda con Enter
  const handleKeyPress = async (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      await handleSearch();
    }
  };

  // Filtrar reservaciones solo por término de búsqueda (fecha ya filtrada en backend)
  const filteredReservations = reservations.filter((reservation) => {
    // Excluir reservaciones canceladas
    if (reservation.status === 'canceled' || reservation.status === 'canceledAndRefund') {
      return false;
    }

    // FILTRO PARA CHÓFERES: El backend ya filtra las reservaciones por conductor asignado
    // No necesitamos filtrar aquí porque el backend ya devuelve solo las reservaciones del conductor
    
    // Filtro de texto: buscar en nombres de pasajeros y usuario creador
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const matchesText = (
        reservation.id.toString().includes(searchLower) ||
        reservation.phone?.toLowerCase().includes(searchLower) ||
        reservation.email?.toLowerCase().includes(searchLower) ||
        reservation.trip?.origin?.toLowerCase().includes(searchLower) ||
        reservation.trip?.destination?.toLowerCase().includes(searchLower) ||
        reservation.createdByUser?.firstName?.toLowerCase().includes(searchLower) ||
        reservation.createdByUser?.lastName?.toLowerCase().includes(searchLower)
      );
      if (!matchesText) return false;
    }



    return true;
  });

  // Agrupar reservaciones por recordId (viaje padre)
  const groupedReservations = filteredReservations.reduce((groups, reservation) => {
    // Extraer recordId del tripDetails
    const tripDetails = reservation.tripDetails as any;
    let recordId = tripDetails?.recordId?.toString() || 'sin-record-id';
    
    // IMPORTANTE: Normalizar recordId - usar solo la parte base sin sufijos como _122
    if (recordId.includes('_')) {
      recordId = recordId.split('_')[0];
      // RecordId normalized
    }
    
    // Usar recordId normalizado como clave de agrupación
    const groupKey = recordId;
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        reservations: [],
        tripInfo: null,
        parentTripDate: null // Para almacenar la fecha del viaje padre
      };
    }
    
    groups[groupKey].reservations.push(reservation);
    
    // Establecer información del viaje padre usando la información del viaje padre (recordId)
    if (!groups[groupKey].tripInfo) {
      // Processing reservation trip info
      
      // Processing driver info
      
      // Buscar información del viaje padre si está disponible
      const parentTripInfo = reservation.trip?.parentTrip;
      if (parentTripInfo) {
        groups[groupKey].tripInfo = {
          origin: parentTripInfo.origin,
          destination: parentTripInfo.destination,
          departureDate: parentTripInfo.departureDate,
          departureTime: parentTripInfo.departureTime,
          arrivalTime: parentTripInfo.arrivalTime,
          recordId: recordId,
          route: parentTripInfo.route,
          driver: parentTripInfo.driver || reservation.trip?.driver, // Usar conductor del trip principal si parentTrip no tiene
          vehicle: parentTripInfo.vehicle || reservation.trip?.vehicle
        };
        
        // Driver assigned from parent trip
        groups[groupKey].parentTripDate = parentTripInfo.departureDate;
      } else if (reservation.trip) {
        // Fallback: usar información del trip asociado
        groups[groupKey].tripInfo = {
          origin: reservation.trip.origin,
          destination: reservation.trip.destination,
          departureDate: reservation.trip.departureDate,
          departureTime: reservation.trip.departureTime,
          arrivalTime: reservation.trip.arrivalTime,
          recordId: recordId,
          route: reservation.trip.route,
          driver: reservation.trip.driver || reservation.tripDetails?.trip?.driver,
          vehicle: reservation.trip.vehicle || reservation.tripDetails?.trip?.vehicle
        };
        
        // Driver assigned from fallback
        groups[groupKey].parentTripDate = reservation.trip.departureDate;
      }
    }
    
    return groups;
  }, {} as Record<string, { reservations: ReservationWithDetails[], tripInfo: any, parentTripDate: string | null }>);

  // CRÍTICO: NO filtrar por fecha en el frontend porque el backend ya maneja el parentTripFilter
  // El backend con parentTripFilter=true ya envía solo las reservas del día correcto
  const filteredGroupedReservations = groupedReservations;
  
  // Groups filtered

  // Aplicar filtros adicionales de ruta y hora
  const finalFilteredReservations = Object.entries(filteredGroupedReservations).reduce((filtered, [groupKey, group]) => {
    let includeGroup = true;
    
    // Filtro de ruta
    if (routeFilter !== "all" && group.tripInfo) {
      const routeString = `${group.tripInfo.origin} → ${group.tripInfo.destination}`;
      if (routeString !== routeFilter) {
        includeGroup = false;
      }
    }
    
    // Filtro de hora
    if (timeFilter !== "all" && group.tripInfo) {
      if (group.tripInfo.departureTime !== timeFilter) {
        includeGroup = false;
      }
    }
    
    if (includeGroup) {
      filtered[groupKey] = group;
    }
    
    return filtered;
  }, {} as Record<string, { reservations: ReservationWithDetails[], tripInfo: any, parentTripDate: string | null }>);

  // Filtering completed

  // Generar opciones de filtro dinámicamente
  const availableRoutes = Array.from(new Set(
    Object.values(groupedReservations)
      .filter(group => group.tripInfo)
      .map(group => `${group.tripInfo.origin} → ${group.tripInfo.destination}`)
  )).sort();

  const availableTimes = Array.from(new Set(
    Object.values(groupedReservations)
      .filter(group => group.tripInfo?.departureTime)
      .map(group => group.tripInfo.departureTime)
  )).sort();

  // Paginación aplicada a los grupos filtrados
  const totalGroups = Object.keys(finalFilteredReservations).length;
  const totalPages = Math.ceil(totalGroups / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedGroups = Object.entries(finalFilteredReservations).slice(startIndex, startIndex + itemsPerPage);

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
                Total: {filteredReservations.length} reservaciones en {Object.keys(finalFilteredReservations).length} viajes
              </div>
            </div>
            
            {/* Selector de fecha con botón buscar */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  // Date selected
                  handleDateChange(e.target.value);
                }}
                onKeyPress={handleKeyPress}
                className="w-full md:w-32 text-sm"
                placeholder="Seleccionar fecha"
              />
              <Button
                onClick={handleSearch}
                size="sm"
                className="whitespace-nowrap bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? "Buscando..." : "Actualizar"}
              </Button>
             
            
            </div>
          </div>
          
          {/* Filtros */}
          <div className="flex flex-col gap-3 mt-4 pt-4 border-t">
            {/* Primera fila: Búsqueda por texto */}
            <div className="flex items-center gap-2 w-full">
              <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <Input
                placeholder="Buscar por nombre, teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            
            {/* Segunda fila: Filtros de ruta y hora */}
            <div className="flex flex-col md:flex-row gap-3">
              {/* Filtro de ruta */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <Select value={routeFilter} onValueChange={setRouteFilter}>
                  <SelectTrigger className="w-full md:w-[250px]">
                    <SelectValue placeholder="Filtrar por ruta" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las rutas</SelectItem>
                    {availableRoutes.map(route => (
                      <SelectItem key={route} value={route}>
                        {route}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Filtro de hora */}
              <div className="flex items-center gap-2 w-full md:w-auto">
                <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <Select value={timeFilter} onValueChange={setTimeFilter}>
                  <SelectTrigger className="w-full md:w-[150px]">
                    <SelectValue placeholder="Filtrar por hora" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas las horas</SelectItem>
                    {availableTimes.map(time => (
                      <SelectItem key={time} value={time}>
                        {time}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* Botón para limpiar filtros */}
              {(searchTerm || routeFilter !== "all" || timeFilter !== "all") && (
                <Button
                  onClick={() => {
                    setSearchTerm("");
                    setRouteFilter("all");
                    setTimeFilter("all");
                  }}
                  size="sm"
                  variant="outline"
                  className="whitespace-nowrap"
                >
                  <Filter className="h-4 w-4 mr-2" />
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Banner informativo para chóferes */}
      {isDriver && (
        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 mx-4">
          <div className="flex items-center gap-2">
            <Truck className="h-5 w-5 text-blue-600" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">
                Vista de conductor
              </h3>
              <p className="text-sm text-blue-700">
                Mostrando solo las reservaciones de los viajes asignados a ti como conductor.
              </p>
            </div>
          </div>
        </div>
      )}

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
        <ErrorBoundary 
          fallback={(error, reset) => (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white p-6 rounded-lg shadow-lg max-w-md">
                <h3 className="text-lg font-semibold mb-2">Error en el sidebar</h3>
                <p className="text-gray-600 mb-4">
                  Ha ocurrido un error al cargar los detalles de la reservación.
                </p>
                <div className="flex gap-2">
                  <Button onClick={reset} variant="default">
                    Reintentar
                  </Button>
                  <Button onClick={() => setSelectedTrip(null)} variant="outline">
                    Cerrar
                  </Button>
                </div>
              </div>
            </div>
          )}
        >
          <ReservationDetailsSidebar
            recordId={selectedTrip.recordId}
            tripInfo={selectedTrip.tripInfo}
            reservations={selectedTrip.reservations}
            onClose={() => setSelectedTrip(null)}
            onReservationUpdate={async () => {
              // Usar el nuevo sistema unificado de invalidación
              await cacheInvalidation.fullRefresh({ reservations: true, trips: true });
            }}
          />
        </ErrorBoundary>
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