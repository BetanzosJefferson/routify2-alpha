import { useState, useEffect, useMemo } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useLocation } from "wouter";
import { 
  CalendarIcon, 
  ClipboardListIcon,
  Users, 
  Calendar,
  Clock,
  Bus,
  User
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { normalizeToStartOfDay, isSameLocalDay } from "@/lib/utils";
import { formatTripTime } from "@/lib/trip-utils";

// Importamos el hook de reservaciones
import { useAllDriverReservations, Reservation, Passenger } from "@/hooks/use-driver-reservations";
import { PassengerListSidebar } from "./passenger-list-sidebar";

export function BoardingList() {
  // Usar la fecha actual por defecto
  const [currentDate, setCurrentDate] = useState<Date>(() => {
    const today = new Date();
    console.log(`[BoardingList] Inicializando con la fecha actual: ${today.toISOString()}`);
    return today;
  });
  const [selectedTripId, setSelectedTripId] = useState<number | null>(null);
  const [, navigate] = useLocation();
  const { user } = useAuth();
  
  // Solo usamos reservaciones para extraer los viajes
  const {
    data: reservations,
    isLoading: isLoadingReservations,
    error: reservationsError
  } = useAllDriverReservations();

  // Filtrar y agrupar viajes del día actual
  const filteredTrips = useMemo(() => {
    if (!reservations) {
      console.log("[BoardingList] No hay reservaciones disponibles");
      return [];
    }

    const today = normalizeToStartOfDay(currentDate);
    
    console.log(`[BoardingList] Agrupando reservaciones por viajes para la fecha: ${today.toISOString()}`);
    console.log(`[BoardingList] Total reservaciones disponibles: ${reservations.length}`);
    
    // Agrupar reservaciones por tripDetails.id y extraer información del viaje
    const tripGroups = new Map();
    
    reservations.forEach((reservation: any) => {
      if (!reservation.tripDetails?.id || !reservation.tripDetails?.departureDate) {
        return;
      }
      
      const tripId = reservation.tripDetails.id.toString();
      const tripDate = new Date(reservation.tripDetails.departureDate);
      
      // Solo incluir viajes del día seleccionado
      if (!isSameLocalDay(tripDate, today)) {
        return;
      }
      
      if (!tripGroups.has(tripId)) {
        // Crear un objeto de viaje basado en tripDetails
        tripGroups.set(tripId, {
          id: tripId,
          departureDate: reservation.tripDetails.departureDate,
          departureTime: reservation.tripDetails.departureTime,
          arrivalTime: reservation.tripDetails.arrivalTime,
          origin: reservation.tripDetails.origin,
          destination: reservation.tripDetails.destination,
          price: reservation.tripDetails.price,
          availableSeats: reservation.tripDetails.availableSeats,
          reservationsCount: 0
        });
      }
      
      tripGroups.get(tripId).reservationsCount++;
    });

    const grouped = Array.from(tripGroups.values());
    console.log(`[BoardingList] Viajes agrupados para ${today.toDateString()}: ${grouped.length}`);
    
    return grouped;
  }, [reservations, currentDate]);

  // La lógica de procesamiento de pasajeros ya no es necesaria aquí
  // ya que ahora se maneja en la página dedicada de PassengerListPage

  // Función para formatear fecha para su visualización con ajuste para zona horaria
  const formatDisplayDate = (dateString: string | Date) => {
    // Usar nuestra función de utilidad para normalizar la fecha
    const normalizedDate = normalizeToStartOfDay(dateString);
    return format(normalizedDate, "d 'de' MMMM, yyyy", { locale: es });
  };

  // Función para formatear fecha para input date
  const formatDateForInput = (date: Date) => {
    return format(date, "yyyy-MM-dd");
  };

  // Función para obtener conteo de pasajeros por viaje padre usando tripDetails.id
  const getPassengerCount = (tripId: string | number) => {
    const trip = filteredTrips.find(t => t.id === tripId.toString());
    return trip?.reservationsCount || 0;
  };

  return (
    <div className="py-6 relative">


      {/* Selector de fecha */}
      <div className="flex justify-center items-center mb-6">
        <div className="w-full max-w-md">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <CalendarIcon className="h-5 w-5 text-gray-400" />
            </div>
            <Input
              type="date"
              className="pl-10 pr-4 py-2 w-full"
              value={formatDateForInput(currentDate)}
              onChange={(e) => {
                if (e.target.value) {
                  // Al crear la fecha con formato yyyy-MM-dd, usar el constructor con año, mes, día para evitar problemas de zona horaria
                  const [year, month, day] = e.target.value.split('-').map(Number);
                  // Meses en JavaScript son 0-indexados (0-11), pero en el input date son 1-indexados (1-12)
                  const newDate = new Date(year, month - 1, day, 12, 0, 0);
                  setCurrentDate(newDate);
                } else {
                  setCurrentDate(new Date());
                }
              }}
            />
          </div>
        </div>
      </div>

      {isLoadingReservations ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredTrips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrips.map(trip => {
            const passengerCount = trip.reservationsCount;
            
            return (
              <Card 
                key={trip.id} 
                className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                onClick={() => {
                  setSelectedTripId(trip.id);
                }}
              >
                <CardContent className="p-0">
                  <div className="p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h3 className="font-semibold text-lg">Viaje {trip.id}</h3>
                        <p className="text-sm text-gray-500">
                          {trip.origin} → {trip.destination}
                        </p>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center text-gray-600">
                        <Calendar className="h-4 w-4 mr-2" />
                        {formatDisplayDate(trip.departureDate)}
                      </div>
                      
                      <div className="flex items-center text-gray-600">
                        <Clock className="h-4 w-4 mr-2" />
                        {formatTripTime(trip.departureTime, true, 'standard')} - {formatTripTime(trip.arrivalTime, true, 'standard')}
                      </div>
                      
                      <div className="flex items-center text-gray-600">
                        <Bus className="h-4 w-4 mr-2" />
                        <span>Disponible {trip.availableSeats} asientos</span>
                      </div>
                      
                      <div className="flex items-center text-gray-600">
                        <Users className="h-4 w-4 mr-2" />
                        <span>{passengerCount} pasajeros</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center border-t p-3 bg-gray-50">
                    <div className="flex items-center">
                      <Users className="h-4 w-4 mr-2 text-gray-500" />
                      <span className="text-sm font-medium">{passengerCount} pasajeros</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 text-gray-500">
          <ClipboardListIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
          <h3 className="text-lg font-medium mb-2">No hay viajes programados</h3>
          {user?.role === 'chofer' ? (
            <p>No tienes viajes asignados para la fecha seleccionada.</p>
          ) : (
            <p>No se encontraron viajes para la fecha seleccionada.</p>
          )}
        </div>
      )}

      {/* Panel lateral de pasajeros */}
      {selectedTripId && (
        <PassengerListSidebar 
          tripId={selectedTripId} 
          onClose={() => setSelectedTripId(null)} 
        />
      )}
    </div>
  );
}