import { useState, useMemo } from "react";
import { Calendar, FileText, DollarSign, Package, Users, Truck, UserCheck, Clock, MapPin, Filter, Search } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useReservations } from "@/hooks/use-reservations";
import { usePackages } from "@/hooks/use-packages";
import { useTrips } from "@/hooks/use-trips";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { TripLogDetailsSidebar } from "./trip-log-details-sidebar";

type ReservationWithPassengers = any; // Usar el tipo ya definido
type PackageWithDetails = any; // Usar el tipo ya definido

type TripLogData = {
  recordId: number;
  tripInfo: any;
  reservations: ReservationWithPassengers[];
  packages: PackageWithDetails[];
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
};

export function TripLogbook() {
  const [selectedDate, setSelectedDate] = useState(() => {
    const today = new Date();
    return format(today, 'yyyy-MM-dd');
  });
  const [selectedTrip, setSelectedTrip] = useState<TripLogData | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [routeFilter, setRouteFilter] = useState("all");
  const [timeFilter, setTimeFilter] = useState("all");

  // Hooks para obtener datos con filtros de fecha optimizados
  const { data: reservations = [], isLoading: isLoadingReservations } = useReservations({
    date: selectedDate // Filtrar reservaciones por fecha seleccionada
  });
  const { data: packages = [], isLoading: isLoadingPackages } = usePackages({
    // No filtrar paquetes por fecha para obtener todos los asociados a viajes
  });
  const { data: trips = [], isLoading: isLoadingTrips } = useTrips({
    date: selectedDate, // Filtrar viajes por fecha seleccionada
    isSubTrip: false // Solo viajes principales para mejor rendimiento
  });

  // Log para depuración de rendimiento
  console.log(`[Bitácora] Datos cargados - Reservaciones: ${reservations.length}, Paquetes: ${packages.length}, Viajes: ${trips.length}`);

  // Mostrar todas las reservaciones asociadas a los viajes
  const validReservations = useMemo(() => {
    return reservations; // Mostrar todas las reservaciones sin filtros de pago
  }, [reservations]);

  // Mostrar todas las paqueterías asociadas a los viajes
  const validPackages = useMemo(() => {
    return packages; // Mostrar todos los paquetes sin filtros de pago
  }, [packages]);

  // Los datos ya vienen filtrados por fecha desde el backend
  const dateFilteredReservations = validReservations;

  // Los datos ya vienen filtrados por fecha desde el backend
  const dateFilteredPackages = validPackages;

  // Generar opciones de filtrado dinámicamente
  const availableRoutes = useMemo(() => {
    const routeSet = new Set<string>();
    
    dateFilteredReservations.forEach((reservation: any) => {
      const trip = reservation.trip;
      if (trip?.route?.origin && trip?.route?.destination) {
        const routeString = `${trip.route.origin} → ${trip.route.destination}`;
        routeSet.add(routeString);
      }
    });
    
    dateFilteredPackages.forEach((pkg: any) => {
      const tripDetails = pkg.tripDetails;
      if (tripDetails?.origin && tripDetails?.destination) {
        const routeString = `${tripDetails.origin} → ${tripDetails.destination}`;
        routeSet.add(routeString);
      }
    });
    
    return Array.from(routeSet).sort();
  }, [dateFilteredReservations, dateFilteredPackages]);

  const availableTimes = useMemo(() => {
    const timeSet = new Set<string>();
    
    dateFilteredReservations.forEach((reservation: any) => {
      const trip = reservation.trip;
      if (trip?.departureTime) {
        timeSet.add(trip.departureTime);
      }
    });
    
    dateFilteredPackages.forEach((pkg: any) => {
      const tripDetails = pkg.tripDetails;
      if (tripDetails?.departureTime) {
        timeSet.add(tripDetails.departureTime);
      }
    });
    
    return Array.from(timeSet).sort();
  }, [dateFilteredReservations, dateFilteredPackages]);

  // Agrupar por viajes
  const groupedTrips = useMemo(() => {
    const groups: { [key: string]: TripLogData } = {};

    // Agrupar reservaciones por viaje
    dateFilteredReservations.forEach((reservation: any) => {
      const tripDetails = reservation.tripDetails as any;
      if (!tripDetails || !reservation.trip) return;

      const recordId = tripDetails.recordId;
      const tripKey = `${recordId}`;

      if (!groups[tripKey]) {
        groups[tripKey] = {
          recordId,
          tripInfo: reservation.trip,
          reservations: [],
          packages: [],
          totalSales: 0,
          totalExpenses: 0,
          netProfit: 0
        };
      }

      groups[tripKey].reservations.push(reservation);
      groups[tripKey].totalSales += reservation.totalAmount || 0;
    });

    // Agregar paqueterías a los grupos existentes basándose en recordId del viaje padre
    dateFilteredPackages.forEach((pkg: any) => {
      const tripDetails = pkg.tripDetails as any;
      if (!tripDetails) return;

      // Extraer recordId del viaje padre del tripId (ejemplo: "1223_98_98" -> "1223")
      let recordId = tripDetails.recordId || tripDetails.tripId;
      if (typeof recordId === 'string' && recordId.includes('_')) {
        recordId = recordId.split('_')[0];
      }
      recordId = parseInt(recordId);
      


      const tripKey = `${recordId}`;

      // Si el grupo existe, agregar el paquete
      if (groups[tripKey]) {
        groups[tripKey].packages.push(pkg);
        groups[tripKey].totalSales += pkg.price || 0;
      } else {
        // Si no existe el grupo, crear uno nuevo para el viaje padre
        // Buscar información del viaje padre en los trips disponibles
        const parentTrip = trips.find((trip: any) => trip.id === recordId);
        if (parentTrip) {
          groups[tripKey] = {
            recordId,
            tripInfo: parentTrip,
            reservations: [],
            packages: [pkg],
            totalSales: pkg.price || 0,
            totalExpenses: 0,
            netProfit: 0
          };
        }
      }
    });

    // Calcular ganancias netas (por ahora sin gastos, se agregará después)
    Object.values(groups).forEach(group => {
      group.netProfit = group.totalSales - group.totalExpenses;
    });

    return Object.values(groups);
  }, [dateFilteredReservations, dateFilteredPackages, trips]);

  // Aplicar filtros adicionales a los grupos de viajes
  const finalFilteredTrips = useMemo(() => {
    return groupedTrips.filter(tripData => {
      // Filtro por término de búsqueda
      if (searchTerm) {
        const searchLower = searchTerm.toLowerCase();
        const tripInfo = tripData.tripInfo;
        const routeInfo = tripInfo?.route;
        
        const matchesSearch = 
          routeInfo?.origin?.toLowerCase().includes(searchLower) ||
          routeInfo?.destination?.toLowerCase().includes(searchLower) ||
          routeInfo?.name?.toLowerCase().includes(searchLower) ||
          tripInfo?.driver?.firstName?.toLowerCase().includes(searchLower) ||
          tripInfo?.driver?.lastName?.toLowerCase().includes(searchLower);
        
        if (!matchesSearch) return false;
      }
      
      // Filtro por ruta
      if (routeFilter !== "all") {
        const routeInfo = tripData.tripInfo?.route;
        if (routeInfo?.origin && routeInfo?.destination) {
          const routeString = `${routeInfo.origin} → ${routeInfo.destination}`;
          if (routeString !== routeFilter) return false;
        } else {
          return false;
        }
      }
      
      // Filtro por hora
      if (timeFilter !== "all") {
        const tripInfo = tripData.tripInfo;
        const departureTime = (tripInfo?.parentTrip || tripInfo)?.departureTime;
        if (departureTime !== timeFilter) return false;
      }
      
      return true;
    });
  }, [groupedTrips, searchTerm, routeFilter, timeFilter]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return format(date, 'd/MM/yyyy', { locale: es });
    } catch {
      return dateString;
    }
  };

  // Totales generales del día
  const dayTotals = useMemo(() => {
    let totalPorVender = 0;
    let ventasReales = 0;
    let totalTrips = finalFilteredTrips.length;
    let totalReservations = 0;
    let totalPackages = 0;

    finalFilteredTrips.forEach(trip => {
      totalReservations += trip.reservations.length;
      totalPackages += trip.packages.length;

      // Calcular para reservaciones
      trip.reservations.forEach((reservation: any) => {
        totalPorVender += reservation.totalAmount;
        const advanceAmount = reservation.advanceAmount || 0;
        ventasReales += advanceAmount;
      });

      // Calcular para paqueterías
      trip.packages.forEach((pkg: any) => {
        totalPorVender += pkg.price || 0;
        // Asumir que paqueterías están pagadas (podrías verificar un campo de estado si existe)
        ventasReales += pkg.price || 0;
      });
    });

    return { totalPorVender, ventasReales, totalTrips, totalReservations, totalPackages };
  }, [finalFilteredTrips]);

  if (isLoadingReservations || isLoadingPackages || isLoadingTrips) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Cargando bitácora...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      {/* Header con controles y métricas */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <FileText className="h-8 w-8" />
            Bitácora de Viajes
          </h1>
          <p className="text-gray-600 mt-1">
            Registro completo de viajes con todas las reservaciones y paqueterías
          </p>
          <div className="text-sm text-gray-600 mt-1">
            Total: {finalFilteredTrips.length} viajes con {dayTotals.totalReservations} reservaciones y {dayTotals.totalPackages} paqueterías
          </div>
        </div>
        
        {/* Selector de fecha */}
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-400" />
          <Input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="w-48"
          />
        </div>
      </div>

      {/* Leyenda explicativa */}
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
        <div className="flex items-start gap-2">
          <div className="bg-blue-500 rounded-full p-1 mt-0.5">
            <div className="w-2 h-2 bg-white rounded-full"></div>
          </div>
          <div>
            <p className="text-sm font-medium text-blue-900">Información mostrada</p>
            <p className="text-sm text-blue-700">
              Se muestran todas las reservaciones y paqueterías asociadas a los viajes
            </p>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-col gap-3 mb-6 p-4 bg-gray-50 rounded-lg">
        {/* Primera fila: Búsqueda por texto */}
        <div className="flex items-center gap-2 w-full">
          <Search className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <Input
            placeholder="Buscar por origen, destino, operador..."
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

      {/* Métricas del día */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className={`h-5 w-5 ${dayTotals.ventasReales === dayTotals.totalPorVender ? 'text-green-600' : 'text-gray-500'}`} />
              <div>
                <p className="text-sm text-gray-600">Ventas</p>
                <p className="text-xl font-bold">
                  <span className={dayTotals.ventasReales === dayTotals.totalPorVender ? 'text-green-600' : 'text-gray-500'}>
                    {formatCurrency(dayTotals.ventasReales)}
                  </span>
                  <span className="text-gray-400"> / </span>
                  <span className="text-green-600">
                    {formatCurrency(dayTotals.totalPorVender)}
                  </span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Truck className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm text-gray-600">Viajes</p>
                <p className="text-xl font-bold text-blue-600">{dayTotals.totalTrips}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-sm text-gray-600">Reservaciones</p>
                <p className="text-xl font-bold text-purple-600">{dayTotals.totalReservations}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-sm text-gray-600">Paqueterías</p>
                <p className="text-xl font-bold text-orange-600">{dayTotals.totalPackages}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Lista de viajes */}
      <div className="space-y-4">
        {finalFilteredTrips.map((tripData) => (
          <Card 
            key={tripData.recordId} 
            className="hover:shadow-lg transition-shadow cursor-pointer"
            onClick={() => setSelectedTrip(tripData)}
          >
            <CardHeader className="pb-3">
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-lg">
                    {tripData.tripInfo.route?.origin} → {tripData.tripInfo.route?.destination}
                  </CardTitle>
                  <p className="text-sm text-gray-600 mt-1">
                    {tripData.tripInfo.route?.name}
                  </p>
                </div>
                <Badge variant="outline" className="text-green-600 border-green-600">
                  {formatCurrency(tripData.totalSales)}
                </Badge>
              </div>
            </CardHeader>
            
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {/* Horario */}
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-blue-600" />
                  <div>
                    <p className="text-xs text-blue-600 font-medium uppercase">Horario</p>
                    <p className="text-sm font-semibold">
                      {(tripData.tripInfo.parentTrip || tripData.tripInfo).departureTime} - {(tripData.tripInfo.parentTrip || tripData.tripInfo).arrivalTime}
                    </p>
                  </div>
                </div>
                
                {/* Operador */}
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-purple-600" />
                  <div>
                    <p className="text-xs text-purple-600 font-medium uppercase">Operador</p>
                    <p className="text-sm font-semibold">
                      {tripData.tripInfo.driver?.firstName ? 
                        `${tripData.tripInfo.driver.firstName} ${tripData.tripInfo.driver.lastName}` : 
                        'Sin asignar'
                      }
                    </p>
                  </div>
                </div>
                
                {/* Reservaciones */}
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-green-600" />
                  <div>
                    <p className="text-xs text-green-600 font-medium uppercase">Reservaciones</p>
                    <p className="text-sm font-semibold">{tripData.reservations.length}</p>
                  </div>
                </div>
                
                {/* Paqueterías */}
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-orange-600" />
                  <div>
                    <p className="text-xs text-orange-600 font-medium uppercase">Paqueterías</p>
                    <p className="text-sm font-semibold">{tripData.packages.length}</p>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 flex justify-end">
                <Button variant="outline" size="sm">
                  Ver detalles financieros →
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {finalFilteredTrips.length === 0 && (
        <div className="text-center py-12">
          <FileText className="h-12 w-12 mx-auto text-gray-400 mb-4" />
          <div className="text-gray-500">
            No hay viajes con ventas confirmadas para {formatDate(selectedDate)}
          </div>
        </div>
      )}

      {/* Sidebar de detalles */}
      {selectedTrip && (
        <TripLogDetailsSidebar
          tripData={selectedTrip}
          onClose={() => setSelectedTrip(null)}
        />
      )}
    </div>
  );
}