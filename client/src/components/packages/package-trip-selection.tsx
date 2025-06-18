import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock, MapPin, Users, ArrowLeft, Search } from "lucide-react";

interface Trip {
  id: string;
  tripData: Array<{
    origin: string;
    destination: string;
    departureDate: string;
    departureTime: string;
    price: number;
    availableSeats: number;
  }>;
  capacity: number;
  vehicleId?: number;
  driverId?: number;
  visibility: string;
  routeId?: number;
  companyId: string;
}

interface PackageTripSelectionProps {
  onTripSelect: (trip: Trip) => void;
  onBack: () => void;
}

export function PackageTripSelection({ onTripSelect, onBack }: PackageTripSelectionProps) {
  const [searchDate, setSearchDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  });
  
  const [searchOrigin, setSearchOrigin] = useState("");
  const [searchDestination, setSearchDestination] = useState("");

  // Fetch trips with filters
  const { data: trips = [], isLoading, error } = useQuery({
    queryKey: ["/api/trips", { 
      date: searchDate, 
      origin: searchOrigin || undefined,
      destination: searchDestination || undefined
    }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchDate) params.append("date", searchDate);
      if (searchOrigin) params.append("origin", searchOrigin);
      if (searchDestination) params.append("destination", searchDestination);

      const response = await fetch(`/api/trips?${params.toString()}`);
      if (!response.ok) {
        throw new Error("Error al cargar viajes");
      }
      return await response.json() as Trip[];
    },
  });

  const handleTripSelect = (trip: Trip) => {
    console.log("Viaje seleccionado:", trip);
    onTripSelect(trip);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (timeString: string) => {
    return timeString || "No especificada";
  };

  if (error) {
    return (
      <div className="space-y-4">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-red-600">
              Error al cargar los viajes. Por favor, intenta de nuevo.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Volver
        </Button>
        <div>
          <h2 className="text-2xl font-bold">Seleccionar Viaje</h2>
          <p className="text-muted-foreground">
            Elige el viaje donde enviarás el paquete
          </p>
        </div>
      </div>

      {/* Search Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Fecha</Label>
              <Input
                id="date"
                type="date"
                value={searchDate}
                onChange={(e) => setSearchDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="origin">Origen</Label>
              <Input
                id="origin"
                placeholder="Ciudad de origen..."
                value={searchOrigin}
                onChange={(e) => setSearchOrigin(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination">Destino</Label>
              <Input
                id="destination"
                placeholder="Ciudad de destino..."
                value={searchDestination}
                onChange={(e) => setSearchDestination(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-2">Cargando viajes...</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Trips List */}
      {!isLoading && (
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
            <div className="grid gap-4">
              <h3 className="text-lg font-semibold">
                {trips.length} viaje{trips.length !== 1 ? 's' : ''} disponible{trips.length !== 1 ? 's' : ''}
              </h3>
              {trips.map((trip) => (
                <Card key={trip.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="pt-6">
                    {trip.tripData.map((segment, index) => (
                      <div key={index} className="space-y-4">
                        {index > 0 && <hr className="my-4" />}
                        
                        <div className="flex justify-between items-start">
                          <div className="space-y-3 flex-1">
                            {/* Route */}
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-green-600" />
                              <span className="font-medium">{segment.origin}</span>
                              <span className="text-muted-foreground">→</span>
                              <MapPin className="h-4 w-4 text-red-600" />
                              <span className="font-medium">{segment.destination}</span>
                            </div>

                            {/* Date and Time */}
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              <div className="flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                <span>{formatDate(segment.departureDate)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-4 w-4" />
                                <span>{formatTime(segment.departureTime)}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Users className="h-4 w-4" />
                                <span>{segment.availableSeats} asientos disponibles</span>
                              </div>
                            </div>

                            {/* Price */}
                            <div className="text-2xl font-bold text-blue-600">
                              ${segment.price}
                            </div>
                          </div>

                          {/* Select Button */}
                          <Button 
                            onClick={() => handleTripSelect(trip)}
                            className="ml-4"
                          >
                            Seleccionar
                          </Button>
                        </div>
                      </div>
                    ))}
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