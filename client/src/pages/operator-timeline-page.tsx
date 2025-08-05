import React from "react";
import { DefaultLayout } from "@/components/layout/default-layout";
import { OperatorTimeline } from "@/components/operator-timeline/operator-timeline";

export function OperatorTimelinePage() {
  return (
    <DefaultLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Línea de tiempo operador</h1>
            <p className="text-muted-foreground">
              Consulta los viajes y transacciones de un operador en un rango de fechas específico
            </p>
          </div>
        </div>
        
        <OperatorTimeline />
      </div>
    </DefaultLayout>
  );
}