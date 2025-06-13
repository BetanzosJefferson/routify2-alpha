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
  MapPin,
  CheckIcon,
  ClipboardCopy, 
  LockIcon
  
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
                <Card key={reservation.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white hover:shadow-md transition-shadow">
                  {/* Equivalente a CardHeader con las clases del diseño original */}
                  <CardHeader className="border-b border-gray-100 bg-gray-50 px-4 py-2.5">
                    <div className="flex justify-between items-center mb-1.5"> {/* Este div es clave para el layout superior */}
                      <div className="flex items-center"> {/* Agrupamiento para cantidad de asientos y datos del pasajero principal */}
                        <div className="bg-primary/10 text-primary font-medium px-3 py-1 rounded-md mr-3">
                          {passengerCount} asiento{passengerCount !== 1 ? 's' : ''}
                        </div>
                        <div> {/* Contenedor para el nombre del pasajero principal y código */}
                          <div className="font-medium">
                            {reservation.passengers && reservation.passengers.length === 1
                              ? reservation.passengers[0]?.firstName + ' ' + reservation.passengers[0]?.lastName
                              : `${reservation.passengers[0]?.firstName || 'nombre'} ${reservation.passengers[0]?.lastName || 'del pasajero'}`}
                          </div>
                          <div className="text-xs text-gray-500">{reservation.code}</div> {/* Usa reservation.code como en el diseño original */}
                          {/* Indicador de Check basado en checkCount */}
                          <div className="mt-1">
                            {reservation.checkCount && reservation.checkCount > 0 ? (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                <CheckIcon className="h-3 w-3 mr-1" />
                                Check
                              </span>
                            ) : (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                                <X className="h-3 w-3 mr-1" />
                                No check
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right flex flex-col items-end"> {/* Sección de precios y por cobrar */}
                        <div className="text-xs text-gray-700 mb-1">
                          Anticipo: {formatPrice(reservation.advanceAmount || 0)} ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                        </div>

                        {/* Mostrar "Pagó" solamente si está marcado como pagado */}
                        {reservation.paymentStatus === 'pagado' && (reservation.advanceAmount || 0) < reservation.totalAmount && (
                          <div className="text-xs text-gray-700 mb-1">
                            Pagó: {formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                          </div>
                        )}

                        <div className="flex items-center">
                          <span className="text-sm font-medium mr-2">Por cobrar</span>
                          <span className="text-lg font-bold text-primary">
                            {reservation.paymentStatus === 'pagado'
                              ? '$ 0'
                              : `$ ${(reservation.totalAmount - (reservation.advanceAmount || 0)).toFixed(0)}`
                            }
                          </span>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Equivalente a CardContent con las clases del diseño original */}
                  <CardContent className="p-4"> {/* Aseguramos el padding adecuado */}
                    {/* Datos de pasajeros (si hay más de uno) */}
                    <div className="mb-3">
                      <div className="text-sm font-medium text-gray-800">
                        {reservation.passengers.length > 1
                          ? (
                            <>
                              <div className="mb-1">
                                {reservation.passengers.map((passenger, idx) => (
                                  <div key={idx}>
                                    {passenger.firstName} {passenger.lastName}
                                  </div>
                                ))}
                              </div>
                            </>
                          )
                          : null}
                      </div>
                    </div>

                    {/* Origen y destino específicos del segmento */}
                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <div className="text-xs text-gray-500">Origen</div>
                        <div className="font-medium">
                          {(() => {
                            // Usar información específica del segmento si está disponible
                            if (reservation.trip?.origin && reservation.trip?.destination) {
                              return reservation.trip.origin;
                            }
                            // Fallback al viaje padre
                            return reservation.trip?.route?.origin || 'Origen';
                          })()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Destino</div>
                        <div className="font-medium">
                          {(() => {
                            // Usar información específica del segmento si está disponible
                            if (reservation.trip?.origin && reservation.trip?.destination) {
                              return reservation.trip.destination;
                            }
                            // Fallback al viaje padre
                            return reservation.trip?.route?.destination || 'Destino';
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Teléfono de contacto con botón para copiar */}
                    {reservation.phone && (
                      <div className="text-sm mb-3">
                        <div className="text-xs text-gray-500">Contacto</div>
                        <div className="font-medium flex items-center">
                          <Phone className="h-3 w-3 mr-1 text-gray-500" />
                          <a href={`tel:${reservation.phone}`} className="text-primary hover:underline">
                            {reservation.phone}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(reservation.phone || '');
                            }}
                            className="ml-2 p-1 rounded-sm hover:bg-gray-100"
                            title="Copiar al portapapeles"
                          >
                            <ClipboardCopy className="h-3.5 w-3.5 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Notas de la reservación */}
                    {reservation.notes && (
                      <div className="text-sm mb-3">
                        <div className="text-xs text-gray-500">Notas</div>
                        <div className="font-medium p-1.5 bg-gray-50 rounded-sm border border-gray-100 text-gray-700 text-xs">
                          {reservation.notes}
                        </div>
                      </div>
                    )}

                    {/* Información de pago simplificada */}
                    <div className="mt-3">
                      <Badge
                        variant="outline"
                        className={reservation.paymentStatus === 'pagado'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-yellow-100 text-yellow-800 border-yellow-200'}
                      >
                        {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                      </Badge>
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