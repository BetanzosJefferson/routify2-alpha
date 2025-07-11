import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useReservations } from "@/hooks/use-reservations";
import { useAuth } from "@/hooks/use-auth";
import { formatDate, formatPrice, formatTime, formatDateForInput, normalizeToStartOfDay, isSameLocalDay } from "@/lib/utils";
import { Search, Calendar, MapPin, Users, CreditCard, Building2, User, ChevronDown, ChevronUp, Clock, Truck, UserCheck, Filter } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ReservationWithDetails } from "@shared/schema";
import DefaultLayout from "@/components/layout/default-layout";
import { ReservationDetailsSidebar } from "@/components/reservations/reservation-details-sidebar";
import { useQueryClient } from "@tanstack/react-query";

function ReservationsListContent() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [routeFilter, setRouteFilter] = useState("");
  const [timeFilter, setTimeFilter] = useState("");
  
  // Verificar si el usuario es chofer
  const isDriver = user?.role === 'chofer';
  // Obtener la fecha actual - permitir que el usuario configure la fecha correcta
  const getCurrentDate = () => {
    const now = new Date();
    
    // Método 1: Fecha del sistema local
    const systemDate = new Date();
    
    // Método 2: Fecha en zona horaria de México
    const mexicoDate = new Date(now.toLocaleString("en-US", {timeZone: "America/Mexico_City"}));
    
    // Método 3: Fecha simple del día actual (sin conversión de zona horaria)
    const simpleDate = new Date();
    simpleDate.setHours(12, 0, 0, 0); // Fijar a mediodía para evitar problemas de zona horaria
    
    console.log(`[Reservaciones] ========== DIAGNÓSTICO COMPLETO DE FECHA ==========`);
    console.log(`[Reservaciones] Fecha sistema UTC: ${now.toISOString()}`);
    console.log(`[Reservaciones] Fecha sistema local: ${systemDate.toLocaleDateString()}`);
    console.log(`[Reservaciones] Fecha México: ${mexicoDate.toISOString()}`);
    console.log(`[Reservaciones] Fecha simple: ${simpleDate.toLocaleDateString()}`);
    console.log(`[Reservaciones] Formato para input (sistema): ${formatDateForInput(systemDate)}`);
    console.log(`[Reservaciones] Formato para input (México): ${formatDateForInput(mexicoDate)}`);
    console.log(`[Reservaciones] Formato para input (simple): ${formatDateForInput(simpleDate)}`);
    console.log(`[Reservaciones] ======================================================`);
    
    // Usar la fecha del sistema local por defecto
    return systemDate;
  };

  const [selectedDate, setSelectedDate] = useState(formatDateForInput(getCurrentDate()));
  const [searchDate, setSearchDate] = useState(formatDateForInput(getCurrentDate())); // Usar fecha actual por defecto
  
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
    // No filtrar por fecha en el backend - traer todas las reservaciones
    // El filtrado se hará en el frontend después de agrupar por viaje padre
  });

  // Log para depuración
  console.log(`[Reservaciones] Fecha búsqueda: ${searchDate}, Fecha seleccionada: ${selectedDate}, Reservaciones cargadas: ${reservations.length}`);
  console.log(`[Reservaciones] Usuario: ${user?.firstName} ${user?.lastName}, Rol: ${user?.role}, ID: ${user?.id}`);
  
  // Función para realizar búsqueda con invalidación de cache
  const handleSearch = async () => {
    console.log(`[Reservaciones] Iniciando búsqueda para fecha: ${selectedDate}`);
    
    // Invalidar cache de reservaciones para forzar nueva consulta
    await queryClient.invalidateQueries({
      queryKey: ["/api/reservations"]
    });
    
    // Solo aplicar filtro de fecha si se especifica una fecha
    setSearchDate(selectedDate);
    setCurrentPage(1);
  };

  // Actualizar fecha de búsqueda automáticamente cuando cambia la fecha seleccionada
  const handleDateChange = (newDate: string) => {
    setSelectedDate(newDate);
    setSearchDate(newDate); // Actualizar automáticamente
    setCurrentPage(1);
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

    // FILTRO PARA CHÓFERES: Solo mostrar reservaciones de viajes donde el chofer está asignado
    if (isDriver && user?.id) {
      const tripInfo = reservation.tripDetails?.trip || reservation.trip;
      const driverId = tripInfo?.driver?.id || tripInfo?.driverId;
      
      // Si no hay información del conductor o el conductor no coincide, filtrar
      if (!driverId || driverId !== user.id) {
        console.log(`[DRIVER_FILTER] Filtrando reservación ${reservation.id} - Conductor asignado: ${driverId}, Usuario actual: ${user.id}`);
        return false;
      }
    }
    
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

    // Filtro de ruta: buscar en origen y destino
    if (routeFilter) {
      const routeLower = routeFilter.toLowerCase();
      const tripDetails = reservation.tripDetails as any;
      const origin = tripDetails?.origin || reservation.trip?.origin || '';
      const destination = tripDetails?.destination || reservation.trip?.destination || '';
      const matchesRoute = (
        origin.toLowerCase().includes(routeLower) ||
        destination.toLowerCase().includes(routeLower)
      );
      if (!matchesRoute) return false;
    }

    // Filtro de horario: buscar en hora de salida
    if (timeFilter) {
      const tripDetails = reservation.tripDetails as any;
      const departureTime = tripDetails?.departureTime || reservation.trip?.departureTime || '';
      const matchesTime = departureTime.includes(timeFilter);
      if (!matchesTime) return false;
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
      console.log(`[Frontend] Normalizando recordId de ${tripDetails.recordId} a ${recordId}`);
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
      // DEBUG: Logging detallado de la estructura de datos
      console.log(`[TRIP_INFO_DEBUG] Procesando reservación ${reservation.id}:`, {
        'tripDetails': reservation.tripDetails,
        'trip': reservation.trip,
        'trip?.parentTrip': reservation.trip?.parentTrip,
        'trip?.driver': reservation.trip?.driver,
        'trip?.parentTrip?.driver': reservation.trip?.parentTrip?.driver,
        'tripDetails?.trip?.driver': reservation.tripDetails?.trip?.driver
      });
      
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
          driver: parentTripInfo.driver,
          vehicle: parentTripInfo.vehicle
        };
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
        groups[groupKey].parentTripDate = reservation.trip.departureDate;
      }
    }
    
    return groups;
  }, {} as Record<string, { reservations: ReservationWithDetails[], tripInfo: any, parentTripDate: string | null }>);

  // Filtrar grupos por fecha del viaje padre si se especifica una fecha de búsqueda
  const filteredGroupedReservations = Object.entries(groupedReservations).reduce((filtered, [groupKey, group]) => {
    // Si no hay fecha de búsqueda, incluir todos los grupos
    if (!searchDate) {
      filtered[groupKey] = group;
      return filtered;
    }
    
    // Verificar si la fecha del viaje padre coincide con la fecha de búsqueda
    const parentTripDate = group.parentTripDate || group.tripInfo?.departureDate;
    const matches = parentTripDate && isSameLocalDay(parentTripDate, searchDate);
    
    console.log(`[FILTER_DEBUG] Grupo ${groupKey}:`, {
      parentTripDate,
      searchDate,
      matches,
      reservationsCount: group.reservations.length,
      tripInfo: group.tripInfo
    });
    
    if (matches) {
      filtered[groupKey] = group;
    }
    
    return filtered;
  }, {} as Record<string, { reservations: ReservationWithDetails[], tripInfo: any, parentTripDate: string | null }>);

  // Agregar logging adicional para debug
  console.log(`[FILTER_DEBUG] Total grupos antes del filtrado: ${Object.keys(groupedReservations).length}`);
  console.log(`[FILTER_DEBUG] Fecha de búsqueda: ${searchDate}`);
  console.log(`[FILTER_DEBUG] Total grupos después del filtrado: ${Object.keys(filteredGroupedReservations).length}`);
  console.log(`[DRIVER_FILTER] Es conductor: ${isDriver}, Reservaciones filtradas: ${filteredReservations.length} de ${reservations.length}`);

  // Paginación aplicada a los grupos filtrados
  const totalGroups = Object.keys(filteredGroupedReservations).length;
  const totalPages = Math.ceil(totalGroups / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedGroups = Object.entries(filteredGroupedReservations).slice(startIndex, startIndex + itemsPerPage);

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
                Total: {filteredReservations.length} reservaciones en {Object.keys(filteredGroupedReservations).length} viajes
              </div>
            </div>
            
            {/* Selector de fecha con botón buscar */}
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Calendar className="h-4 w-4 text-gray-400" />
              <Input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  console.log(`[Reservaciones] Cambiando fecha de ${selectedDate} a ${e.target.value}`);
                  handleDateChange(e.target.value);
                }}
                onKeyPress={handleKeyPress}
                className="w-full md:w-32 text-sm"
              />
              <Button
                onClick={handleSearch}
                size="sm"
                className="whitespace-nowrap bg-blue-600 hover:bg-blue-700"
                disabled={isLoading}
              >
                {isLoading ? "Buscando..." : "Buscar"}
              </Button>
              {/* Botón para usar fecha de hoy */}
              <Button
                onClick={() => {
                  const today = formatDateForInput(new Date());
                  console.log(`[Reservaciones] Estableciendo fecha de hoy: ${today}`);
                  handleDateChange(today);
                }}
                size="sm"
                variant="outline"
                className="whitespace-nowrap"
              >
                Hoy
              </Button>
              <Button
                onClick={() => {
                  const manualDate = prompt("¿Cuál es la fecha correcta de hoy? (formato: YYYY-MM-DD, ejemplo: 2025-01-15)");
                  if (manualDate && manualDate.match(/^\d{4}-\d{2}-\d{2}$/)) {
                    console.log(`[Reservaciones] Estableciendo fecha manual: ${manualDate}`);
                    handleDateChange(manualDate);
                  }
                }}
                size="sm"
                variant="outline"
                className="whitespace-nowrap"
              >
                Manual
              </Button>
            </div>
          </div>
          
          {/* Filtros de ruta y horario */}
          <div className="flex flex-col md:flex-row gap-3 mt-4 pt-4 border-t">
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <Input
                placeholder="Buscar por nombre, teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <MapPin className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <Select value={routeFilter} onValueChange={setRouteFilter}>
                <SelectTrigger className="w-full md:w-48">
                  <SelectValue placeholder="Filtrar por ruta" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas las rutas</SelectItem>
                  <SelectItem value="Acapulco">Acapulco</SelectItem>
                  <SelectItem value="Taxqueña">Taxqueña</SelectItem>
                  <SelectItem value="Chilpancingo">Chilpancingo</SelectItem>
                  <SelectItem value="Cuernavaca">Cuernavaca</SelectItem>
                  <SelectItem value="Coyoacán">Coyoacán</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              <Clock className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <Select value={timeFilter} onValueChange={setTimeFilter}>
                <SelectTrigger className="w-full md:w-32">
                  <SelectValue placeholder="Horario" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="06:00">6:00 AM</SelectItem>
                  <SelectItem value="07:00">7:00 AM</SelectItem>
                  <SelectItem value="08:00">8:00 AM</SelectItem>
                  <SelectItem value="09:00">9:00 AM</SelectItem>
                  <SelectItem value="10:00">10:00 AM</SelectItem>
                  <SelectItem value="11:00">11:00 AM</SelectItem>
                  <SelectItem value="12:00">12:00 PM</SelectItem>
                  <SelectItem value="13:00">1:00 PM</SelectItem>
                  <SelectItem value="14:00">2:00 PM</SelectItem>
                  <SelectItem value="15:00">3:00 PM</SelectItem>
                  <SelectItem value="16:00">4:00 PM</SelectItem>
                  <SelectItem value="17:00">5:00 PM</SelectItem>
                  <SelectItem value="18:00">6:00 PM</SelectItem>
                  <SelectItem value="19:00">7:00 PM</SelectItem>
                  <SelectItem value="20:00">8:00 PM</SelectItem>
                  <SelectItem value="21:00">9:00 PM</SelectItem>
                  <SelectItem value="22:00">10:00 PM</SelectItem>
                  <SelectItem value="23:00">11:00 PM</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {/* Botón para limpiar filtros */}
            {(searchTerm || routeFilter || timeFilter) && (
              <Button
                onClick={() => {
                  setSearchTerm("");
                  setRouteFilter("");
                  setTimeFilter("");
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