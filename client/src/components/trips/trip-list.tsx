import { useState, useEffect, useMemo, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2Icon, MapPinIcon, CalendarIcon, RefreshCw } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDate, formatPrice, normalizeToStartOfDay, formatDateForInput, formatDateToLocal } from "@/lib/utils";
import { format } from "date-fns";
import { extractLocationsFromTrips, formatTripTime, extractDayIndicator } from "@/lib/trip-utils";
import { tripCache } from "@/lib/trip-cache";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocationAdapter } from "@/components/ui/location-adapter";
import { LocationOption } from "@/components/ui/command-combobox";
import { TripWithRouteInfo } from "@shared/schema";
import { ReservationStepsModal } from "./reservation-steps-modal";

// Función para abreviar ubicaciones en móvil
function abbreviateLocation(location: string): string {
  if (!location) return '';

  // Si ya es corto, dejarlo como está
  if (location.length <= 8) return location;

  // Si tiene comas, tomar solo la primera parte
  if (location.includes(',')) {
    return location.split(',')[0].trim();
  }

  // Si tiene espacios, tomar primeras letras de cada palabra
  if (location.includes(' ')) {
    const words = location.split(' ');
    if (words.length >= 2) {
      return words.map(word => word.charAt(0)).join('');
    }
  }

  // Si todo falla, cortar a 8 caracteres
  return location.substring(0, 7) + '.';
}

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

// Función para filtrar viajes que aún no han salido
function filterTripsByTime(trips: TripWithRouteInfo[]): TripWithRouteInfo[] {
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
  const currentTimeMinutes = currentHour * 60 + currentMinute;
  
  console.log(`[TIME_FILTER] Hora actual: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${currentTimeMinutes} minutos)`);
  
  return trips.filter(trip => {
    const departureTime = (trip as any).departureTime;
    if (!departureTime) return false;
    
    // Convertir hora de salida a minutos
    const cleanTime = departureTime.replace(/\s*\+\d+d$/, ''); // Remover indicadores de día
    const [hourMin, period] = cleanTime.split(' ');
    let [hours, minutes] = hourMin.split(':').map(Number);
    
    // Convertir a formato 24 horas
    if (period === 'PM' && hours < 12) hours += 12;
    if (period === 'AM' && hours === 12) hours = 0;
    
    const departureMinutes = hours * 60 + minutes;
    
    // CORRECCIÓN: Mostrar viajes que salen en el futuro (no en el pasado)
    // Si el viaje es para el día siguiente (cruza medianoche), siempre mostrarlo
    if (departureTime.includes('+1d')) {
      console.log(`[TIME_FILTER] Viaje ${trip.id} (${departureTime}) - Día siguiente: INCLUIDO`);
      return true;
    }
    
    // Para viajes del mismo día, mostrar solo los que aún no han salido
    const willDepart = departureMinutes > currentTimeMinutes;
    console.log(`[TIME_FILTER] Viaje ${trip.id} (${departureTime}) - Salida: ${departureMinutes} min, Actual: ${currentTimeMinutes} min, Incluir: ${willDepart}`);
    
    return willDepart;
  });
}

// Función para determinar si un viaje ya pasó su hora de salida
function isTripExpired(trip: any): boolean {
  const departureDate = trip.departureDate;
  const departureTime = trip.departureTime;
  
  if (!departureDate || !departureTime) return false;
  
  // Usar el mismo enfoque que getCurrentLocalDate() - sin conversiones de timezone
  const now = new Date();
  const currentDate = formatDateToLocal(now); // YYYY-MM-DD usando función global
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();
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
  
  // DEBUG: Log para entender el problema de viajes nocturnos
  console.log(`[isTripExpired] Viaje ${trip.id}: ${departureTime} en ${departureDate}`);
  console.log(`[isTripExpired] Fecha actual: ${currentDate}, Hora actual: ${currentHour}:${currentMinute.toString().padStart(2, '0')}`);
  console.log(`[isTripExpired] Hora salida: ${hours}:${minutes.toString().padStart(2, '0')} (${departureMinutes} min)`);
  console.log(`[isTripExpired] Hora actual en minutos: ${currentTimeMinutes}`);
  
  // SIMPLIFICADO: Para viajes del mismo día, simplemente comparar si la hora ya pasó
  // Sin lógica especial para viajes nocturnos - dejar que funcione naturalmente
  const isExpired = departureMinutes <= currentTimeMinutes;
  
  console.log(`[isTripExpired] ¿Expirado? ${isExpired}`);
  
  return isExpired;
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
  isSubTrip?: 'true' | 'false'; // Explicitly define as 'true' or 'false' string
  visibility?: 'publicado';
}

