import { useState, useMemo } from "react";
import { Calendar, FileText, DollarSign, Package, Users, Truck, UserCheck, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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

  // Hooks para obtener datos
  const { data: reservations = [], isLoading: isLoadingReservations } = useReservations();
  const { data: packages = [], isLoading: isLoadingPackages } = usePackages();
  const { data: trips = [], isLoading: isLoadingTrips } = useTrips();

  // Filtrar reservaciones válidas para bitácora
  const validReservations = useMemo(() => {
    return reservations.filter((reservation: any) => {
      // Incluir pagadas completamente
      if (reservation.paymentStatus === 'pagado') return true;
      
      // Incluir con anticipo
      if (reservation.paymentStatus === 'anticipo' || (reservation.advanceAmount && reservation.advanceAmount > 0)) return true;
      
      // Incluir canceladas (sin reembolso - asumimos que las canceladas aquí no tienen reembolso)
      if (reservation.status === 'cancelada') return true;
      
      return false;
    });
  }, [reservations]);

  // Filtrar paqueterías válidas para bitácora
  const validPackages = useMemo(() => {
    return packages.filter((pkg: any) => pkg.isPaid === true);
  }, [packages]);

  // Filtrar por fecha seleccionada
  const dateFilteredReservations = useMemo(() => {
    return validReservations.filter((reservation: any) => {
      const tripDetails = reservation.tripDetails as any;
      if (!tripDetails || !reservation.trip) return false;
      
      const tripDate = reservation.trip.departureDate;
      return tripDate === selectedDate;
    });
  }, [validReservations, selectedDate]);

  const dateFilteredPackages = useMemo(() => {
    return validPackages.filter((pkg: any) => {
      const tripDetails = pkg.tripDetails as any;
      if (!tripDetails) return false;
      
      // Extraer fecha del tripDetails
      const tripDate = tripDetails.departureDate;
      return tripDate === selectedDate;
    });
  }, [validPackages, selectedDate]);

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

    // Agregar paqueterías a los grupos existentes
    dateFilteredPackages.forEach((pkg: any) => {
      const tripDetails = pkg.tripDetails as any;
      if (!tripDetails) return;

      const recordId = tripDetails.recordId;
      const tripKey = `${recordId}`;

      // Si el grupo existe, agregar el paquete
      if (groups[tripKey]) {
        groups[tripKey].packages.push(pkg);
        groups[tripKey].totalSales += pkg.price || 0;
      }
    });

    // Calcular ganancias netas (por ahora sin gastos, se agregará después)
    Object.values(groups).forEach(group => {
      group.netProfit = group.totalSales - group.totalExpenses;
    });

    return Object.values(groups);
  }, [dateFilteredReservations, dateFilteredPackages]);

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
    const totalSales = groupedTrips.reduce((sum, trip) => sum + trip.totalSales, 0);
    const totalTrips = groupedTrips.length;
    const totalReservations = groupedTrips.reduce((sum, trip) => sum + trip.reservations.length, 0);
    const totalPackages = groupedTrips.reduce((sum, trip) => sum + trip.packages.length, 0);

    return { totalSales, totalTrips, totalReservations, totalPackages };
  }, [groupedTrips]);

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
            Registro financiero de viajes con ventas confirmadas
          </p>
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

      {/* Métricas del día */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-sm text-gray-600">Ventas Totales</p>
                <p className="text-xl font-bold text-green-600">{formatCurrency(dayTotals.totalSales)}</p>
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
        {groupedTrips.map((tripData) => (
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

      {groupedTrips.length === 0 && (
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