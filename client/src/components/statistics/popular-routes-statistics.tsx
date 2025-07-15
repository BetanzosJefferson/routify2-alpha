import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { MapPin, Route, Trophy, Medal, Award, Calendar, RotateCcw } from "lucide-react";
import { format } from "date-fns";

interface PopularRouteStatistic {
  origin: string;
  destination: string;
  totalReservations: number;
  totalRevenue: number;
  averageRevenuePerReservation: number;
}

export default function PopularRoutesStatistics() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Últimos 30 días por defecto
    return format(date, 'yyyy-MM-dd');
  });
  
  const [endDate, setEndDate] = useState(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });

  const { data: statistics, isLoading, error } = useQuery<PopularRouteStatistic[]>({
    queryKey: ["/api/statistics/popular-routes", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/statistics/popular-routes?${params}`);
      if (!response.ok) {
        throw new Error("Error al obtener estadísticas de rutas");
      }
      return response.json();
    },
  });

  const handleResetDates = () => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    setStartDate(format(date, 'yyyy-MM-dd'));
    setEndDate(format(new Date(), 'yyyy-MM-dd'));
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Rutas más Concurridas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Cargando estadísticas...</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Rutas más Concurridas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32">
              <div className="text-red-500">Error al cargar estadísticas</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!statistics || statistics.length === 0) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Route className="h-5 w-5" />
              Rutas más Concurridas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">No hay estadísticas de rutas disponibles</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calcular totales
  const totalReservations = statistics.reduce((sum, stat) => sum + stat.totalReservations, 0);
  const totalRevenue = statistics.reduce((sum, stat) => sum + stat.totalRevenue, 0);
  const averageRevenueOverall = totalReservations > 0 ? totalRevenue / totalReservations : 0;

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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="start-date">Fecha de Inicio</Label>
              <Input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label htmlFor="end-date">Fecha de Fin</Label>
              <Input
                id="end-date"
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={handleResetDates}
                className="w-full"
              >
                <RotateCcw className="h-4 w-4 mr-2" />
                Últimos 30 días
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Reservaciones</p>
                <p className="text-2xl font-bold">{totalReservations}</p>
              </div>
              <Route className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Ingresos Totales</p>
                <p className="text-2xl font-bold">${totalRevenue.toFixed(2)}</p>
              </div>
              <MapPin className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Promedio por Reservación</p>
                <p className="text-2xl font-bold">${averageRevenueOverall.toFixed(2)}</p>
              </div>
              <Trophy className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de estadísticas por ruta */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Rutas más Concurridas
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Origen</TableHead>
                <TableHead>Destino</TableHead>
                <TableHead className="text-center">Reservaciones</TableHead>
                <TableHead className="text-center">Ingresos</TableHead>
                <TableHead className="text-center">Promedio</TableHead>
                <TableHead className="text-center">Ranking</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statistics.map((stat, index) => (
                <TableRow key={`${stat.origin}-${stat.destination}`}>
                  <TableCell className="font-medium">{stat.origin}</TableCell>
                  <TableCell className="font-medium">{stat.destination}</TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-blue-600">
                      {stat.totalReservations}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-green-600">
                      ${stat.totalRevenue.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-orange-600">
                      ${stat.averageRevenuePerReservation.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <Badge 
                      variant={index === 0 ? "default" : index === 1 ? "secondary" : "outline"}
                      className={
                        index === 0 ? "bg-yellow-500 text-white" :
                        index === 1 ? "bg-gray-400 text-white" :
                        index === 2 ? "bg-orange-400 text-white" : ""
                      }
                    >
                      #{index + 1}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}