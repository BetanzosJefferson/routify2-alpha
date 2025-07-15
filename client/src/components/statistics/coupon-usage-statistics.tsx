import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { User, TrendingUp, DollarSign, Target } from "lucide-react";

interface CouponUsageStatistic {
  userId: number;
  userName: string;
  totalCouponsUsed: number;
  totalDiscountAmount: number;
  averageDiscountPerCoupon: number;
}

export default function CouponUsageStatistics() {
  const { data: statistics, isLoading, error } = useQuery<CouponUsageStatistic[]>({
    queryKey: ["/api/statistics/coupon-usage"],
    queryFn: async () => {
      const response = await fetch("/api/statistics/coupon-usage");
      if (!response.ok) {
        throw new Error("Error al obtener estadísticas de cupones");
      }
      return response.json();
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Estadísticas de Uso de Cupones
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
              <TrendingUp className="h-5 w-5" />
              Estadísticas de Uso de Cupones
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
              <TrendingUp className="h-5 w-5" />
              Estadísticas de Uso de Cupones
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">No hay estadísticas de cupones disponibles</div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Calcular totales
  const totalCouponsUsed = statistics.reduce((sum, stat) => sum + stat.totalCouponsUsed, 0);
  const totalDiscountAmount = statistics.reduce((sum, stat) => sum + stat.totalDiscountAmount, 0);
  const averageDiscountOverall = totalCouponsUsed > 0 ? totalDiscountAmount / totalCouponsUsed : 0;

  return (
    <div className="space-y-6">
      {/* Tarjetas de resumen */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Cupones Usados</p>
                <p className="text-2xl font-bold">{totalCouponsUsed}</p>
              </div>
              <Target className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Descuentos</p>
                <p className="text-2xl font-bold">${totalDiscountAmount.toFixed(2)}</p>
              </div>
              <DollarSign className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Promedio por Cupón</p>
                <p className="text-2xl font-bold">${averageDiscountOverall.toFixed(2)}</p>
              </div>
              <TrendingUp className="h-8 w-8 text-orange-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de estadísticas por usuario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Uso de Cupones por Usuario
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuario</TableHead>
                <TableHead className="text-center">Cupones Usados</TableHead>
                <TableHead className="text-center">Total Descuentos</TableHead>
                <TableHead className="text-center">Promedio por Cupón</TableHead>
                <TableHead className="text-center">Ranking</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {statistics.map((stat, index) => (
                <TableRow key={stat.userId}>
                  <TableCell className="font-medium">{stat.userName}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant="secondary">{stat.totalCouponsUsed}</Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-green-600 font-medium">
                      ${stat.totalDiscountAmount.toFixed(2)}
                    </span>
                  </TableCell>
                  <TableCell className="text-center">
                    <span className="text-blue-600 font-medium">
                      ${stat.averageDiscountPerCoupon.toFixed(2)}
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