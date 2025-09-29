import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, TrendingUp, Users, Target, Route, UserCheck } from "lucide-react";
import CouponUsageStatistics from "@/components/statistics/coupon-usage-statistics";
import PopularRoutesStatistics from "@/components/statistics/popular-routes-statistics";
import PassengerIntakeStatistics from "@/components/statistics/passenger-intake-statistics";
import BestPerformanceStatistics from "@/components/statistics/best-performance-statistics";

export default function StatisticsSection() {
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
          <TabsTrigger value="routes" className="flex items-center gap-2">
            <Route className="h-4 w-4" />
            Rutas
          </TabsTrigger>
          <TabsTrigger value="passengers" className="flex items-center gap-2">
            <UserCheck className="h-4 w-4" />
            Pasajeros
          </TabsTrigger>
          <TabsTrigger value="trips" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Rendimiento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="coupons" className="space-y-4">
          <CouponUsageStatistics />
        </TabsContent>

        <TabsContent value="routes" className="space-y-4">
          <PopularRoutesStatistics />
        </TabsContent>

        <TabsContent value="passengers" className="space-y-4">
          <PassengerIntakeStatistics />
        </TabsContent>

        <TabsContent value="trips" className="space-y-4">
          <BestPerformanceStatistics />
        </TabsContent>
      </Tabs>
    </div>
  );
}