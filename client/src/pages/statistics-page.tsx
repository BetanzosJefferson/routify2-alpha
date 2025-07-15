import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Target } from "lucide-react";
import CouponUsageStatistics from "@/components/statistics/coupon-usage-statistics";

export default function StatisticsPage() {
  const [activeTab, setActiveTab] = useState("coupons");

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="h-8 w-8 text-blue-600" />
        <div>
          <h1 className="text-3xl font-bold">Estadísticas</h1>
          <p className="text-gray-600">Análisis y métricas de la empresa</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-1 md:grid-cols-4">
          <TabsTrigger value="coupons" className="flex items-center gap-2">
            <Target className="h-4 w-4" />
            Cupones
          </TabsTrigger>
          <TabsTrigger value="sales" className="flex items-center gap-2" disabled>
            <TrendingUp className="h-4 w-4" />
            Ventas
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2" disabled>
            <Users className="h-4 w-4" />
            Usuarios
          </TabsTrigger>
          <TabsTrigger value="trips" className="flex items-center gap-2" disabled>
            <BarChart3 className="h-4 w-4" />
            Viajes
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coupons" className="space-y-4">
          <CouponUsageStatistics />
        </TabsContent>

        <TabsContent value="sales" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Estadísticas de Ventas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500">Próximamente...</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Estadísticas de Usuarios
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500">Próximamente...</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trips" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Estadísticas de Viajes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-center h-32">
                <div className="text-gray-500">Próximamente...</div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}