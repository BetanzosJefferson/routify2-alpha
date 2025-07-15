import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Users, UserCheck, Trophy, Medal, Award, Calendar, RotateCcw } from "lucide-react";
import { format } from "date-fns";

interface PassengerIntakeStatistic {
  userId: number;
  userName: string;
  totalReservationsCreated: number;
  totalPassengersAdded: number;
  totalRevenueGenerated: number;
  averageRevenuePerReservation: number;
}

export default function PassengerIntakeStatistics() {
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30); // Últimos 30 días por defecto
    return format(date, 'yyyy-MM-dd');
  });
  
  const [endDate, setEndDate] = useState(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });

  const { data: statistics, isLoading, error } = useQuery<PassengerIntakeStatistic[]>({
    queryKey: ["/api/statistics/passenger-intake", startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      
      const response = await fetch(`/api/statistics/passenger-intake?${params}`);
      if (!response.ok) {
        throw new Error("Error al obtener estadísticas de ingreso de pasajeros");
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
              <Users className="h-5 w-5" />
              Ingreso de Pasajeros
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
              <Users className="h-5 w-5" />
              Ingreso de Pasajeros
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
              <Users className="h-5 w-5" />
              Ingreso de Pasajeros
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">No hay estadísticas de ingreso de pasajeros disponibles</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calcular totales
  const totalReservations = statistics.reduce((sum, stat) => sum + stat.totalReservationsCreated, 0);
  const totalPassengers = statistics.reduce((sum, stat) => sum + stat.totalPassengersAdded, 0);
  const totalRevenue = statistics.reduce((sum, stat) => sum + stat.totalRevenueGenerated, 0);
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
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Reservaciones</p>
                <p className="text-2xl font-bold">{totalReservations}</p>
              </div>
              <UserCheck className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Pasajeros</p>
                <p className="text-2xl font-bold">{totalPassengers}</p>
              </div>
              <Users className="h-8 w-8 text-green-500" />
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
              <Trophy className="h-8 w-8 text-orange-500" />
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
              <Medal className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de estadísticas por usuario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Ranking de Usuarios por Ingreso de Pasajeros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead className="text-center">Reservaciones</TableHead>
                <TableHead className="text-center">Pasajeros</TableHead>
                <TableHead className="text-center">Ingresos</TableHead>
                <TableHead className="text-center">Promedio</TableHead>
                <TableHead className="text-center">Ranking</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statistics.map((stat, index) => (
                <TableRow key={stat.userId}>
                  <TableCell className="font-medium">{stat.userName}</TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-blue-600">
                      {stat.totalReservationsCreated}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-green-600">
                      {stat.totalPassengersAdded}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-orange-600">
                      ${stat.totalRevenueGenerated.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="font-semibold text-purple-600">
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