interface TripListProps {
  customButtonText?: string;
  onTripSelect?: (trip: TripWithRouteInfo, tripData?: any) => void;
  defaultFilters?: {
    origin?: string;
    destination?: string;
    date?: string;
    passengers?: number;
  };
  isTransferMode?: boolean; // Nueva prop para modo de transferencia
}

export function TripList({ customButtonText, onTripSelect, defaultFilters, isTransferMode = false }: TripListProps = {}) {
  // Obtener la fecha actual formateada como YYYY-MM-DD en hora local
  const today = formatDateForInput(new Date());

  // Calcular fechas permitidas (ayer, hoy, mañana)
  const yesterday = formatDateForInput(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const tomorrow = formatDateForInput(new Date(Date.now() + 24 * 60 * 60 * 1000));

  // Initialize searchParams. Default to isSubTrip: 'false' for initial load.
  // This will be conditionally removed if a specific search is performed.
  const [searchParams, setSearchParams] = useState<SearchParams>({ date: today, isSubTrip: 'false' });
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedTrip, setSelectedTrip] = useState<TripWithRouteInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortMethod, setSortMethod] = useState<"departure" | "price" | "duration">("departure");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Form state
  const [origin, setOrigin] = useState(defaultFilters?.origin || "");
  const [destination, setDestination] = useState(defaultFilters?.destination || "");
  const [date, setDate] = useState(defaultFilters?.date || today);
  const [seats, setSeats] = useState(defaultFilters?.passengers?.toString() || "");
  
  // Referencias para actualización automática
  const queryClient = useQueryClient();
  const updateIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Función para actualizar datos automáticamente
  const refreshTripData = async () => {
    try {
      // Invalidar caché
      tripCache.clear();
      
      // Invalidar consultas
      await queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      
      setLastUpdate(new Date());
    } catch (error) {
      console.error('Error al actualizar datos de viajes:', error);
    }
  };

  // Efecto para actualización automática cada 30 segundos
  useEffect(() => {
    updateIntervalRef.current = setInterval(refreshTripData, 30000);
    
    return () => {
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current);
      }
    };
  }, [queryClient]);

  // Efecto para actualización automática cada minuto (filtro de tiempo) - DESHABILITADO
  // useEffect(() => {
  //   const timeFilterInterval = setInterval(() => {
  //     // Solo actualizar si no hay búsqueda específica
  //     if (!hasSearched || (!origin && !destination)) {
  //       setLastUpdate(new Date());
  //     }
  //   }, 60000); // 60 segundos
  //   
  //   return () => clearInterval(timeFilterInterval);
  // }, [hasSearched, origin, destination]);

  // Query para traer viajes usando los parámetros de búsqueda
  const { data: trips, isLoading, isError } = useQuery<TripWithRouteInfo[]>({
    queryKey: ["/api/trips", searchParams],
    queryFn: async () => {
      // Verificar caché primero
      const cachedData = tripCache.get(searchParams);
      if (cachedData) {
        return cachedData;
      }

      // Construir URL con parámetros de búsqueda
      const params = new URLSearchParams();
      
      // Solo agregar filtros específicos si el usuario los ha especificado
      if (searchParams.origin && searchParams.origin.trim()) params.append('origin', searchParams.origin);
      if (searchParams.destination && searchParams.destination.trim()) params.append('destination', searchParams.destination);
      if (searchParams.seats && searchParams.seats > 0) params.append('seats', searchParams.seats.toString());
      
      // Siempre incluir isSubTrip para optimización
      if (searchParams.isSubTrip) params.append('isSubTrip', searchParams.isSubTrip);
      
      // Incluir fecha si está especificada
      if (searchParams.date) {
        params.append('date', searchParams.date);
      }
      
      const url = `/api/trips${params.toString() ? '?' + params.toString() : ''}`;
      console.log('TripList: Consultando URL:', url);
      
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch trips");
      const data = await response.json();
      
      // Guardar en caché
      tripCache.set(searchParams, data);
      
      return data;
    },
  });

  // Query separada para obtener ubicaciones optimizada
  const { data: allTripsForLocations } = useQuery<TripWithRouteInfo[]>({
    queryKey: ["/api/trips", "locations-optimized"],
    queryFn: async () => {
      // Usar endpoint optimizado para obtener solo viajes principales para ubicaciones
      const response = await fetch(`/api/trips?isSubTrip=false`);
      if (!response.ok) throw new Error("Failed to fetch trips for locations");
      return await response.json();
    },
  });

  const locationOptions = useMemo(() => {
    if (!allTripsForLocations) return [];
    return extractLocationsFromTrips(allTripsForLocations);
  }, [allTripsForLocations]);

  // Filtrar viajes basándose en los parámetros de búsqueda
  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    
    let filtered = trips;
    
    // Filtrar por número de asientos
    if (seats && parseInt(seats) > 0) {
      filtered = filtered.filter(trip => ((trip as any).availableSeats || 0) >= parseInt(seats));
    }
    
    // Filtro de tiempo deshabilitado - mostrar todos los horarios
    // if (!hasSearched || (!origin && !destination)) {
    //   filtered = filterTripsByTime(filtered);
    // }
    
    return filtered;
  }, [trips, seats, hasSearched, origin, destination]);
  
  console.log('TripList: Datos recibidos del backend:', trips);
  console.log('TripList: Número de viajes después del filtro:', filteredTrips.length);

  // Handler for search button click
  const handleSearch = () => {
    const newSearchParams: SearchParams = {};
    
    if (origin.trim()) {
      newSearchParams.origin = origin.trim();
    }
    
    if (destination.trim()) {
      newSearchParams.destination = destination.trim();
    }
    
    if (date) {
      newSearchParams.date = date;
    }
    
    if (seats.trim() && parseInt(seats) > 0) {
      newSearchParams.seats = parseInt(seats);
    }
    
    // Solo incluir isSubTrip='false' si no se ha especificado origen y destino
    // Si se especifica origen y destino, permitir que se busquen todas las combinaciones
    if (!origin.trim() && !destination.trim()) {
      newSearchParams.isSubTrip = 'false';
    }
    
    setSearchParams(newSearchParams);
    setHasSearched(true); // Marcar que se ha realizado una búsqueda
    
    console.log('Búsqueda realizada:', newSearchParams);
  };

  // Handler for reservation button click
  const handleReserve = (trip: TripWithRouteInfo, tripData?: any) => {
    console.log('[TripList] handleReserve called with:', { trip: trip.id, tripData, onTripSelect: !!onTripSelect });
    if (onTripSelect) {
      // Si hay un callback personalizado, usarlo en lugar del modal
      console.log('[TripList] Calling onTripSelect');
      onTripSelect(trip, tripData);
    } else {
      // Comportamiento normal: abrir modal de reservación
      console.log('[TripList] Opening reservation modal');
      setSelectedTrip(trip);
      setShowModal(true);
    }
  };

  // Close modal handler
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedTrip(null);
  };

  // Función para ordenar los viajes filtrados según el criterio seleccionado
  const sortedAndFilteredTrips = useMemo(() => {
    if (!filteredTrips) return [];

    return [...filteredTrips].sort((a: any, b: any) => {
      if (sortMethod === "departure") {
        const getTimeValue = (timeStr: string) => {
          const [time, period] = timeStr.split(' ');
          const [hours, minutes] = time.split(':').map(Number);
          let value = hours * 60 + minutes;
          if (period === 'PM' && hours < 12) value += 12 * 60;
          if (period === 'AM' && hours === 12) value = minutes;
          return value;
        };
        return getTimeValue(a.departureTime) - getTimeValue(b.departureTime);
      }

      if (sortMethod === "price") {
        const priceA = a.price || 0;
        const priceB = b.price || 0;
        return priceA - priceB;
      }

      if (sortMethod === "duration") {
        const getDuration = (departureTime: string, arrivalTime: string) => {
          if (!departureTime || !arrivalTime) return 0;
          const parseTime = (time: string) => {
            let [hourMin, period] = time.split(' ');
            let [hours, minutes] = hourMin.split(':').map(Number);
            if (period === 'PM' && hours < 12) hours += 12;
            if (period === 'AM' && hours === 12) hours = 0;
            return hours * 60 + minutes;
          };
          let departure = parseTime(departureTime);
          let arrival = parseTime(arrivalTime);
          if (arrival < departure) {
            arrival += 24 * 60;
          }
          return arrival - departure;
        };
        const durationA = getDuration(a.departureTime, a.arrivalTime);
        const durationB = getDuration(b.departureTime, b.arrivalTime);
        return durationA - durationB;
      }
      return 0;
    });
  }, [filteredTrips, sortMethod]);

  return (
    <div className="py-6">
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            <div>
              <Label htmlFor="originFilter" className="block text-sm font-medium text-gray-700 mb-1">Origen</Label>
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
                  id="originFilter"
                  placeholder="Cargando ubicaciones..."
                  value={origin}
                  onChange={(e) => setOrigin(e.target.value)}
                  disabled={isLoading}
                />
              )}
            </div>
            <div>
              <Label htmlFor="destinationFilter" className="block text-sm font-medium text-gray-700 mb-1">Destino</Label>
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
                  id="destinationFilter"
                  placeholder="Cargando ubicaciones..."
                  value={destination}
                  onChange={(e) => setDestination(e.target.value)}
                  disabled={isLoading}
                />
              )}
            </div>
            <div>
              <Label htmlFor="dateFilter" className="block text-sm font-medium text-gray-700 mb-1">Fecha</Label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CalendarIcon className="h-5 w-5 text-gray-400" />
                </div>
                <Input
                  id="dateFilter"
                  type="date"
                  className="pl-10"
                  value={date}
                  min={yesterday}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <label htmlFor="seatsFilter" className="block text-sm font-medium text-gray-700 mb-1">Asientos</label>
              <Input
                id="seatsFilter"
                type="number"
                min="1"
                placeholder="Número de asientos"
                value={seats}
                onChange={(e) => setSeats(e.target.value)}
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleSearch}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                    Buscar viaje
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Opciones de ordenamiento y actualización */}
      <div className="mb-6">
        <div className="flex flex-col md:flex-row gap-2 items-start justify-between">
          <div className="flex flex-col md:flex-row gap-2 items-start">
            <div className="text-sm font-medium text-gray-700">Ordenar por:</div>
            <div className="flex flex-wrap gap-2">
              <button
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  sortMethod === "departure"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setSortMethod("departure")}
              >
                Salida más temprana
              </button>
              <button
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  sortMethod === "price"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setSortMethod("price")}
              >
                Precio más bajo
              </button>
              <button
                className={`px-3 py-1 text-sm rounded-full transition-colors ${
                  sortMethod === "duration"
                    ? "bg-blue-50 text-blue-600"
                    : "bg-gray-50 text-gray-600 hover:bg-gray-100"
                }`}
                onClick={() => setSortMethod("duration")}
              >
                Duración más corta
              </button>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              onClick={refreshTripData}
              variant="outline"
              size="sm"
              className="gap-2"
            >
              <RefreshCw className="h-4 w-4" />
              Actualizar
            </Button>
            <div className="text-xs text-gray-500">
              Última actualización: {format(lastUpdate, 'HH:mm:ss')}
            </div>
          </div>
        </div>
      </div>



      {isLoading ? (
        <div className="flex justify-center items-center p-8">
          <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
          <span className="ml-2">Cargando viajes...</span>
        </div>
      ) : isError ? (
        <div className="text-center p-8 text-red-500">
          Error al cargar los viajes. Por favor, inténtalo de nuevo.
        </div>
      ) : sortedAndFilteredTrips && sortedAndFilteredTrips.length > 0 ? (
        <div className="grid grid-cols-1 gap-4">
          {sortedAndFilteredTrips.map((trip) => {
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
                        {/* Mostrar operador solo en modo transferencia */}
                        {isTransferMode && (() => {
                          const driver = (trip as any).driver || (trip as any).assignedDriver;
                          if (driver && (driver.firstName || driver.name)) {
                            const driverName = driver.firstName 
                              ? `${driver.firstName} ${driver.lastName || ''}`.trim()
                              : driver.name;
                            return (
                              <span className={`${isExpired ? 'text-gray-300' : 'text-gray-500'}`}> · Operador: {driverName}</span>
                            );
                          }
                          return null;
                        })()}
                      </span>
                    )}
                    <div className={`text-sm font-medium ${isExpired ? 'text-gray-400' : ''}`}>
                      <span>Directo · {(trip as any).availableSeats || 0} asientos disponibles</span>
                      {/* Leyenda para sub-viajes que pertenecen a viajes padre de días anteriores */}
                      {(() => {
                        const tripData = (trip as any);
                        const isSubTrip = tripData.isSubTrip || false;
                        const parentDepartureDate = tripData.parentDepartureDate;
                        const parentDepartureTime = tripData.parentDepartureTime;
                        const parentOrigin = tripData.parentOrigin;
                        const segmentDate = tripData.departureDate; // Fecha del segmento actual
                        
                        // Verificar si es un sub-viaje y si la fecha del viaje padre es diferente a la fecha del segmento
                        if (isSubTrip && parentDepartureDate && segmentDate && parentDepartureDate !== segmentDate) {
                          return (
                            <div className="mt-2 text-xs text-blue-600 bg-blue-50 p-2 rounded-md flex items-center">
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10"></circle>
                                <polyline points="12,6 12,12 16,14"></polyline>
                              </svg>
                              <span className="flex-1">
                                Este viaje pertenece a la salida <strong>{parentDepartureTime}</strong> con fecha <strong>{parentDepartureDate}</strong> saliendo desde <strong>{parentOrigin}</strong>
                              </span>
                            </div>
                          );
                        }
                        return null;
                      })()}
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
                      {(() => {
                        const originalTime = (trip as any).departureTime;
                        const convertedTime = standardizeTimeFormat(originalTime);
                        console.log(`[TIME_DEBUG] Original: ${originalTime} -> Converted: ${convertedTime}`);
                        return convertedTime;
                      })()}
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
                    onClick={() => handleReserve(trip, (trip as any))}
                    disabled={((trip as any).availableSeats || 0) <= 0}
                    className={isExpired ? 'opacity-70' : ''}
                  >
                    {isExpired ? "Reservar" : (customButtonText || "Reservar")}
                  </Button>
                </div>

                {!(trip as any).isSubTrip && (trip as any).numStops > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <span className="text-xs text-gray-500">
                      {trip.numStops} paradas en ruta
                    </span>
                  </div>
                )}
              </div>
            </div>
            );
          })}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="text-center text-gray-500 mb-4">
              <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">No hay viajes disponibles para esta fecha con los filtros aplicados.</p>
              <p className="text-sm mt-2">Intenta con otra fecha o modifica los filtros de búsqueda.</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reservation Modal */}
      {selectedTrip && (
        <ReservationStepsModal
          trip={selectedTrip}
          isOpen={showModal}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
}