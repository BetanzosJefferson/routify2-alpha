import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, TrendingUp, Users, DollarSign, BarChart3 } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface DayStatistic {
  dayOfWeek: string;
  dayNumber: number;
  totalReservations: number;
  totalPassengers: number;
  totalRevenue: number;
  averageTicketPrice: number;
}

interface TimeSlotStatistic {
  timeSlot: string;
  totalReservations: number;
  totalPassengers: number;
  totalRevenue: number;
  averageTicketPrice: number;
}

interface BestPerformanceStats {
  bestDays: DayStatistic[];
  bestTimeSlots: TimeSlotStatistic[];
  overall: {
    totalReservations: number;
    totalPassengers: number;
    totalRevenue: number;
    averageTicketPrice: number;
  };
}

export default function BestPerformanceStatistics() {
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [appliedStartDate, setAppliedStartDate] = useState("");
  const [appliedEndDate, setAppliedEndDate] = useState("");

  const { data: stats, isLoading, error } = useQuery<BestPerformanceStats>({
    queryKey: ['/api/statistics/best-performance', appliedStartDate, appliedEndDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedStartDate) params.append('startDate', appliedStartDate);
      if (appliedEndDate) params.append('endDate', appliedEndDate);
      
      const url = `/api/statistics/best-performance${params.toString() ? `?${params.toString()}` : ''}`;
      const response = await fetch(url);
      if (!response.ok) throw new Error('Error al obtener estadísticas');
      return response.json();
    }
  });

  const handleApplyFilter = () => {
    setAppliedStartDate(startDate);
    setAppliedEndDate(endDate);
  };

  const handleClearFilter = () => {
    setStartDate("");
    setEndDate("");
    setAppliedStartDate("");
    setAppliedEndDate("");
  };

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-600">
            Error al cargar estadísticas de rendimiento
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Filtros de fecha */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Filtros de Fecha
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Fecha Inicio</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex-1">
              <label className="block text-sm font-medium mb-2">Fecha Fin</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={handleApplyFilter} className="whitespace-nowrap">
                Aplicar Filtro
              </Button>
              {(appliedStartDate || appliedEndDate) && (
                <Button onClick={handleClearFilter} variant="outline" className="whitespace-nowrap">
                  Limpiar
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen General */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Reservaciones</p>
                  <p className="text-2xl font-bold">{stats.overall.totalReservations}</p>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Total Pasajeros</p>
                  <p className="text-2xl font-bold">{stats.overall.totalPassengers}</p>
                </div>
                <Users className="h-8 w-8 text-green-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Ingresos Totales</p>
                  <p className="text-2xl font-bold">{formatPrice(stats.overall.totalRevenue)}</p>
                </div>
                <DollarSign className="h-8 w-8 text-yellow-600" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-600">Precio Promedio/Boleto</p>
                  <p className="text-2xl font-bold">{formatPrice(stats.overall.averageTicketPrice)}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-purple-600" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Mejores Días de la Semana */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Mejores Días de la Semana
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Cargando...</div>
            ) : stats && stats.bestDays.length > 0 ? (
              <div className="space-y-3">
                {stats.bestDays.map((day, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-lg">{day.dayOfWeek}</div>
                        <div className="text-sm text-gray-600">
                          {day.totalReservations} reservaciones
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Ingresos</div>
                        <div className="font-semibold text-green-600">
                          {formatPrice(day.totalRevenue)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Pasajeros: </span>
                        <span className="font-medium">{day.totalPassengers}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Precio/Boleto: </span>
                        <span className="font-medium">{formatPrice(day.averageTicketPrice)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay datos disponibles para el período seleccionado
              </div>
            )}
          </CardContent>
        </Card>

        {/* Mejores Horarios */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Mejores Horarios
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-gray-500">Cargando...</div>
            ) : stats && stats.bestTimeSlots.length > 0 ? (
              <div className="space-y-3">
                {stats.bestTimeSlots.map((slot, index) => (
                  <div
                    key={index}
                    className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-lg">{slot.timeSlot}</div>
                        <div className="text-sm text-gray-600">
                          {slot.totalReservations} reservaciones
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Ingresos</div>
                        <div className="font-semibold text-green-600">
                          {formatPrice(slot.totalRevenue)}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Pasajeros: </span>
                        <span className="font-medium">{slot.totalPassengers}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Precio/Boleto: </span>
                        <span className="font-medium">{formatPrice(slot.averageTicketPrice)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-gray-500">
                No hay datos disponibles para el período seleccionado
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}