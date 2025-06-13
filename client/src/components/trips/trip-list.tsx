import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2Icon, MapPinIcon, CalendarIcon } from "lucide-react";
import { DatePicker } from "@/components/ui/date-picker";
import { formatDate, formatPrice } from "@/lib/utils";
import { format } from "date-fns";
import { extractLocationsFromTrips } from "@/lib/trip-utils";

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

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LocationAdapter } from "@/components/ui/location-adapter";
import { LocationOption } from "@/components/ui/command-combobox";
import { TripWithRouteInfo } from "@shared/schema";
import { ReservationStepsModal } from "./reservation-steps-modal";

interface SearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  seats?: number;
  isSubTrip?: 'true' | 'false'; // Explicitly define as 'true' or 'false' string
  visibility?: 'publicado';
}

import { normalizeToStartOfDay, formatDateForInput, formatDateForApiQuery } from "@/lib/utils";

export function TripList() {
  // Obtener la fecha actual formateada como YYYY-MM-DD en hora local
  const today = formatDateForInput(new Date());

  // Calcular fechas permitidas (ayer, hoy, mañana)
  const yesterday = formatDateForInput(new Date(Date.now() - 24 * 60 * 60 * 1000));
  const tomorrow = formatDateForInput(new Date(Date.now() + 24 * 60 * 60 * 1000));

  // Initialize searchParams. Default to isSubTrip: 'false' for initial load.
  // This will be conditionally removed if a specific search is performed.
  const [searchParams, setSearchParams] = useState<SearchParams>({ date: today, isSubTrip: 'false' });
  const [selectedTrip, setSelectedTrip] = useState<TripWithRouteInfo | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [sortMethod, setSortMethod] = useState<"departure" | "price" | "duration">("departure");

  // Form state
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [date, setDate] = useState(today);
  const [seats, setSeats] = useState("");

  // Query para traer TODOS los viajes de la base de datos sin filtros
  const { data: trips, isLoading, isError } = useQuery<TripWithRouteInfo[]>({
    queryKey: ["/api/trips", "all"],
    queryFn: async () => {
      // Fetch ALL trips without any filters
      const response = await fetch(`/api/trips`);
      if (!response.ok) throw new Error("Failed to fetch trips");
      return await response.json();
    },
  });

  // Extract unique locations for autocomplete
  const locationOptions = useMemo(() => {
    if (!trips) return [];
    // Extract locations from ALL fetched trips, as a user might search for a subtrip origin/destination
    return extractLocationsFromTrips(trips);
  }, [trips]);

  // Filter trips based on search parameters
  const filteredTrips = useMemo(() => {
    if (!trips) return [];
    
    // If no search parameters, return all trips
    if (Object.keys(searchParams).length === 0) {
      return trips;
    }
    
    return trips.filter((trip: any) => {
      // Filter by origin
      if (searchParams.origin) {
        const tripOrigin = trip.origin || trip.route?.origin || '';
        if (!tripOrigin.toLowerCase().includes(searchParams.origin.toLowerCase())) {
          return false;
        }
      }
      
      // Filter by destination
      if (searchParams.destination) {
        const tripDestination = trip.destination || trip.route?.destination || '';
        if (!tripDestination.toLowerCase().includes(searchParams.destination.toLowerCase())) {
          return false;
        }
      }
      
      // Filter by date
      if (searchParams.date) {
        const tripDate = trip.date || trip.departureDate;
        if (tripDate !== searchParams.date) {
          return false;
        }
      }
      
      // Filter by available seats
      if (searchParams.seats) {
        if ((trip.availableSeats || 0) < searchParams.seats) {
          return false;
        }
      }
      
      return true;
    });
  }, [trips, searchParams]);

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
    
    setSearchParams(newSearchParams);
  };

  // Handler for reservation button click
  const handleReserve = (trip: TripWithRouteInfo) => {
    setSelectedTrip(trip);
    setShowModal(true);
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

      {/* Opciones de ordenamiento */}
      <div className="mb-6">
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
          {sortedAndFilteredTrips.map((trip) => (
            <div key={trip.id} className="border rounded-lg overflow-hidden hover:shadow-md transition-shadow bg-white">
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
                      <span className="text-xs text-gray-600 mb-1">
                        {trip.companyName}
                      </span>
                    )}
                    <div className="text-sm font-medium">
                      <span>Directo · {(trip as any).availableSeats || 0} asientos disponibles</span>
                    </div>
                  </div>
                </div>
                <div className="text-base font-medium">
                  {formatPrice((trip as any).price || 0)}
                  <span className="text-xs text-gray-500 ml-1">MXN</span>
                </div>
              </div>

              <div className="p-4">
                <div className="grid grid-cols-3 gap-4">
                  <div className="flex flex-col">
                    <div className="text-lg font-bold">
                      {(trip as any).departureTime}
                    </div>
                    <div className="text-sm text-gray-500 mt-1">
                      {(trip as any).origin || trip.route?.origin || 'Origen no disponible'}
                    </div>
                  </div>

                  <div className="flex flex-col items-center justify-center">
                    <div className="text-xs text-gray-500 mb-1">
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
                    <div className="text-lg font-bold">
                      {(trip as any).arrivalTime}
                    </div>
                    <div className="text-sm text-gray-500 mt-1 text-right">
                      {(trip as any).destination || trip.route?.destination || 'Destino no disponible'}
                    </div>
                  </div>
                </div>

                {/* Midnight crossing notification removed - functionality disabled */}

                <div className="mt-4 flex items-center justify-between">
                  {(trip as any).vehicle?.name && (
                    <div className="text-sm">
                      <span className="capitalize">{(trip as any).vehicle.name}</span>
                    </div>
                  )}

                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleReserve(trip)}
                    disabled={((trip as any).availableSeats || 0) <= 0}
                  >
                    Reservar
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
          ))}
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