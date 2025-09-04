import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Calendar, Clock, MapPin, Users, ArrowLeft, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { formatDateForInput, formatDateToLocal, formatDate, formatPrice } from "@/lib/utils";
import { TripWithRouteInfo } from "@shared/schema";
import { LocationAdapter } from "@/components/ui/location-adapter";
import { LocationOption } from "@/components/ui/location-selector";
import { extractLocationsFromTrips, formatTripTime, extractDayIndicator } from "@/lib/trip-utils";

// Función para calcular la duración entre horas, considerando indicadores de día siguiente
function calculateDuration(departureTime: string, arrivalTime: string): string {
  if (!departureTime || !arrivalTime) return "1h";

  // Primero, limpiar los posibles indicadores de día para extraer solo el tiempo
  const cleanDepartureTime = departureTime.replace(/\s*\+\d+d$/, '');
  const cleanArrivalTime = arrivalTime.replace(/\s*\+\d+d$/, '');

  // Extraer el número de días adicionales, si existe
  const departureExtraDays = departureTime.match(/\+(\d+)d$/) ?
    parseInt(departureTime.match(/\+(\d+)d$/)![1], 10) : 0;
  const arrivalExtraDays = arrivalTime.match(/\+(\d+)d$/) ?
    parseInt(arrivalTime.match(/\+(\d+)d$/)![1], 10) : 0;

  // Convertir a formato 24 horas para cálculos
  const parseTime = (time: string) => {
    let [hourMin, period] = time.split(' ');
    let [hours, minutes] = hourMin.split(':').map(Number);

    // Convertir a formato 24 horas
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;

    return { hours, minutes };
  };

  const departure = parseTime(cleanDepartureTime);
  const arrival = parseTime(cleanArrivalTime);

  // Calcular diferencia en minutos, considerando días adicionales
  let totalMinutesDeparture = (departure.hours * 60 + departure.minutes) + (departureExtraDays * 24 * 60);
  let totalMinutesArrival = (arrival.hours * 60 + arrival.minutes) + (arrivalExtraDays * 24 * 60);

  // Si no hay indicadores de día explícitos y la llegada parece ser antes que la salida,
  // asumimos que cruza medianoche
  if (arrivalExtraDays === 0 && departureExtraDays === 0 && totalMinutesArrival < totalMinutesDeparture) {
    totalMinutesArrival += 24 * 60; // Agregar 24 horas en minutos
  }

  const diffMinutes = totalMinutesArrival - totalMinutesDeparture;
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  // Formatear el resultado
  if (hours === 0) {
    return `${minutes}m`;
  } else if (minutes === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${minutes}m`;
  }
}

// Función para determinar si un viaje ya pasó su hora de salida
function isTripExpired(trip: any): boolean {
  const departureDate = trip.departureDate;
  const departureTime = trip.departureTime;
  
  if (!departureDate || !departureTime) return false;
  
  // Obtener fecha y hora actual en timezone de México (UTC-6)
  const now = new Date();
  const mexicoOffset = -6 * 60; // UTC-6 en minutos
  const localOffset = now.getTimezoneOffset(); // minutos respecto a UTC
  const mexicoTime = new Date(now.getTime() + (localOffset + mexicoOffset) * 60000);
  
  const currentDate = mexicoTime.toISOString().split('T')[0]; // YYYY-MM-DD
  const currentHour = mexicoTime.getHours();
  const currentMinute = mexicoTime.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;
  
  // Si la fecha de salida es posterior a hoy, el viaje no ha expirado
  if (departureDate > currentDate) {
    return false;
  }
  
  // Si la fecha de salida es anterior a hoy, el viaje ya expiró
  if (departureDate < currentDate) {
    return true;
  }
  
  // Si es el mismo día, comparar horas
  // Convertir hora de salida a minutos
  const cleanTime = departureTime.replace(/\s*\+\d+d$/, ''); // Remover indicadores de día
  const [hourMin, period] = cleanTime.split(' ');
  let [hours, minutes] = hourMin.split(':').map(Number);
  
  // Convertir a formato 24 horas
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  
  const departureMinutes = hours * 60 + minutes;
  
  // Si es el mismo día y la hora ya pasó, está expirado
  return departureMinutes <= currentTimeMinutes;
}

// Función para estandarizar formato de hora a 12 horas
function standardizeTimeFormat(time: string): string {
  if (!time) return '';
  
  // Limpiar indicadores de día adicionales
  const cleanTime = time.replace(/\s*\+\d+d$/, '');
  
  // Si ya está en formato 12 horas correcto, verificar si es válido
  if (cleanTime.includes('AM') || cleanTime.includes('PM')) {
    const [hourMin, period] = cleanTime.split(' ');
    const [hours, minutes] = hourMin.split(':').map(Number);
    
    // Verificar si es un formato válido de 12 horas
    if (hours >= 1 && hours <= 12) {
      return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
    }
    
    // Si no es válido (como 23:50 PM), convertirlo
    if (hours === 0) {
      return `12:${minutes.toString().padStart(2, '0')} AM`;
    } else if (hours < 12) {
      return `${hours}:${minutes.toString().padStart(2, '0')} AM`;
    } else if (hours === 12) {
      return `12:${minutes.toString().padStart(2, '0')} PM`;
    } else {
      return `${hours - 12}:${minutes.toString().padStart(2, '0')} PM`;
    }
  }
  
  // Convertir de 24 horas a 12 horas
  const [hourMin] = cleanTime.split(' ');
  const [hours, minutes] = hourMin.split(':').map(Number);
  
  if (hours === 0) {
    return `12:${minutes.toString().padStart(2, '0')} AM`;
  } else if (hours < 12) {
    return `${hours}:${minutes.toString().padStart(2, '0')} AM`;
  } else if (hours === 12) {
    return `12:${minutes.toString().padStart(2, '0')} PM`;
  } else {
    return `${hours - 12}:${minutes.toString().padStart(2, '0')} PM`;
  }
}

interface SearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  seats?: number;
  isSubTrip?: 'true' | 'false';
  visibility?: 'publicado';
}

interface PackageTripSelectionProps {
  onTripSelect: (trip: TripWithRouteInfo | number) => void;
  onBack: () => void;
}

export function PackageTripSelection({ onTripSelect, onBack }: PackageTripSelectionProps) {
  const { user } = useAuth();
  
  // Usar la misma lógica que trip-list.tsx
  const today = formatDateForInput(new Date());
  
  const [searchParams, setSearchParams] = useState<SearchParams>({ 
    date: today, 
    isSubTrip: 'false' // Por defecto solo viajes principales
  });
  const [hasSearched, setHasSearched] = useState(false);
  
  // Form state
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(today);
  
  // Modal state for segment selection
  const [selectedTrip, setSelectedTrip] = useState<TripWithRouteInfo | null>(null);
  const [showSegmentModal, setShowSegmentModal] = useState(false);

  // Query principal usando la misma lógica que trip-list
  const { data: trips = [], isLoading, error, refetch } = useQuery<TripWithRouteInfo[]>({
    queryKey: ["/api/trips", searchParams],
    queryFn: async () => {
      const params = new URLSearchParams();
      
      // Agregar parámetros de búsqueda
      Object.entries(searchParams).forEach(([key, value]) => {
        if (value !== undefined && value !== null && value !== "") {
          params.append(key, value.toString());
        }
      });
      
      const url = `/api/trips?${params.toString()}`;
      console.log(`[PackageTripSelection] Fetching: ${url}`);
      
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Error fetching trips: ${response.status}`);
      }
      
      const data = await response.json();
      console.log(`[PackageTripSelection] Received ${data.length} trips`);
      return data;
    },
    // CORREGIDO: Siempre cargar por defecto como en trip-list.tsx
    staleTime: 30000,
  });

  // Query para obtener ubicaciones (usando viajes principales como en trip-list)
  const { data: allTripsForLocations } = useQuery<TripWithRouteInfo[]>({
    queryKey: ["/api/trips", "locations-optimized"],
    queryFn: async () => {
      const response = await fetch(`/api/trips?isSubTrip=false`);
      if (!response.ok) throw new Error("Failed to fetch trips for locations");
      return await response.json();
    },
  });

  const locationOptions = useMemo(() => {
    if (!allTripsForLocations) return [];
    return extractLocationsFromTrips(allTripsForLocations);
  }, [allTripsForLocations]);

  // Manejar búsqueda
  const handleSearch = () => {
    const formattedDate = formatDateToLocal(date);
    console.log(`[PackageTripSelection] Searching with filters:`, {
      originalDate: date,
      formattedDate,
      origin,
      destination
    });
    
    // Construir nuevos parámetros de búsqueda
    const newSearchParams: SearchParams = {
      date: formattedDate,
      visibility: 'publicado'
    };
    
    // Solo agregar filtros si tienen valores
    if (origin.trim()) {
      newSearchParams.origin = origin.trim();
    }
    
    if (destination.trim()) {
      newSearchParams.destination = destination.trim();
    }
    
    // Si hay filtros específicos, cargar todos los segmentos
    if (origin.trim() || destination.trim()) {
      newSearchParams.optimizedResponse = 'false';
    } else {
      newSearchParams.isSubTrip = 'false'; // Solo viajes principales por defecto
    }
    
    setSearchParams(newSearchParams);
    setHasSearched(true);
  };

  // Limpiar filtros
  const clearFilters = () => {
    setOrigin("");
    setDestination("");
    setDate(today);
    setSearchParams({ 
      date: today, 
      isSubTrip: 'false' 
    });
    setHasSearched(false);
  };

  // Manejar selección de viaje
  const handleTripSelect = (trip: TripWithRouteInfo) => {
    console.log(`[PackageTripSelection] Trip selected:`, trip);
    
    const hasSpecificFilters = origin.trim() || destination.trim();
    
    // NUEVA LÓGICA: Siempre seleccionar directamente el viaje principal
    // Solo mostrar modal en casos muy específicos donde sea realmente necesario
    
    if (hasSpecificFilters && trip.tripData && Array.isArray(trip.tripData) && trip.tripData.length > 1) {
      // Si hay filtros específicos, encontrar el segmento que coincida
      const matchingSegmentIndex = trip.tripData.findIndex((segment: any) => {
        const originMatch = !origin.trim() || segment.origin.toLowerCase().includes(origin.toLowerCase());
        const destinationMatch = !destination.trim() || segment.destination.toLowerCase().includes(destination.toLowerCase());
        return originMatch && destinationMatch;
      });
      
      if (matchingSegmentIndex !== -1) {
        console.log(`[PackageTripSelection] Found matching segment at index ${matchingSegmentIndex}`);
        const segment = trip.tripData[matchingSegmentIndex];
        const selectedSegment = {
          ...trip,
          id: `${trip.id}_${matchingSegmentIndex}`,
          tripData: [segment],
          origin: segment.origin,
          destination: segment.destination,
          departureDate: segment.departureDate,
          departureTime: segment.departureTime,
          arrivalTime: segment.arrivalTime,
          availableSeats: segment.availableSeats
        };
        
        console.log(`[PackageTripSelection] Segment ${matchingSegmentIndex} constructed:`, selectedSegment);
        onTripSelect(selectedSegment);
        return;
      }
    }
    
    // COMPORTAMIENTO PRINCIPAL: Seleccionar directamente el viaje principal
    // Si el viaje tiene tripData con múltiples segmentos, usar el segmento principal (isMainTrip: true)
    if (trip.tripData && Array.isArray(trip.tripData) && trip.tripData.length > 1) {
      const mainSegment = trip.tripData.find((segment: any) => segment.isMainTrip === true);
      if (mainSegment) {
        console.log(`[PackageTripSelection] Using main segment directly:`, mainSegment);
        const selectedMainTrip = {
          ...trip,
          id: trip.id, // Mantener ID original del viaje principal
          tripData: [mainSegment],
          origin: mainSegment.origin,
          destination: mainSegment.destination,
          departureDate: mainSegment.departureDate,
          departureTime: mainSegment.departureTime,
          arrivalTime: mainSegment.arrivalTime,
          availableSeats: mainSegment.availableSeats
        };
        
        console.log(`[PackageTripSelection] Main trip selected directly:`, selectedMainTrip);
        onTripSelect(selectedMainTrip);
        return;
      }
    }
    
    // Fallback: seleccionar el viaje tal como está
    console.log(`[PackageTripSelection] Selecting trip as-is (fallback):`, trip);
    onTripSelect(trip);
  };

  // Manejar selección de segmento específico
  const handleSegmentSelect = (segmentIndex: number) => {
    if (!selectedTrip) return;
    
    const segment = selectedTrip.tripData[segmentIndex];
    const selectedSegment = {
      ...selectedTrip,
      id: `${selectedTrip.id}_${segmentIndex}`,
      tripData: [segment],
      origin: segment.origin,
      destination: segment.destination,
      departureDate: segment.departureDate,
      departureTime: segment.departureTime,
      arrivalTime: segment.arrivalTime,
      availableSeats: segment.availableSeats
    };
    
    console.log(`[PackageTripSelection] Segment ${segmentIndex} selected:`, selectedSegment);
    setShowSegmentModal(false);
    setSelectedTrip(null);
    onTripSelect(selectedSegment);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          size="sm" 
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <h2 className="text-2xl font-bold">Seleccionar Viaje para Paquetería</h2>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de Búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search-date">Fecha</Label>
              <Input
                id="search-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="search-origin">Origen (opcional)</Label>
              {locationOptions.length > 0 ? (
                <LocationAdapter
                  options={locationOptions}
                  value={origin}
                  onChange={setOrigin}
                  placeholder="Selecciona origen"
                  mode="grouped"
                  className="w-full"
                />
              ) : (
                <Input
                  placeholder="Cargando ubicaciones..."
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  disabled={true}
                />
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="search-destination">Destino (opcional)</Label>
              {locationOptions.length > 0 ? (
                <LocationAdapter
                  options={locationOptions}
                  value={destination}
                  onChange={setDestination}
                  placeholder="Selecciona destino"
                  mode="grouped"
                  className="w-full"
                />
              ) : (
                <Input
                  placeholder="Cargando ubicaciones..."
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  disabled={true}
                />
              )}
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button onClick={handleSearch} className="flex items-center gap-2">
              <Search className="h-4 w-4" />
              Buscar Viajes
            </Button>
            <Button variant="outline" onClick={clearFilters}>
              Limpiar Filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span className="ml-2">Buscando viajes...</span>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="text-lg font-medium text-red-600">Error al cargar viajes</p>
              <p className="text-muted-foreground">
                {error instanceof Error ? error.message : 'Error desconocido'}
              </p>
              <Button onClick={() => refetch()} variant="outline">
                Reintentar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trips List */}
      {!isLoading && !error && (
        <div className="space-y-4">
          {trips.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">No hay viajes disponibles</p>
                  <p className="text-muted-foreground">
                    No se encontraron viajes que coincidan con tus criterios de búsqueda.
                    Intenta modificar los filtros.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              <h3 className="text-lg font-semibold">
                {trips.length} viaje{trips.length !== 1 ? 's' : ''} disponible{trips.length !== 1 ? 's' : ''}
              </h3>
              <div className="grid grid-cols-1 gap-4">
                {trips.map((trip) => {
                  const isExpired = isTripExpired(trip as any);
                  return (
                  <div key={trip.id} className={`border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white ${
                    isExpired ? 'opacity-60 saturate-0' : ''
                  }`}>
                    <div className="border-b border-gray-100 p-3 flex justify-between items-center">
                      <div className="flex items-center">
                        <div className="mr-3 h-8 w-8 flex-shrink-0">
                          {trip.companyLogo ? (
                            <img
                              src={trip.companyLogo}
                              alt={trip.companyName || "Logo de transportista"}
                              className="h-full w-full object-cover rounded-full"
                              onError={(e) => {
                                const target = e.currentTarget as HTMLImageElement;
                                target.style.display = 'none';
                              }}
                            />
                          ) : (
                            <div className="h-full w-full bg-gray-100 rounded-full flex items-center justify-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="flex flex-col">
                          {trip.companyName && (
                            <span className={`text-xs mb-1 ${isExpired ? 'text-gray-400' : 'text-gray-600'}`}>
                              {trip.companyName}
                            </span>
                          )}
                          <div className={`text-sm font-medium ${isExpired ? 'text-gray-400' : ''}`}>
                            <span>Directo · {(trip as any).availableSeats || 0} asientos disponibles</span>
                          </div>
                        </div>
                      </div>
                      <div className={`text-base font-medium ${isExpired ? 'text-gray-400' : ''}`}>
                        {formatPrice((trip as any).price || 0)}
                        <span className={`text-xs ml-1 ${isExpired ? 'text-gray-300' : 'text-gray-500'}`}>MXN</span>
                      </div>
                    </div>

                    <div className="p-4">
                      <div className="grid grid-cols-3 gap-4">
                        <div className="flex flex-col">
                          <div className={`text-lg font-bold ${isExpired ? 'text-gray-400' : ''}`}>
                            {standardizeTimeFormat((trip as any).departureTime)}
                          </div>
                         
                          <div className={`text-sm mt-1 ${isExpired ? 'text-gray-300' : 'text-gray-500'}`}>
                            {(trip as any).origin || trip.route?.origin || 'Origen no disponible'}
                          </div>
                        </div>

                        <div className="flex flex-col items-center justify-center">
                          <div className={`text-xs mb-1 ${isExpired ? 'text-gray-300' : 'text-gray-500'}`}>
                            {calculateDuration((trip as any).departureTime, (trip as any).arrivalTime)}
                          </div>
                          <div className="relative w-full flex items-center justify-center">
                            <div className="border-t border-gray-300 w-full"></div>
                            <div className="absolute">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M5 12h14"></path>
                                <path d="M12 5l7 7-7 7"></path>
                              </svg>
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                          <div className={`text-lg font-bold ${isExpired ? 'text-gray-400' : ''}`}>
                            {standardizeTimeFormat((trip as any).arrivalTime)}
                          </div>
                          <div className={`text-sm mt-1 text-right ${isExpired ? 'text-gray-300' : 'text-gray-500'}`}>
                            {(trip as any).destination || trip.route?.destination || 'Destino no disponible'}
                          </div>
                        </div>
                      </div>

                      {/* Mostrar mensaje descriptivo para viajes que cruzan la medianoche */}
                      {(extractDayIndicator((trip as any).departureTime) > 0 || extractDayIndicator((trip as any).arrivalTime) > 0) ? (
                        <div className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded-md flex items-center">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                          </svg>
                          {formatTripTime((trip as any).departureTime, true, 'descriptive', (trip as any).departureDate)}
                        </div>
                      ) : null}

                      <div className="mt-4 flex items-center justify-between">
                        {(trip as any).vehicle?.name && (
                          <div className="text-sm">
                            <span className="capitalize">{(trip as any).vehicle.name}</span>
                          </div>
                        )}

                        <Button
                          variant={isExpired ? "secondary" : "default"}
                          size="sm"
                          onClick={() => handleTripSelect(trip)}
                          disabled={((trip as any).availableSeats || 0) <= 0}
                          className={isExpired ? 'opacity-70' : ''}
                        >
                          {isExpired ? "Viaje terminado" : "Seleccionar"}
                        </Button>
                      </div>
                    </div>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Modal de selección de segmentos */}
      <Dialog open={showSegmentModal} onOpenChange={setShowSegmentModal}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>Seleccionar Segmento del Viaje</DialogTitle>
            <DialogDescription>
              Este viaje tiene múltiples segmentos. Selecciona el segmento específico para tu paquetería.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {selectedTrip && selectedTrip.tripData && (
              <div className="grid gap-3">
                {selectedTrip.tripData.map((segment: any, index: number) => (
                  <Card key={index} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleSegmentSelect(index)}>
                    <CardContent className="pt-4">
                      <div className="flex justify-between items-center">
                        <div className="space-y-2 flex-1">
                          {/* Ruta del segmento */}
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-green-600" />
                            <span className="font-medium">{segment.origin}</span>
                            <span className="text-muted-foreground">→</span>
                            <MapPin className="h-4 w-4 text-red-600" />
                            <span className="font-medium">{segment.destination}</span>
                          </div>

                          {/* Fecha y horarios */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{formatDate(segment.departureDate)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{segment.departureTime} - {segment.arrivalTime}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>{segment.availableSeats} asientos disponibles</span>
                            </div>
                          </div>

                          {/* Precio del segmento */}
                          {segment.price && (
                            <div className="text-lg font-semibold text-primary">
                              ${segment.price} MXN
                            </div>
                          )}
                        </div>

                        <Button variant="outline" size="sm">
                          Seleccionar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}