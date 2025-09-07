import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Calendar, Clock, MapPin, Users, Search, Loader2, FileText, Car } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatDateForInput, formatDateToLocal, formatPrice } from "@/lib/utils";
import { MainLayout } from "@/components/layout/main-layout";
import { UserRole } from "@shared/schema";

interface TripSummary {
  id: number;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  origin: string;
  destination: string;
  capacity: number;
  reservationCount: number;
  reservations: Array<{
    id: number;
    passengerName: string;
    passengerLastName: string;
    passengerPhone: string;
    seatsQuantity: number;
    totalPrice: number;
    isPaid: boolean;
    paymentMethod?: string;
    createdAt: string;
  }>;
}

export default function TripSummaryPage() {
  const { user } = useAuth();
  const [dateFrom, setDateFrom] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7); // Una semana atrás por defecto
    return formatDateForInput(today);
  });
  const [dateTo, setDateTo] = useState(() => {
    const today = new Date();
    return formatDateForInput(today);
  });
  const [hasSearched, setHasSearched] = useState(false);

  // Verificar que solo el rol dueño tenga acceso
  if (!user || user.role !== UserRole.OWNER) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center min-h-screen">
          <Card className="max-w-md">
            <CardContent className="pt-6">
              <div className="text-center">
                <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h2 className="text-xl font-semibold mb-2">Acceso Restringido</h2>
                <p className="text-gray-600">
                  Esta sección solo está disponible para usuarios con rol de dueño.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </MainLayout>
    );
  }

  const { data: tripSummaries, isLoading, refetch } = useQuery({
    queryKey: ['/api/trip-summary', dateFrom, dateTo],
    queryFn: async () => {
      if (!hasSearched) return [];
      
      const params = new URLSearchParams();
      if (dateFrom) params.append('dateFrom', dateFrom);
      if (dateTo) params.append('dateTo', dateTo);
      
      const response = await fetch(`/api/trip-summary?${params}`);
      if (!response.ok) {
        throw new Error('Error al obtener resumen de viajes');
      }
      return response.json();
    },
    enabled: hasSearched
  });

  const handleSearch = () => {
    if (!dateFrom || !dateTo) {
      return;
    }
    if (new Date(dateFrom) > new Date(dateTo)) {
      return;
    }
    setHasSearched(true);
    refetch();
  };

  const getTotalReservations = () => {
    if (!tripSummaries) return 0;
    return tripSummaries.reduce((total: number, trip: TripSummary) => total + trip.reservationCount, 0);
  };

  const getTotalRevenue = () => {
    if (!tripSummaries) return 0;
    return tripSummaries.reduce((total: number, trip: TripSummary) => {
      return total + trip.reservations.reduce((tripTotal, reservation) => tripTotal + reservation.totalPrice, 0);
    }, 0);
  };

  const getPaidReservations = () => {
    if (!tripSummaries) return 0;
    return tripSummaries.reduce((total: number, trip: TripSummary) => {
      return total + trip.reservations.filter(r => r.isPaid).length;
    }, 0);
  };

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Resumen por Viaje
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Consulta viajes y reservaciones por rango de fechas
            </p>
          </div>
        </div>

        {/* Filtros de fecha */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Seleccionar Rango de Fechas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
              <div>
                <Label htmlFor="dateFrom">Fecha desde</Label>
                <Input
                  id="dateFrom"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="dateTo">Fecha hasta</Label>
                <Input
                  id="dateTo"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
              <Button 
                onClick={handleSearch}
                disabled={!dateFrom || !dateTo || new Date(dateFrom) > new Date(dateTo) || isLoading}
                className="w-full"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Search className="h-4 w-4 mr-2" />
                )}
                Buscar
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Estadísticas generales */}
        {hasSearched && tripSummaries && (
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Viajes</p>
                    <p className="text-2xl font-bold">{tripSummaries.length}</p>
                  </div>
                  <Car className="h-8 w-8 text-blue-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Reservaciones</p>
                    <p className="text-2xl font-bold">{getTotalReservations()}</p>
                  </div>
                  <Users className="h-8 w-8 text-green-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Reservaciones Pagadas</p>
                    <p className="text-2xl font-bold">{getPaidReservations()}</p>
                  </div>
                  <FileText className="h-8 w-8 text-emerald-600" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ingresos Totales</p>
                    <p className="text-2xl font-bold">{formatPrice(getTotalRevenue())}</p>
                  </div>
                  <MapPin className="h-8 w-8 text-purple-600" />
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Lista de viajes */}
        {hasSearched && (
          <div className="space-y-4">
            {isLoading ? (
              <Card>
                <CardContent className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>Cargando resumen de viajes...</span>
                </CardContent>
              </Card>
            ) : tripSummaries && tripSummaries.length > 0 ? (
              tripSummaries.map((trip: TripSummary) => (
                <Card key={trip.id}>
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Car className="h-5 w-5" />
                        <span>Viaje #{trip.id}</span>
                        <span className="text-sm font-normal text-gray-600 dark:text-gray-400">
                          ({formatDateToLocal(new Date(trip.departureDate))})
                        </span>
                      </div>
                      <div className="text-sm font-normal text-gray-600 dark:text-gray-400">
                        {trip.reservationCount} reservaciones
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {/* Información del viaje */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">Origen</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{trip.origin}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">Destino</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">{trip.destination}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">Horario</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {trip.departureTime} - {trip.arrivalTime}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-500" />
                          <div>
                            <p className="text-sm font-medium">Capacidad</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {trip.reservationCount} / {trip.capacity} asientos
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Lista de reservaciones */}
                      {trip.reservations.length > 0 && (
                        <div>
                          <h4 className="text-lg font-semibold mb-3">Reservaciones</h4>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead>
                                <tr className="border-b">
                                  <th className="text-left py-2">Pasajero</th>
                                  <th className="text-left py-2">Teléfono</th>
                                  <th className="text-left py-2">Asientos</th>
                                  <th className="text-left py-2">Precio</th>
                                  <th className="text-left py-2">Estado</th>
                                  <th className="text-left py-2">Fecha</th>
                                </tr>
                              </thead>
                              <tbody>
                                {trip.reservations.map((reservation) => (
                                  <tr key={reservation.id} className="border-b">
                                    <td className="py-2">
                                      {reservation.passengerName} {reservation.passengerLastName}
                                    </td>
                                    <td className="py-2">{reservation.passengerPhone}</td>
                                    <td className="py-2">{reservation.seatsQuantity}</td>
                                    <td className="py-2">{formatPrice(reservation.totalPrice)}</td>
                                    <td className="py-2">
                                      <span className={`px-2 py-1 rounded-full text-xs ${
                                        reservation.isPaid 
                                          ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                          : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                      }`}>
                                        {reservation.isPaid ? 'Pagado' : 'Pendiente'}
                                      </span>
                                    </td>
                                    <td className="py-2">
                                      {new Date(reservation.createdAt).toLocaleDateString('es-MX')}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No se encontraron viajes</h3>
                  <p className="text-gray-600 dark:text-gray-400 text-center">
                    No hay viajes registrados en el rango de fechas seleccionado.
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!hasSearched && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Calendar className="h-12 w-12 text-gray-400 mb-4" />
              <h3 className="text-lg font-semibold mb-2">Selecciona un rango de fechas</h3>
              <p className="text-gray-600 dark:text-gray-400 text-center">
                Elige las fechas de inicio y fin para consultar el resumen de viajes.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </MainLayout>
  );
}