import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Users, ArrowLeft, Search, Loader2 } from "lucide-react";

interface TripSegment {
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  price: number;
  availableSeats: number;
  tripId: number;
  isMainTrip: boolean;
}

interface Trip {
  id: string;
  tripData: TripSegment[];
  capacity: number;
  vehicleId?: number;
  driverId?: number;
  visibility: string;
  routeId?: number;
  companyId: string;
  route?: {
    id: number;
    name: string;
    origin: string;
    destination: string;
    stops: string[];
  };
}

interface PackageTripSelectionProps {
  onTripSelect: (trip: Trip) => void;
  onBack: () => void;
}

export function PackageTripSelection({ onTripSelect, onBack }: PackageTripSelectionProps) {
  const [searchDate, setSearchDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  
  const [searchOrigin, setSearchOrigin] = useState("");
  const [searchDestination, setSearchDestination] = useState("");

  // Construir la URL de búsqueda con parámetros
  const buildSearchUrl = () => {
    const params = new URLSearchParams();
    if (searchDate) params.append("date", searchDate);
    if (searchOrigin.trim()) params.append("origin", searchOrigin.trim());
    if (searchDestination.trim()) params.append("destination", searchDestination.trim());
    // Forzar búsqueda expandida para obtener todos los segmentos
    params.append("optimizedResponse", "false");
    return `/api/trips?${params.toString()}`;
  };

  // Query para obtener viajes - usando enfoque simplificado
  const { data: rawTrips = [], isLoading, error, refetch } = useQuery({
    queryKey: ["package-trips", searchDate, searchOrigin, searchDestination],
    queryFn: async () => {
      // Primero intentar obtener todos los viajes sin filtros complejos
      console.log(`[PackageTripSelection] Fetching all trips without complex filters`);
      
      const response = await fetch('/api/trips?optimizedResponse=false');
      if (!response.ok) {
        throw new Error(`Error fetching trips: ${response.status}`);
      }
      
      const allTrips = await response.json();
      console.log(`[PackageTripSelection] Received ${allTrips.length} trip segments`);
      
      // Filtrar en el frontend
      let filteredTrips = allTrips;
      
      // Filtrar por fecha si se especifica
      if (searchDate) {
        filteredTrips = filteredTrips.filter((trip: any) => {
          return trip.departureDate === searchDate;
        });
        console.log(`[PackageTripSelection] After date filter (${searchDate}): ${filteredTrips.length} trips`);
      }
      
      // Filtrar por origen si se especifica
      if (searchOrigin.trim()) {
        filteredTrips = filteredTrips.filter((trip: any) => {
          return trip.origin?.toLowerCase().includes(searchOrigin.toLowerCase());
        });
        console.log(`[PackageTripSelection] After origin filter (${searchOrigin}): ${filteredTrips.length} trips`);
      }
      
      // Filtrar por destino si se especifica
      if (searchDestination.trim()) {
        filteredTrips = filteredTrips.filter((trip: any) => {
          return trip.destination?.toLowerCase().includes(searchDestination.toLowerCase());
        });
        console.log(`[PackageTripSelection] After destination filter (${searchDestination}): ${filteredTrips.length} trips`);
      }
      
      return filteredTrips;
    },
    staleTime: 30000, // 30 segundos
  });

  // Procesar los viajes para crear segmentos individuales seleccionables
  const availableSegments = rawTrips.map((trip: any) => {
    return {
      id: trip.id, // Mantener el ID completo (ej: "28_1")
      baseId: trip.id.toString().split('_')[0], // ID base del viaje (ej: "28")
      segmentIndex: parseInt(trip.id.toString().split('_')[1]) || 0,
      origin: trip.origin,
      destination: trip.destination,
      departureDate: trip.departureDate,
      departureTime: trip.departureTime,
      arrivalTime: trip.arrivalTime,
      availableSeats: trip.availableSeats,
      tripId: trip.tripId || 0,
      isMainTrip: trip.isMainTrip || false,
      capacity: trip.capacity || 0,
      vehicleId: trip.vehicleId,
      driverId: trip.driverId,
      visibility: trip.visibility || 'publicado',
      routeId: trip.routeId,
      companyId: trip.companyId,
      route: trip.route
    };
  });

  // Formatear fecha para mostrar
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-MX', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  // Formatear hora
  const formatTime = (timeString: string) => {
    return timeString;
  };

  // Manejar selección de segmento individual
  const handleSegmentSelect = (segment: any) => {
    console.log(`[PackageTripSelection] Segment selected:`, segment);
    // Crear un objeto Trip compatible con el resto del sistema
    const tripForPackage: Trip = {
      id: segment.id,
      tripData: [{
        origin: segment.origin,
        destination: segment.destination,
        departureDate: segment.departureDate,
        departureTime: segment.departureTime,
        arrivalTime: segment.arrivalTime,
        price: 0, // No relevante para paqueterías
        availableSeats: segment.availableSeats,
        tripId: segment.tripId,
        isMainTrip: segment.isMainTrip
      }],
      capacity: segment.capacity,
      vehicleId: segment.vehicleId,
      driverId: segment.driverId,
      visibility: segment.visibility,
      routeId: segment.routeId,
      companyId: segment.companyId,
      route: segment.route
    };
    onTripSelect(tripForPackage);
  };

  // Manejar búsqueda
  const handleSearch = () => {
    console.log(`[PackageTripSelection] Searching with filters:`, {
      date: searchDate,
      origin: searchOrigin,
      destination: searchDestination
    });
    refetch();
  };

  // Limpiar filtros
  const clearFilters = () => {
    setSearchOrigin("");
    setSearchDestination("");
    // Mantener la fecha actual
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
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="search-origin">Origen (opcional)</Label>
              <Input
                id="search-origin"
                type="text"
                placeholder="Ciudad de origen..."
                value={searchOrigin}
                onChange={(e) => setSearchOrigin(e.target.value)}
                className="w-full"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="search-destination">Destino (opcional)</Label>
              <Input
                id="search-destination"
                type="text"
                placeholder="Ciudad de destino..."
                value={searchDestination}
                onChange={(e) => setSearchDestination(e.target.value)}
                className="w-full"
              />
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

      {/* Segments List */}
      {!isLoading && !error && (
        <div className="space-y-4">
          {availableSegments.length === 0 ? (
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
            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">
                {availableSegments.length} combinación{availableSegments.length !== 1 ? 'es' : ''} de viaje disponible{availableSegments.length !== 1 ? 's' : ''}
              </h3>
              {availableSegments.map((segment) => (
                <Card key={segment.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-center">
                      <div className="space-y-3 flex-1">
                        {/* Ruta del segmento */}
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <span className="font-medium text-lg">{segment.origin}</span>
                          <span className="text-muted-foreground text-lg">→</span>
                          <MapPin className="h-4 w-4 text-red-600" />
                          <span className="font-medium text-lg">{segment.destination}</span>
                          {segment.isMainTrip && (
                            <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded">
                              Principal
                            </span>
                          )}
                        </div>

                        {/* Fecha y horarios */}
                        <div className="flex items-center gap-4 text-sm text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-4 w-4" />
                            <span>{formatDate(segment.departureDate)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Clock className="h-4 w-4" />
                            <span>{formatTime(segment.departureTime)} - {formatTime(segment.arrivalTime)}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <Users className="h-4 w-4" />
                            <span>{segment.availableSeats} asientos disponibles</span>
                          </div>
                        </div>

                        {/* Información adicional del viaje */}
                        <div className="text-xs text-muted-foreground">
                          {segment.route?.name && `Ruta: ${segment.route.name}`}
                          {segment.capacity && ` • Capacidad total: ${segment.capacity} pasajeros`}
                        </div>
                      </div>

                      {/* Botón de selección */}
                      <Button 
                        onClick={() => handleSegmentSelect(segment)}
                        className="ml-4"
                      >
                        Seleccionar
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}