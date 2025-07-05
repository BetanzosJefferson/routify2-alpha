import React from "react";
import { formatDate, formatCurrency } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Check, Clock, Users } from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface PackageDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  packageData: any;
}

export function PackageDetailsModal({
  isOpen,
  onClose,
  packageData,
}: PackageDetailsModalProps) {
  if (!packageData) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[95vw] max-w-[400px] max-h-[85vh] overflow-y-auto">
        <DialogHeader className="pb-3">
          <DialogTitle className="text-lg">Paquete #{packageData.id}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Información general */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h3 className="font-semibold mb-3 text-sm">Información General</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Fecha:</span>
                <span>{packageData.tripDate ? formatDate(new Date(packageData.tripDate)) : formatDate(new Date(packageData.createdAt))}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Precio:</span>
                <span className="font-semibold text-green-600">{formatCurrency(packageData.price)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Descripción:</span>
                <span className="text-right">{packageData.packageDescription}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Método de pago:</span>
                <span>{packageData.paymentMethod || "efectivo"}</span>
              </div>
            </div>
          </div>

          {/* Remitente */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h3 className="font-semibold mb-2 text-sm">Remitente</h3>
            <div className="text-sm">
              <p className="font-medium">{packageData.senderName} {packageData.senderLastName}</p>
              <p className="text-gray-600">{packageData.senderPhone}</p>
            </div>
          </div>

          {/* Destinatario */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h3 className="font-semibold mb-2 text-sm">Destinatario</h3>
            <div className="text-sm">
              <p className="font-medium">{packageData.recipientName} {packageData.recipientLastName}</p>
              <p className="text-gray-600">{packageData.recipientPhone}</p>
            </div>
          </div>

          {/* Ruta */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h3 className="font-semibold mb-2 text-sm">Ruta</h3>
            <div className="text-sm space-y-1">
              <div>
                <span className="text-gray-600">Origen: </span>
                <span>{packageData.segmentOrigin || packageData.tripOrigin || "No disponible"}</span>
              </div>
              <div>
                <span className="text-gray-600">Destino: </span>
                <span>{packageData.segmentDestination || packageData.tripDestination || "No disponible"}</span>
              </div>
            </div>
          </div>

          {/* Estado */}
          <div className="bg-gray-50 p-3 rounded-lg">
            <h3 className="font-semibold mb-3 text-sm">Estado</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Pago:</span>
                <Badge className={packageData.isPaid ? "bg-green-500" : "bg-gray-500"}>
                  {packageData.isPaid ? 'Pagado' : 'Pendiente'}
                </Badge>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Entrega:</span>
                <Badge className={packageData.deliveryStatus === "entregado" ? "bg-green-500" : "bg-orange-500"}>
                  {packageData.deliveryStatus === "entregado" ? 'Entregado' : 'Pendiente'}
                </Badge>
              </div>
              {packageData.createdByUser && (
                <div className="text-xs text-gray-600 pt-2 border-t">
                  <span>Registrado por: {packageData.createdByUser.firstName} {packageData.createdByUser.lastName}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}