import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Package } from 'lucide-react';
// Función simple para formatear precios
const formatPrice = (price: number) => {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN'
  }).format(price);
};

interface PackagesByDateProps {
  selectedDate: string;
}

export function PackagesByDate({ selectedDate }: PackagesByDateProps) {
  const { data: packages = [], isLoading } = useQuery({
    queryKey: ['/api/packages', { date: selectedDate }],
    queryFn: async () => {
      console.log('[PackagesByDate] Solicitando paquetes para fecha:', selectedDate);
      const response = await fetch(`/api/packages?date=${selectedDate}`);
      if (!response.ok) throw new Error('Error al cargar paqueterías');
      const data = await response.json();
      console.log('[PackagesByDate] Paquetes recibidos:', data);
      return data;
    }
  });

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-gray-500">Cargando paqueterías...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (packages.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-gray-500 flex flex-col items-center gap-3">
            <Package className="h-12 w-12 text-gray-300" />
            <p>No hay paqueterías para esta fecha</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Package className="h-5 w-5" />
          Paqueterías del Día ({packages.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {packages.map((pkg: any) => (
            <div key={pkg.id} className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-amber-700">
                      Paquete #{pkg.id}
                    </span>
                    <Badge 
                      variant={pkg.delivery_status === 'entregado' ? 'default' : 'secondary'}
                      className={pkg.delivery_status === 'entregado' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}
                    >
                      {pkg.delivery_status || 'pendiente'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-700">
                    <div>
                      <span className="font-medium">Remitente:</span> {pkg.sender_name} {pkg.sender_lastname || ''}
                    </div>
                    <div>
                      <span className="font-medium">Destinatario:</span> {pkg.recipient_name} {pkg.recipient_lastname || ''}
                    </div>
                    <div>
                      <span className="font-medium">Descripción:</span> {pkg.package_description}
                    </div>
                    <div>
                      <span className="font-medium">Precio:</span> {formatPrice(pkg.price)}
                    </div>
                  </div>
                  
                  {(pkg.sender_phone || pkg.recipient_phone) && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-gray-600 mt-2">
                      {pkg.sender_phone && (
                        <div>
                          <span className="font-medium">Tel. Remitente:</span> {pkg.sender_phone}
                        </div>
                      )}
                      {pkg.recipient_phone && (
                        <div>
                          <span className="font-medium">Tel. Destinatario:</span> {pkg.recipient_phone}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Información del viaje */}
                  {pkg.tripDetails && (
                    <div className="mt-3 pt-2 border-t border-amber-200">
                      <div className="text-xs text-gray-600">
                        <span className="font-medium">Viaje:</span> {pkg.tripDetails.origin} → {pkg.tripDetails.destination}
                      </div>
                      {pkg.tripDetails.departureDate && (
                        <div className="text-xs text-gray-600">
                          <span className="font-medium">Fecha:</span> {pkg.tripDetails.departureDate}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div className="flex flex-col items-end gap-1 ml-4">
                  {pkg.is_paid ? (
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      Pagado
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="bg-red-100 text-red-800">
                      Pendiente
                    </Badge>
                  )}
                  {pkg.payment_method && (
                    <span className="text-xs text-gray-500">
                      {pkg.payment_method}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}