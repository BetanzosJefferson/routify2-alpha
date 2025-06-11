import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CalendarIcon, 
  Users, 
  Calendar,
  Clock,
  Bus,
  User,
  X,
  Search,
  Phone,
  DollarSign,
  MapPin
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input"; 
import { formatDate, formatPrice, formatTime } from "@/lib/utils";
import { ReservationWithDetails } from "@shared/schema";

interface ReservationDetailsSidebarProps {
  recordId: string;
  tripInfo: any;
  reservations: ReservationWithDetails[];
  onClose: () => void;
}

export function ReservationDetailsSidebar({ 
  recordId, 
  tripInfo, 
  reservations, 
  onClose 
}: ReservationDetailsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const sidebarRef = useRef<HTMLDivElement>(null);

  // Efecto para detectar clics fuera del sidebar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Filtrar reservaciones basado en la búsqueda
  const filteredReservations = reservations.filter(reservation => {
    const searchLower = searchQuery.toLowerCase();
    return (
      reservation.id.toString().includes(searchLower) ||
      reservation.phone.toLowerCase().includes(searchLower) ||
      reservation.email?.toLowerCase().includes(searchLower) ||
      reservation.createdByUser?.firstName?.toLowerCase().includes(searchLower) ||
      reservation.createdByUser?.lastName?.toLowerCase().includes(searchLower)
    );
  });



  const totalPassengers = reservations.reduce((total, reservation) => {
    const tripDetails = reservation.tripDetails as any;
    return total + (tripDetails?.seats || 1);
  }, 0);

  return (
    <div 
      ref={sidebarRef}
      className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[550px] bg-white shadow-2xl overflow-y-auto transition-all duration-300 ease-in-out z-50 border-l border-gray-200 max-w-[95%]"
      style={{ 
        boxShadow: "-10px 0 15px -3px rgba(0, 0, 0, 0.1), -4px 0 6px -2px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div className="flex justify-between items-center p-5 border-b sticky top-0 bg-white z-10">
        <h2 className="text-xl font-semibold text-gray-800">Lista de Reservaciones</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="p-6">
        {/* Información del viaje */}
        <div className="mb-6 bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-xl font-semibold mb-1">
            {tripInfo ? `${tripInfo.origin} - ${tripInfo.destination}` : `Viaje ${recordId}`}
          </h3>
          <p className="text-gray-600 font-medium mb-3">
            {tripInfo ? 
              `${tripInfo.origin} → ${tripInfo.destination}` :
              `Información del viaje ${recordId}`
            }
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-blue-100 p-2 mr-3">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Fecha</p>
                <p className="font-semibold text-sm">
                  {tripInfo?.departureDate ? formatDate(tripInfo.departureDate) : 'N/A'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-purple-100 p-2 mr-3">
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Horario</p>
                <p className="font-semibold text-sm">10:00 AM - 03:00 PM</p>
              </div>
            </div>
            
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-green-100 p-2 mr-3">
                <Bus className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Vehículo</p>
                <p className="font-semibold text-sm">Sin Unidad Asignada</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center bg-blue-50 p-4 rounded-lg">
            <div className="rounded-full bg-blue-100 p-2 mr-3">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de pasajeros</p>
              <p className="text-2xl font-bold text-blue-700">{totalPassengers}</p>
            </div>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nombre, número, origen, destino o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Lista de reservaciones */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Lista de Reservaciones</h3>
          
          {filteredReservations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? 'No se encontraron reservaciones que coincidan con la búsqueda.' : 'No hay reservaciones para este viaje.'}
            </div>
          ) : (
            filteredReservations.map((reservation) => {
              const tripDetails = reservation.tripDetails as any;
              const passengerCount = tripDetails?.seats || 1;
              
              return (
                <Card key={reservation.id} className="border border-gray-200 hover:shadow-md transition-shadow">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-3">
                        <div className="bg-blue-100 text-blue-600 px-2 py-1 rounded text-sm font-medium">
                          {passengerCount} asiento{passengerCount !== 1 ? 's' : ''}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between mb-1">
                            <p className="font-semibold text-gray-800">
                              {reservation.passengers && reservation.passengers.length > 0 ? 
                                reservation.passengers.map(p => `${p.firstName} ${p.lastName}`).join(', ') :
                                'Sin pasajeros'
                              }
                            </p>
                          </div>
                          <p className="text-sm text-gray-500 mb-2">R-{reservation.id.toString().padStart(6, '0')}</p>
                          <div className="flex items-center space-x-2">
                            <span className={`text-sm ${reservation.status === 'confirmed' ? 'text-green-600' : 'text-red-600'}`}>
                              {reservation.status === 'confirmed' ? '✓' : '✗'}
                            </span>
                            <span className="text-sm text-gray-600">
                              {reservation.status === 'confirmed' ? 'Check' : 'No check'}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-gray-500">
                          Anticipo: {formatPrice(reservation.advanceAmount || 0)} 
                          {reservation.advancePaymentMethod === 'transferencia' ? ' (Transferencia)' : ' (Efectivo)'}
                        </p>
                        <p className="font-semibold text-blue-600">Por cobrar: {formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))}</p>
                      </div>
                    </div>
                  </CardHeader>
                  
                  <CardContent className="pt-0">
                    <div className="space-y-3">
                      {/* Información de ruta */}
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-gray-500">Origen</p>
                            <p className="font-medium">{tripDetails?.origin || reservation.trip?.origin || 'N/A'}</p>
                          </div>
                          <div>
                            <p className="text-gray-500">Destino</p>
                            <p className="font-medium">{tripDetails?.destination || reservation.trip?.destination || 'N/A'}</p>
                          </div>
                        </div>
                      </div>
                      
                      {/* Información de contacto */}
                      <div className="flex items-center space-x-4 text-sm">
                        <div className="flex items-center space-x-1">
                          <Phone className="h-4 w-4 text-gray-400" />
                          <span className="font-medium">{reservation.phone}</span>
                        </div>
                      </div>
                      
                      {/* Badge de estado de pago */}
                      <div className="flex justify-start">
                        <span className={`px-3 py-1 rounded text-xs font-medium ${
                          reservation.paymentStatus === 'paid' || reservation.paymentStatus === 'completed'
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {reservation.paymentStatus === 'paid' || reservation.paymentStatus === 'completed' ? 'PAGADO' : 'PENDIENTE'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}