import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Users, ArrowLeft, Search, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { UserRole } from "@shared/schema";
import { formatDateForInput, formatDateForApiQuery } from "@/lib/utils";
import { TripWithRouteInfo } from "@shared/schema";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

interface SearchParams {
  origin?: string;
  destination?: string;
  date?: string;
  seats?: number;
  isSubTrip?: 'true' | 'false';
  visibility?: 'publicado';
}

interface PackageTripSelectionProps {
  onTripSelect: (trip: TripWithRouteInfo) => void;
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
  const [origin, setOrigin] = useState("all");
  const [destination, setDestination] = useState("all");
  const [date, setDate] = useState(today);

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
    enabled: hasSearched || (origin === "all" && destination === "all"), // Cargar por defecto o después de búsqueda
    staleTime: 30000,
  });

  // Query para obtener ubicaciones (igual que trip-list)
  const { data: allTripsForLocations } = useQuery<TripWithRouteInfo[]>({
    queryKey: ["/api/trips", "locations-optimized"],
    queryFn: async () => {
      const response = await fetch(`/api/trips?isSubTrip=false`);
      if (!response.ok) throw new Error("Failed to fetch trips for locations");
      return await response.json();
    },
  });

  // Función para extraer ubicaciones (simplificada)
  const extractLocationsFromTrips = (trips: TripWithRouteInfo[]) => {
    const origins = new Set<string>();
    const destinations = new Set<string>();
    
    trips.forEach(trip => {
      if (trip.origin) origins.add(trip.origin);
      if (trip.destination) destinations.add(trip.destination);
    });
    
    return {
      origins: Array.from(origins).sort(),
      destinations: Array.from(destinations).sort()
    };
  };

  const locationOptions = useMemo(() => {
    if (!allTripsForLocations) return { origins: [], destinations: [] };
    return extractLocationsFromTrips(allTripsForLocations);
  }, [allTripsForLocations]);

  // Manejar búsqueda
  const handleSearch = () => {
    console.log(`[PackageTripSelection] Searching with filters:`, {
      date,
      origin,
      destination
    });
    
    // Construir nuevos parámetros de búsqueda
    const newSearchParams: SearchParams = {
      date: formatDateForApiQuery(new Date(date)),
      visibility: 'publicado'
    };
    
    // Solo agregar filtros si tienen valores (excluyendo "all")
    if (origin.trim() && origin !== "all") {
      newSearchParams.origin = origin.trim();
    }
    
    if (destination.trim() && destination !== "all") {
      newSearchParams.destination = destination.trim();
    }
    
    // Si hay filtros específicos, cargar todos los segmentos
    if ((origin.trim() && origin !== "all") || (destination.trim() && destination !== "all")) {
      newSearchParams.optimizedResponse = 'false';
    } else {
      newSearchParams.isSubTrip = 'false'; // Solo viajes principales por defecto
    }
    
    setSearchParams(newSearchParams);
    setHasSearched(true);
  };

  // Limpiar filtros
  const clearFilters = () => {
    setOrigin("all");
    setDestination("all");
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
    onTripSelect(trip);
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
              <Select value={origin} onValueChange={setOrigin}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar origen..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cualquier origen</SelectItem>
                  {locationOptions.origins.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="search-destination">Destino (opcional)</Label>
              <Select value={destination} onValueChange={setDestination}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar destino..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Cualquier destino</SelectItem>
                  {locationOptions.destinations.map((location) => (
                    <SelectItem key={location} value={location}>
                      {location}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          {!hasSearched && origin === "all" && destination === "all" ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center space-y-2">
                  <p className="text-lg font-medium">Para ver viajes disponibles</p>
                  <p className="text-muted-foreground">
                    Especifica el origen y/o destino en los filtros y presiona "Buscar Viajes"
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : trips.length === 0 ? (
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
              <div className="grid gap-4">
                {trips.map((trip) => (
                  <Card key={trip.id} className="hover:shadow-md transition-shadow">
                    <CardContent className="pt-6">
                      <div className="flex justify-between items-center">
                        <div className="space-y-3 flex-1">
                          {/* Ruta del viaje */}
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-green-600" />
                            <span className="font-medium text-lg">{trip.origin}</span>
                            <span className="text-muted-foreground text-lg">→</span>
                            <MapPin className="h-4 w-4 text-red-600" />
                            <span className="font-medium text-lg">{trip.destination}</span>
                            {trip.route?.name && (
                              <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                                {trip.route.name}
                              </span>
                            )}
                          </div>

                          {/* Fecha y horarios */}
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(trip.departureDate).toLocaleDateString('es-MX')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-4 w-4" />
                              <span>{trip.departureTime} - {trip.arrivalTime}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Users className="h-4 w-4" />
                              <span>{trip.availableSeats} asientos disponibles</span>
                            </div>
                          </div>

                          {/* Información adicional del viaje */}
                          <div className="text-xs text-muted-foreground">
                            {trip.capacity && `Capacidad total: ${trip.capacity} pasajeros`}
                            {trip.vehicleId && ` • Vehículo: ${trip.vehicleId}`}
                            {trip.driverId && ` • Conductor: ${trip.driverId}`}
                          </div>
                        </div>

                        {/* Botón de selección */}
                        <Button 
                          onClick={() => handleTripSelect(trip)}
                          className="ml-4"
                        >
                          Seleccionar
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}