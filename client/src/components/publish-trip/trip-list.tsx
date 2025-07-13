import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  normalizeToStartOfDay, 
  isSameLocalDay, 
  formatDate, 
  formatDateForInput, 
  formatDateToLocal,
  getCurrentLocalDate
} from "@/lib/utils";
import { formatTripTime } from "@/lib/trip-utils";
import { 
  PencilIcon, 
  TrashIcon, 
  SearchIcon,
  CalendarIcon,
  FilterIcon,
  RefreshCcwIcon,
  MapPinIcon,
  ClockIcon,
  CheckCircleIcon,
  UsersIcon,
  CarIcon, 
  UserIcon,
  CheckIcon,
  Loader2Icon,
  XIcon,
  Archive as ArchiveIcon
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";

interface Trip {
  id: number;
  routeId: number;
  companyId: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime: string;
  capacity: number;
  availableSeats: number;
  price: number;
  vehicleId?: number | null; 
  driverId?: number | null;
  visibility?: string;
  routeName?: string;
  companyName?: string;
  assignedVehicle?: {
    id: number;
    model: string;
    plateNumber: string;
  };
  assignedDriver?: {
    id: number;
    firstName: string;
    lastName: string;
  };
}

type TripListProps = {
  onEditTrip: (tripId: number) => void;
  title?: string;
};

export default function TripList({ onEditTrip, title = "Publicación de Viajes" }: TripListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [tripToDelete, setTripToDelete] = useState<number | null>(null);
  
  // Estados para asignaciones
  const [assignVehicleDialogOpen, setAssignVehicleDialogOpen] = useState<number | null>(null);
  const [assignDriverDialogOpen, setAssignDriverDialogOpen] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<string | null>(null);
  const [selectedDriverId, setSelectedDriverId] = useState<string | null>(null);
  
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const formatTime = (time: string) => {
    try {
      if (!time) return "";
      
      if (time.includes("AM") || time.includes("PM")) {
        return time;
      }
      
      const [hours, minutes] = time.split(":").map(Number);
      if (isNaN(hours) || isNaN(minutes)) return time;
      
      const ampm = hours >= 12 ? "PM" : "AM";
      const hours12 = hours % 12 || 12;
      return `${hours12}:${minutes.toString().padStart(2, "0")} ${ampm}`;
    } catch (error) {
      console.error("Error formatting time:", error);
      return time;
    }
  };

  const formatDateHeader = (dateString: string) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      if (isSameLocalDay(date, today)) {
        return `Hoy ${format(date, 'd')} de ${format(date, 'MMMM', { locale: es })}`;
      }
      
      if (isSameLocalDay(date, tomorrow)) {
        return `Mañana ${format(date, 'd')} de ${format(date, 'MMMM', { locale: es })}`;
      }
      
      return `${format(date, 'd')} de ${format(date, 'MMMM', { locale: es })} de ${format(date, 'yyyy')}`;
    } catch (error) {
      console.error("Error formatting date:", error);
      return dateString;
    }
  };

  const getStopsCount = (trip: Trip) => {
    if (!trip.origin || !trip.destination) return 0;
    
    const originParts = trip.origin.split(" - ");
    const destinationParts = trip.destination.split(" - ");
    
    return Math.max(originParts.length, destinationParts.length);
  };

  // Queries para obtener datos
  const { data: trips = [], isLoading } = useQuery({
    queryKey: ['/api/trips', { 
      date: selectedDate ? formatDateToLocal(selectedDate) : getCurrentLocalDate(),
      isSubTrip: false // Solo obtenemos viajes principales
    }],
    enabled: !!selectedDate,
  });

  const { data: vehicles = [] } = useQuery({
    queryKey: ['/api/vehicles']
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ['/api/drivers']
  });

  const filteredTrips = trips.filter((trip: Trip) => {
    const searchLower = searchTerm.toLowerCase();
    return (
      trip.origin?.toLowerCase().includes(searchLower) ||
      trip.destination?.toLowerCase().includes(searchLower) ||
      trip.routeName?.toLowerCase().includes(searchLower)
    );
  });

  // Agrupar viajes por fecha
  const tripsByDate = useMemo(() => {
    const grouped: { [key: string]: Trip[] } = {};
    
    filteredTrips.forEach((trip: Trip) => {
      const tripDate = formatDateToLocal(trip.departureDate);
      if (!grouped[tripDate]) {
        grouped[tripDate] = [];
      }
      grouped[tripDate].push(trip);
    });
    
    return grouped;
  }, [filteredTrips]);

  // Mutations para operaciones CRUD
  const deleteTripMutation = useMutation({
    mutationFn: (tripId: number) => apiRequest(`/api/trips/${tripId}`, {
      method: 'DELETE',
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: "Viaje eliminado",
        description: "El viaje ha sido eliminado exitosamente."
      });
      setDeleteDialogOpen(false);
      setTripToDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Error al eliminar el viaje",
        variant: "destructive"
      });
    }
  });

  const assignVehicleMutation = useMutation({
    mutationFn: ({ tripId, vehicleId }: { tripId: number; vehicleId: number | null }) => 
      apiRequest(`/api/trips/${tripId}`, {
        method: 'PATCH',
        body: JSON.stringify({ vehicleId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: "Vehículo asignado",
        description: "El vehículo ha sido asignado exitosamente."
      });
      setAssignVehicleDialogOpen(null);
      setSelectedVehicleId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Error al asignar el vehículo",
        variant: "destructive"
      });
    }
  });

  const assignDriverMutation = useMutation({
    mutationFn: ({ tripId, driverId }: { tripId: number; driverId: number | null }) => 
      apiRequest(`/api/trips/${tripId}`, {
        method: 'PATCH',
        body: JSON.stringify({ driverId }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/trips'] });
      toast({
        title: "Conductor asignado",
        description: "El conductor ha sido asignado exitosamente."
      });
      setAssignDriverDialogOpen(null);
      setSelectedDriverId(null);
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message || "Error al asignar el conductor",
        variant: "destructive"
      });
    }
  });

  const handleDeleteClick = (tripId: number) => {
    setTripToDelete(tripId);
    setDeleteDialogOpen(true);
  };

  const confirmDelete = () => {
    if (tripToDelete) {
      deleteTripMutation.mutate(tripToDelete);
    }
  };

  const handleAssignVehicle = (tripId: number) => {
    setAssignVehicleDialogOpen(tripId);
    setSelectedVehicleId(null);
  };

  const handleAssignDriver = (tripId: number) => {
    setAssignDriverDialogOpen(tripId);
    setSelectedDriverId(null);
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex justify-center items-center h-64">
            <Loader2Icon className="h-8 w-8 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ArchiveIcon className="h-5 w-5" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Controles de filtros */}
        <div className="flex flex-col lg:flex-row gap-4 mb-6">
          <div className="flex-1 relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por origen, destino o ruta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          
          <div className="flex gap-2">
            <Popover open={isDatePickerOpen} onOpenChange={setIsDatePickerOpen}>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm">
                  <CalendarIcon className="h-4 w-4 mr-2" />
                  {selectedDate ? format(selectedDate, 'dd/MM/yyyy') : 'Fecha'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => {
                    setSelectedDate(date);
                    setIsDatePickerOpen(false);
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSelectedDate(new Date())}
            >
              Hoy
            </Button>
          </div>
        </div>

        {/* Contenido de viajes */}
        <div className="space-y-6 mb-10">
          {Object.entries(tripsByDate).length === 0 ? (
            <div className="text-center py-10">
              <div className="text-muted-foreground">
                No hay viajes disponibles para la fecha seleccionada.
              </div>
            </div>
          ) : (
            Object.entries(tripsByDate)
              .sort(([dateKeyA], [dateKeyB]) => {
                const dateA = new Date(dateKeyA);
                const dateB = new Date(dateKeyB);
                return dateA.getTime() - dateB.getTime();
              })
              .map(([dateKey, trips]) => (
                <div key={dateKey} className="space-y-4 border-b pb-6 mb-6 last:border-0">
                  <div>
                    <h4 className="text-base font-medium">{formatDateHeader(dateKey)}</h4>
                  </div>
                  
                  <div className="space-y-4">
                    {trips.map((trip: Trip) => {
                      return (
                        <div key={trip.id} className="border rounded-lg overflow-hidden bg-card">
                          <div className="flex flex-col lg:flex-row">
                            <div className="p-4 lg:p-6 flex-1">
                              <div className="flex justify-between items-start mb-4">
                                <div className="flex">
                                  <div>
                                    <div className="flex items-center text-sm text-muted-foreground mb-2">
                                      <ClockIcon className="h-4 w-4 mr-1" />
                                      <span>{formatTime(trip.departureTime)} - {formatTime(trip.arrivalTime)}</span>
                                      <span className="ml-4 text-blue-600">
                                        {formatDate(trip.departureDate)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="flex items-center gap-2">
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => onEditTrip(trip.id)}
                                    className="h-8 w-8"
                                    title="Editar viaje"
                                  >
                                    <PencilIcon className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => handleDeleteClick(trip.id)}
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    title="Eliminar viaje"
                                  >
                                    <TrashIcon className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                                {/* Ruta */}
                                <div className="bg-muted/50 p-3 rounded-md">
                                  <div className="flex items-start">
                                    <MapPinIcon className="h-5 w-5 mr-2 text-primary shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-sm font-medium">Ruta</p>
                                      <p className="text-xs text-muted-foreground">
                                        Terminal {trip.origin?.split(' - ')[1] || ''} → {trip.destination?.split(' - ')[1] || ''}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Vehículo */}
                                <div className="bg-muted/50 p-3 rounded-md">
                                  <div className="flex items-start">
                                    <CarIcon className="h-5 w-5 mr-2 text-primary shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-sm font-medium">Vehículo</p>
                                      {trip.vehicleId || trip.assignedVehicle ? (
                                        <p className="text-xs text-green-600 font-medium">
                                          {trip.assignedVehicle ? 
                                            `${trip.assignedVehicle.model} - ${trip.assignedVehicle.plateNumber}` :
                                            `${vehicles.find((v: any) => v.id === trip.vehicleId)?.brand || ''} ${vehicles.find((v: any) => v.id === trip.vehicleId)?.model || ''} - ${vehicles.find((v: any) => v.id === trip.vehicleId)?.plates || ''}`
                                          }
                                        </p>
                                      ) : (
                                        <p className="text-xs text-red-500 font-medium">No asignado</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                
                                {/* Conductor */}
                                <div className="bg-muted/50 p-3 rounded-md">
                                  <div className="flex items-start">
                                    <UserIcon className="h-5 w-5 mr-2 text-primary shrink-0 mt-0.5" />
                                    <div>
                                      <p className="text-sm font-medium">Conductor</p>
                                      {trip.driverId || trip.assignedDriver ? (
                                        <p className="text-xs text-green-600 font-medium">
                                          {trip.assignedDriver ? 
                                            `${trip.assignedDriver.firstName} ${trip.assignedDriver.lastName}` :
                                            `${drivers.find((d: any) => d.id === trip.driverId)?.firstName || ''} ${drivers.find((d: any) => d.id === trip.driverId)?.lastName || ''}`
                                          }
                                        </p>
                                      ) : (
                                        <p className="text-xs text-red-500 font-medium">No asignado</p>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Estados del viaje */}
                              <div className="mt-4 pt-4 border-t border-gray-100">
                                <div className="flex flex-wrap items-center justify-between">
                                  <div className="flex gap-2 mb-2">
                                    {/* Estado de visibilidad */}
                                    {trip.visibility && (
                                      <span className={`text-xs px-2 py-1 rounded-full ${
                                        trip.visibility === 'publicado' 
                                          ? 'bg-green-100 text-green-800' 
                                          : trip.visibility === 'oculto' 
                                            ? 'bg-gray-100 text-gray-800' 
                                            : 'bg-red-100 text-red-800'
                                      }`}>
                                        {trip.visibility === 'publicado' 
                                          ? 'Publicado' 
                                          : trip.visibility === 'oculto' 
                                            ? 'Oculto' 
                                            : 'Cancelado'}
                                      </span>
                                    )}
                                    
                                    {/* Capacidad */}
                                    <span className="text-xs px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                                      Capacidad: {trip.capacity || 0}
                                    </span>
                                  </div>
                                  
                                  {/* Información de asientos */}
                                  <div className="flex items-center">
                                    <UsersIcon className="h-4 w-4 mr-1 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {trip.availableSeats}/{trip.capacity} asientos
                                    </span>
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))
          )}
        </div>
      </CardContent>

      {/* Diálogo de asignación de vehículo */}
      <AlertDialog open={assignVehicleDialogOpen !== null} onOpenChange={(open) => !open && setAssignVehicleDialogOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Asignar Vehículo</AlertDialogTitle>
            <AlertDialogDescription>
              Seleccione el vehículo que desea asignar a este viaje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={selectedVehicleId || ""} onValueChange={setSelectedVehicleId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar vehículo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sin vehículo asignado</SelectItem>
                {vehicles.map((vehicle: any) => (
                  <SelectItem key={vehicle.id} value={vehicle.id.toString()}>
                    {vehicle.brand} {vehicle.model} - {vehicle.plates}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (assignVehicleDialogOpen !== null && selectedVehicleId !== null) {
                  assignVehicleMutation.mutate({
                    tripId: assignVehicleDialogOpen,
                    vehicleId: selectedVehicleId === "0" ? null : parseInt(selectedVehicleId)
                  });
                }
              }}
              disabled={selectedVehicleId === null || assignVehicleMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {assignVehicleMutation.isPending ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Asignando...
                </>
              ) : (
                "Asignar Vehículo"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de asignación de conductor */}
      <AlertDialog open={assignDriverDialogOpen !== null} onOpenChange={(open) => !open && setAssignDriverDialogOpen(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Asignar Conductor</AlertDialogTitle>
            <AlertDialogDescription>
              Seleccione el conductor que desea asignar a este viaje.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4">
            <Select value={selectedDriverId || ""} onValueChange={setSelectedDriverId}>
              <SelectTrigger>
                <SelectValue placeholder="Seleccionar conductor" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Sin conductor asignado</SelectItem>
                {drivers.map((driver: any) => (
                  <SelectItem key={driver.id} value={driver.id.toString()}>
                    {driver.firstName} {driver.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (assignDriverDialogOpen !== null && selectedDriverId) {
                  assignDriverMutation.mutate({
                    tripId: assignDriverDialogOpen,
                    driverId: parseInt(selectedDriverId)
                  });
                }
              }}
              disabled={!selectedDriverId || assignDriverMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {assignDriverMutation.isPending ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Asignando...
                </>
              ) : (
                "Asignar Conductor"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Diálogo de confirmación para eliminar viaje */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar viaje?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. El viaje será eliminado permanentemente
              junto con todas sus reservaciones asociadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              disabled={deleteTripMutation.isPending}
              className="bg-destructive hover:bg-destructive/90"
            >
              {deleteTripMutation.isPending ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Eliminando...
                </>
              ) : (
                "Eliminar viaje"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}