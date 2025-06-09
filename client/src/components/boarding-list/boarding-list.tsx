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

// Importamos nuestros nuevos hooks especializados para conductores
import { useDriverTrips, Trip } from "@/hooks/use-driver-trips";
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
  
  // Usamos nuestro nuevo hook para obtener viajes directamente sin depender de la sección "viajes"
  const { 
    data: trips, 
    isLoading: isLoadingTrips,
    error: tripsError
  } = useDriverTrips();
  
  // Usamos el nuevo hook para obtener todas las reservaciones del conductor sin depender de otros datos
  const {
    data: reservations,
    isLoading: isLoadingReservations,
    error: reservationsError
  } = useAllDriverReservations();

  // Filtrar y agrupar viajes del día actual
  const filteredTrips = useMemo(() => {
    if (!trips) {
      console.log("No hay datos de viajes disponibles");
      return [];
    }
    
    console.log(`Total de viajes obtenidos: ${trips.length}`);
    
    // Mostrar algunos ejemplos de viajes para depuración
    if (trips.length > 0) {
      const sampleTrips = trips.slice(0, 3);
      console.log("Ejemplos de viajes:", sampleTrips.map(t => ({
        id: t.id,
        routeId: t.routeId,
        driverId: t.driverId,
        companyId: t.companyId,
        date: t.departureDate
      })));
    }
    
    // Ya no necesitamos filtrar por conductor aquí porque se hace en el servidor
    if (user && user.role === 'chofer' && user.id) {
      console.log(`Total de viajes asignados al conductor: ${trips.length}`);
    }
    
    // Agrupar viajes por recordId_routeId_fecha
    const tripGroups = new Map<string, Trip[]>();
    
    trips.forEach((trip) => {
      const tripDate = trip.departureDate || '';
      
      // Solo incluir viajes de la fecha seleccionada
      if (!isSameLocalDay(tripDate, currentDate)) {
        return;
      }
      
      // Extraer recordId del ID del viaje (formato: recordId_segmentIndex)
      const recordId = trip.id.toString().split('_')[0];
      const groupKey = `${tripDate}_${trip.routeId}`;
      
      if (!tripGroups.has(groupKey)) {
        tripGroups.set(groupKey, []);
      }
      tripGroups.get(groupKey)!.push(trip);
    });
    
    // Seleccionar solo el viaje padre (primer segmento) de cada grupo
    const parentTrips: Trip[] = [];
    
    tripGroups.forEach((tripsGroup, groupKey) => {
      console.log(`[BoardingList] Grupo ${groupKey}: ${tripsGroup.length} viajes, seleccionando viaje padre ID ${tripsGroup[0].id}`);
      
      // Ordenar por ID para asegurar que tomamos el primer segmento
      tripsGroup.sort((a: Trip, b: Trip) => a.id.toString().localeCompare(b.id.toString()));
      
      // Tomar solo el primer viaje (viaje padre)
      parentTrips.push(tripsGroup[0]);
    });
    
    console.log(`Filtrando viajes por fecha: ${format(currentDate, 'yyyy-MM-dd')}`);
    console.log(`Viajes agrupados y filtrados por fecha (${format(currentDate, 'yyyy-MM-dd')}): ${parentTrips.length}`);
    
    return parentTrips;
  }, [trips, user, currentDate]);

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
    if (!trips || !reservations) return 0;
    
    const tripIdStr = tripId.toString();
    
    // Extraer recordId del tripId (formato: recordId_segmentIndex)
    const recordId = tripIdStr.split('_')[0];
    
    // Buscar todas las reservaciones que pertenecen a cualquier segmento de este record
    // Las reservaciones tienen tripDetails.id que puede ser "recordId_X" donde X es cualquier índice
    const relatedReservations = reservations.filter(reservation => {
      if (!reservation.tripDetails?.id) return false;
      
      const reservationTripId = reservation.tripDetails.id.toString();
      const reservationRecordId = reservationTripId.split('_')[0];
      
      // Incluir si pertenece al mismo record (independientemente del segmento)
      return reservationRecordId === recordId;
    });
    
    // Contar todos los pasajeros de las reservaciones relacionadas
    let totalPassengers = 0;
    for (const reservation of relatedReservations) {
      if (reservation.passengers && Array.isArray(reservation.passengers)) {
        totalPassengers += reservation.passengers.length;
      }
    }
    
    console.log(`[BoardingList] ANÁLISIS COMPLETO para viaje ${tripIdStr} - con ${relatedReservations.length - 1} subviajes relacionados`);
    console.log(`[BoardingList] Encontradas localmente ${relatedReservations.length} reservaciones para viaje ${tripIdStr} y sus subviajes`);
    console.log(`[BoardingList] TOTAL FINAL para viaje ${tripIdStr}: ${totalPassengers} pasajeros en ${relatedReservations.length} reservaciones`);
    
    return totalPassengers;
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

      {isLoadingTrips || isLoadingReservations ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : filteredTrips.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTrips.map(trip => {
            const passengerCount = getPassengerCount(trip.id);
            const occupancyRate = Math.round(((trip.capacity - trip.availableSeats) / trip.capacity) * 100);
            
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
                        <h3 className="font-semibold text-lg">{trip.route?.name}</h3>
                        <p className="text-sm text-gray-500">
                          {trip.segmentOrigin || (trip.route?.origin || 'Origen')} → {trip.segmentDestination || (trip.route?.destination || 'Destino')}
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
                        <span className="capitalize">
                          {(() => {
                            // Primero intentamos mostrar la info desde assignedVehicle si existe
                            if (trip.assignedVehicle) {
                              return `${trip.assignedVehicle.brand} ${trip.assignedVehicle.model} - ${trip.assignedVehicle.plates}`;
                            }
                            // Si no hay assignedVehicle pero hay vehicleId, buscamos por ID
                            else if (trip.vehicleId && trips) {
                              // Buscar el vehículo en trips (algún viaje podría tener la info)
                              const vehicleInfo = trips
                                .filter(t => t.assignedVehicle !== undefined)
                                .find(t => t.vehicleId === trip.vehicleId)?.assignedVehicle;
                              
                              if (vehicleInfo) {
                                return `${vehicleInfo.brand} ${vehicleInfo.model} - ${vehicleInfo.plates}`;
                              }
                            }
                            // Si no tenemos info, mostramos "Sin unidad asignada"
                            return 'Sin unidad asignada';
                          })()}
                        </span>
                      </div>
                      
                      {trip.driverId && user?.role === 'chofer' && (
                        <div className="flex items-center text-green-600">
                          <User className="h-4 w-4 mr-2" />
                          <span className="font-medium">Asignado a ti</span>
                        </div>
                      )}
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