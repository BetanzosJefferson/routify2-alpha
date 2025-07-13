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
import { formatDateForInput, formatDateToLocal, formatDate } from "@/lib/utils";
import { TripWithRouteInfo } from "@shared/schema";
import { LocationAdapter } from "@/components/ui/location-adapter";
import { LocationOption } from "@/components/ui/location-selector";
import { extractLocationsFromTrips } from "@/lib/trip-utils";

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
    
    // Si el viaje tiene tripData con múltiples segmentos Y no se buscó con filtros específicos,
    // mostrar modal de selección. Si se buscó con filtros específicos, es una combinación específica.
    const hasSpecificFilters = origin.trim() || destination.trim();
    
    if (trip.tripData && Array.isArray(trip.tripData) && trip.tripData.length > 1 && !hasSpecificFilters) {
      console.log(`[PackageTripSelection] Trip has ${trip.tripData.length} segments and no specific filters, showing segment selection modal`);
      setSelectedTrip(trip);
      setShowSegmentModal(true);
    } else {
      // Es un viaje simple, tiene un segmento, o es una combinación específica filtrada
      console.log(`[PackageTripSelection] Selecting trip directly - hasSpecificFilters: ${hasSpecificFilters}, segments: ${trip.tripData?.length || 1}`);
      
      // Si es una búsqueda específica y tiene múltiples segmentos, necesitamos encontrar el segmento correcto
      if (hasSpecificFilters && trip.tripData && Array.isArray(trip.tripData) && trip.tripData.length > 1) {
        // Encontrar el segmento que coincida con los filtros aplicados
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
      
      // Fallback: seleccionar el viaje tal como está
      onTripSelect(trip);
    }
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
                              <span>{formatDate(trip.departureDate)}</span>
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