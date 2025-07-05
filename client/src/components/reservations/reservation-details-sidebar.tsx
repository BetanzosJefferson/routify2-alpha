import { useState, useEffect, useRef } from "react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { 
  CalendarIcon, 
  Users, 
  Calendar,
  Clock,
  Bus,
  User,
  X,
  Search,
  Phone,
  DollarSign,
  MapPin,
  CheckIcon,
  ClipboardCopy, 
  LockIcon,
  Calculator,
  PlusCircle,
  Trash2,
  Loader2
  
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input"; 
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { formatDate, formatPrice, formatTime } from "@/lib/utils";
import { ReservationWithDetails } from "@shared/schema";
import { usePackagesByTrip } from "@/hooks/use-packages-by-trip";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

type Expense = {
  id: number | string;
  tripId: number;
  amount: number;
  type: string;
  description?: string;
  createdAt?: Date;
  userId?: number;
  createdBy?: string;
};

interface ReservationDetailsSidebarProps {
  recordId: string;
  tripInfo: any;
  reservations: ReservationWithDetails[];
  onClose: () => void;
}

export function ReservationDetailsSidebar({ 
  recordId, 
  tripInfo, 
  reservations, 
  onClose 
}: ReservationDetailsSidebarProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const sidebarRef = useRef<HTMLDivElement>(null);
  
  // Estados para presupuesto y gastos (solo para chofer)
  const [budget, setBudget] = useState<number>(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState<Expense>({
    id: '',
    tripId: 0, // Se actualizará con el ID real del viaje
    amount: 0,
    type: '',
    description: ''
  });
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isRemovingExpense, setIsRemovingExpense] = useState<number | null>(null);
  
  // Hooks
  const { user } = useAuth();
  const { toast } = useToast();

  // Verificar si el usuario es chofer
  const isDriver = user?.role === 'chofer';
  
  console.log('[ReservationDetailsSidebar] Debug - user:', user, 'isDriver:', isDriver);

  // Funciones para manejo de presupuesto y gastos
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const getTripId = () => {
    // Obtener el ID del viaje desde las reservaciones
    if (reservations.length > 0) {
      const firstReservation = reservations[0];
      
      // Primero intentar desde trip.id y extraer la parte base
      if (firstReservation.trip?.id) {
        const tripId = firstReservation.trip.id;
        // Si es un string con formato "33_2", extraer solo la parte base "33"
        if (typeof tripId === 'string' && tripId.includes('_')) {
          const parts = tripId.split('_');
          const baseId = parseInt(parts[0], 10);
          console.log('[getTripId] Extrayendo ID base de trip.id:', tripId, '-> ID base:', baseId);
          if (!isNaN(baseId)) {
            return baseId;
          }
        }
        // Si es un número, usarlo directamente
        if (typeof tripId === 'number') {
          console.log('[getTripId] Usando trip.id numérico:', tripId);
          return tripId;
        }
        // Si es un string sin "_", intentar convertir a número
        if (typeof tripId === 'string') {
          const numericId = parseInt(tripId, 10);
          if (!isNaN(numericId)) {
            console.log('[getTripId] Convirtiendo string a número:', tripId, '-> ID:', numericId);
            return numericId;
          }
        }
      }
      
      // Extraer desde tripId si está disponible
      const tripDetails = firstReservation.tripDetails as any;
      if (tripDetails?.tripId) {
        const parts = tripDetails.tripId.split('_');
        const numericId = parseInt(parts[0], 10);
        console.log('[getTripId] Extrayendo de tripDetails.tripId:', tripDetails.tripId, '-> ID:', numericId);
        if (!isNaN(numericId)) {
          return numericId;
        }
      }
      
      console.log('[getTripId] No se pudo extraer ID del viaje. Datos disponibles:', {
        tripId: firstReservation.trip?.id,
        tripDetails: tripDetails?.tripId,
        reservation: firstReservation
      });
    }
    return null;
  };

  const loadBudgetAndExpenses = async () => {
    if (!isDriver) return;
    
    const tripId = getTripId();
    if (!tripId) {
      console.log('[loadBudgetAndExpenses] No se pudo obtener el ID del viaje para cargar presupuesto');
      return;
    }
    
    console.log('[loadBudgetAndExpenses] Iniciando carga de presupuesto y gastos para viaje:', tripId);
    setIsLoadingBudget(true);
    try {
      // Cargar presupuesto del viaje usando el ID numérico
      console.log('[loadBudgetAndExpenses] Haciendo fetch a:', `/api/trips/${tripId}/budget`);
      const budgetResponse = await fetch(`/api/trips/${tripId}/budget`);
      console.log('[loadBudgetAndExpenses] Budget response status:', budgetResponse.status);
      if (budgetResponse.ok) {
        const budgetData = await budgetResponse.json();
        console.log('[loadBudgetAndExpenses] Budget data recibida:', budgetData);
        setBudget(budgetData.amount || 0);
      }

      // Cargar gastos del viaje usando el ID numérico
      console.log('[loadBudgetAndExpenses] Haciendo fetch a:', `/api/trips/${tripId}/expenses`);
      const expensesResponse = await fetch(`/api/trips/${tripId}/expenses`);
      console.log('[loadBudgetAndExpenses] Expenses response status:', expensesResponse.status);
      if (expensesResponse.ok) {
        const expensesData = await expensesResponse.json();
        console.log('[loadBudgetAndExpenses] Expenses data recibida:', expensesData);
        setExpenses(expensesData || []);
      }
    } catch (error) {
      console.error('[loadBudgetAndExpenses] Error loading budget and expenses:', error);
    } finally {
      setIsLoadingBudget(false);
    }
  };

  const addExpense = async () => {
    if (!newExpense.amount || !newExpense.type) return;

    const tripId = getTripId();
    if (!tripId) {
      toast({
        title: "Error",
        description: "No se pudo identificar el viaje para agregar el gasto.",
        variant: "destructive",
      });
      return;
    }

    setIsAddingExpense(true);
    try {
      const response = await fetch(`/api/trips/${tripId}/expenses`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          amount: newExpense.amount,
          type: newExpense.type,
          description: newExpense.description
        }),
      });

      if (response.ok) {
        const expense = await response.json();
        setExpenses(prev => [...prev, expense]);
        setNewExpense({
          id: '',
          tripId: 0,
          amount: 0,
          type: '',
          description: ''
        });
        toast({
          title: "Gasto agregado",
          description: "El gasto se ha registrado correctamente.",
        });
      } else {
        throw new Error('Error al agregar gasto');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo agregar el gasto. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsAddingExpense(false);
    }
  };

  const removeExpense = async (expenseId: number) => {
    const tripId = getTripId();
    if (!tripId) {
      toast({
        title: "Error",
        description: "No se pudo identificar el viaje para eliminar el gasto.",
        variant: "destructive",
      });
      return;
    }

    setIsRemovingExpense(expenseId);
    try {
      const response = await fetch(`/api/trips/${tripId}/expenses/${expenseId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setExpenses(prev => prev.filter(expense => expense.id !== expenseId));
        toast({
          title: "Gasto eliminado",
          description: "El gasto se ha eliminado correctamente.",
        });
      } else {
        throw new Error('Error al eliminar gasto');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo eliminar el gasto. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setIsRemovingExpense(null);
    }
  };

  // Cargar datos al montar el componente si es chofer
  useEffect(() => {
    console.log('[useEffect] Checking conditions - isDriver:', isDriver, 'reservations.length:', reservations.length);
    if (isDriver && reservations.length > 0) {
      console.log('[useEffect] Calling loadBudgetAndExpenses()');
      loadBudgetAndExpenses();
    }
  }, [isDriver, reservations.length, reservations]);

  // Obtener paqueterías relacionadas al viaje
  const { 
    data: packages = [], 
    isLoading: isLoadingPackages,
    error: packagesError 
  } = usePackagesByTrip({
    recordId,
    tripInfo,
    enabled: true
  });

  // Efecto para detectar clics fuera del sidebar
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (sidebarRef.current && !sidebarRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  // Función para obtener el índice de la parada desde el tripId
  const getStopIndexFromTripId = (reservation: ReservationWithDetails) => {
    const tripDetails = reservation.tripDetails;
    if (typeof tripDetails === 'object' && tripDetails !== null && 'tripId' in tripDetails) {
      const tripId = (tripDetails as any).tripId;
      if (typeof tripId === 'string' && tripId.includes('_')) {
        // Extraer el índice del tripId (formato: recordId_index)
        const parts = tripId.split('_');
        const index = parseInt(parts[parts.length - 1], 10);
        
        console.log(`[DEBUG] Reservación ${reservation.id}:`, {
          tripId,
          extractedIndex: index,
          isValidIndex: !isNaN(index)
        });
        
        return !isNaN(index) ? index : 0;
      }
    }
    
    console.log(`[DEBUG] Sin tripId válido para reservación ${reservation.id}:`, { tripDetails });
    return 0;
  };

  // Filtrar y ordenar reservaciones
  const filteredReservations = reservations
    .filter(reservation => {
      if (!searchQuery) return true;
      
      const searchLower = searchQuery.toLowerCase();
      
      // Filtro especial para estado de check
      if (searchLower.includes('check')) {
        const isCheckSearch = searchLower.match(/^check$/i);
        const isNoCheckSearch = searchLower.match(/^(no\s*check|no-check)$/i);
        
        if (isCheckSearch) {
          // Mostrar solo reservaciones con check
          return !!reservation.checkedBy;
        }
        
        if (isNoCheckSearch) {
          // Mostrar solo reservaciones sin check
          return !reservation.checkedBy;
        }
      }
      
      // Búsqueda normal por otros campos
      return (
        reservation.id.toString().includes(searchLower) ||
        reservation.phone.toLowerCase().includes(searchLower) ||
        reservation.email?.toLowerCase().includes(searchLower) ||
        reservation.createdByUser?.firstName?.toLowerCase().includes(searchLower) ||
        reservation.createdByUser?.lastName?.toLowerCase().includes(searchLower)
      );
    })
    .sort((a, b) => {
      // Ordenar por índice cronológico (por ahora sin ordenamiento por check)
      const indexA = getStopIndexFromTripId(a);
      const indexB = getStopIndexFromTripId(b);
      return indexA - indexB;
    });



  const totalPassengers = reservations.reduce((total, reservation) => {
    const tripDetails = reservation.tripDetails as any;
    return total + (tripDetails?.seats || 1);
  }, 0);

  return (
    <div 
      ref={sidebarRef}
      className="fixed inset-y-0 right-0 w-full md:w-[500px] lg:w-[550px] bg-white shadow-2xl overflow-y-auto transition-all duration-300 ease-in-out z-50 border-l border-gray-200 max-w-[95%]"
      style={{ 
        boxShadow: "-10px 0 15px -3px rgba(0, 0, 0, 0.1), -4px 0 6px -2px rgba(0, 0, 0, 0.05)",
      }}
    >
      <div className="flex justify-between items-center p-4 md:p-5 border-b sticky top-0 bg-white z-10">
        <h2 className="text-lg md:text-xl font-semibold text-gray-800">Lista de Reservaciones</h2>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-gray-100">
          <X className="h-5 w-5" />
        </Button>
      </div>
      
      <div className="p-4 md:p-6">
        {/* Información del viaje */}
        <div className="mb-4 md:mb-6 bg-white p-3 md:p-5 rounded-xl border border-gray-100 shadow-sm">
          <h3 className="text-lg md:text-xl font-semibold mb-1">
            {tripInfo ? `${tripInfo.origin} - ${tripInfo.destination}` : `Viaje ${recordId}`}
          </h3>
          <p className="text-gray-600 font-medium mb-3 text-sm md:text-base">
            {tripInfo ? 
              `${tripInfo.origin} → ${tripInfo.destination}` :
              `Información del viaje ${recordId}`
            }
          </p>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-4 mb-4">
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-blue-100 p-2 mr-3">
                <Calendar className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Fecha</p>
                <p className="font-semibold text-sm">
                  {tripInfo?.departureDate ? formatDate(tripInfo.departureDate) : 'N/A'}
                </p>
              </div>
            </div>
            
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-purple-100 p-2 mr-3">
                <Clock className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Horario</p>
                <p className="font-semibold text-sm">10:00 AM - 03:00 PM</p>
              </div>
            </div>
            
            <div className="flex items-center bg-gray-50 p-3 rounded-lg">
              <div className="rounded-full bg-green-100 p-2 mr-3">
                <Bus className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Vehículo</p>
                <p className="font-semibold text-sm">Sin Unidad Asignada</p>
              </div>
            </div>
          </div>
          
          <div className="flex items-center bg-blue-50 p-4 rounded-lg">
            <div className="rounded-full bg-blue-100 p-2 mr-3">
              <Users className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total de pasajeros</p>
              <p className="text-2xl font-bold text-blue-700">{totalPassengers}</p>
            </div>
          </div>
        </div>

        {/* Barra de búsqueda */}
        <div className="mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Buscar por nombre, número, origen, destino o email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Lista de reservaciones */}
        <div className="space-y-3 md:space-y-4">
          <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4">Lista de Reservaciones</h3>
          
          {filteredReservations.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              {searchQuery ? 'No se encontraron reservaciones que coincidan con la búsqueda.' : 'No hay reservaciones para este viaje.'}
            </div>
          ) : (
            filteredReservations.map((reservation) => {
              const tripDetails = reservation.tripDetails as any;
              const passengerCount = tripDetails?.seats || 1;
              
              return (
                <Card key={reservation.id} className="border border-gray-200 rounded-xl overflow-hidden shadow-sm bg-white hover:shadow-md transition-shadow">
                  {/* Equivalente a CardHeader con las clases del diseño original */}
                  <CardHeader className="border-b border-gray-100 bg-gray-50 px-3 md:px-4 py-2 md:py-2.5">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0 mb-1.5"> {/* Este div es clave para el layout superior */}
                      <div className="flex items-center w-full sm:w-auto"> {/* Agrupamiento para cantidad de asientos y datos del pasajero principal */}
                        <div className="bg-primary/10 text-primary font-medium px-2 md:px-3 py-1 rounded-md mr-2 md:mr-3 text-xs md:text-sm">
                          {passengerCount} asiento{passengerCount !== 1 ? 's' : ''}
                        </div>
                        <div className="min-w-0 flex-1 sm:flex-none"> {/* Contenedor para el nombre del pasajero principal y código */}
                          <div className="font-medium text-sm md:text-base truncate">
                            {reservation.passengers && reservation.passengers.length === 1
                              ? reservation.passengers[0]?.firstName + ' ' + reservation.passengers[0]?.lastName
                              : `${reservation.passengers[0]?.firstName || 'nombre'} ${reservation.passengers[0]?.lastName || 'del pasajero'}`}
                          </div>
                          <div className="text-xs text-gray-500">#{reservation.id}</div>
                        </div>
                      </div>
                      <div className="w-full sm:w-auto flex justify-between sm:block"> {/* Sección de precios y por cobrar */}
                        {/* Indicador de Check basado en checkCount */}
                        <div className="flex sm:hidden mb-2">
                          {reservation.checkCount && reservation.checkCount > 0 ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                              <CheckIcon className="h-3 w-3 mr-1" />
                              Check
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              <X className="h-3 w-3 mr-1" />
                              No check
                            </span>
                          )}
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-700 mb-1">
                            Anticipo: {formatPrice(reservation.advanceAmount || 0)} ({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                          </div>

                          {/* Mostrar "Pagó" solamente si está marcado como pagado */}
                          {reservation.paymentStatus === 'pagado' && (reservation.advanceAmount || 0) < reservation.totalAmount && (
                            <div className="text-xs text-gray-700 mb-1">
                              Pagó: {formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))} ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                            </div>
                          )}

                          <div className="flex items-center">
                            <span className="text-sm font-medium mr-2">Por cobrar</span>
                            <span className="text-lg font-bold text-primary">
                              {reservation.paymentStatus === 'pagado'
                                ? '$ 0'
                                : `$ ${(reservation.totalAmount - (reservation.advanceAmount || 0)).toFixed(0)}`
                              }
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Equivalente a CardContent con las clases del diseño original */}
                  <CardContent className="p-3 md:p-4"> {/* Aseguramos el padding adecuado */}
                    {/* Indicador de Check para pantallas más grandes */}
                    <div className="hidden sm:flex mb-3">
                      {reservation.checkCount && reservation.checkCount > 0 ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                          <CheckIcon className="h-3 w-3 mr-1" />
                          Check
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                          <X className="h-3 w-3 mr-1" />
                          No check
                        </span>
                      )}
                    </div>

                    {/* Datos de pasajeros (si hay más de uno) */}
                    <div className="mb-3">
                      <div className="text-xs md:text-sm font-medium text-gray-800">
                        {reservation.passengers.length > 1
                          ? (
                            <>
                              <div className="mb-1">
                                {reservation.passengers.map((passenger, idx) => (
                                  <div key={idx} className="text-xs md:text-sm">
                                    {passenger.firstName} {passenger.lastName}
                                  </div>
                                ))}
                              </div>
                            </>
                          )
                          : null}
                      </div>
                    </div>

                    {/* Origen y destino específicos del segmento */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                      <div>
                        <div className="text-xs text-gray-500">Origen</div>
                        <div className="font-medium">
                          {(() => {
                            // Usar información específica del segmento si está disponible
                            if (reservation.trip?.origin && reservation.trip?.destination) {
                              return reservation.trip.origin;
                            }
                            // Fallback al viaje padre
                            return reservation.trip?.route?.origin || 'Origen';
                          })()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Destino</div>
                        <div className="font-medium">
                          {(() => {
                            // Usar información específica del segmento si está disponible
                            if (reservation.trip?.origin && reservation.trip?.destination) {
                              return reservation.trip.destination;
                            }
                            // Fallback al viaje padre
                            return reservation.trip?.route?.destination || 'Destino';
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Teléfono de contacto con botón para copiar */}
                    {reservation.phone && (
                      <div className="text-sm mb-3">
                        <div className="text-xs text-gray-500">Contacto</div>
                        <div className="font-medium flex items-center">
                          <Phone className="h-3 w-3 mr-1 text-gray-500" />
                          <a href={`tel:${reservation.phone}`} className="text-primary hover:underline">
                            {reservation.phone}
                          </a>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(reservation.phone || '');
                            }}
                            className="ml-2 p-1 rounded-sm hover:bg-gray-100"
                            title="Copiar al portapapeles"
                          >
                            <ClipboardCopy className="h-3.5 w-3.5 text-gray-500" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Notas de la reservación */}
                    {reservation.notes && (
                      <div className="text-sm mb-3">
                        <div className="text-xs text-gray-500">Notas</div>
                        <div className="font-medium p-1.5 bg-gray-50 rounded-sm border border-gray-100 text-gray-700 text-xs">
                          {reservation.notes}
                        </div>
                      </div>
                    )}

                    {/* Información de pago simplificada */}
                    <div className="mt-3">
                      <Badge
                        variant="outline"
                        className={reservation.paymentStatus === 'pagado'
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-yellow-100 text-yellow-800 border-yellow-200'}
                      >
                        {reservation.paymentStatus === 'pagado' ? 'PAGADO' : 'PENDIENTE'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>

        {/* Sección de Paqueterías */}
        <div className="space-y-3 md:space-y-4 mt-6 md:mt-8">
          <h3 className="text-base md:text-lg font-semibold text-gray-800 mb-3 md:mb-4 flex items-center gap-2">
            <div className="rounded-full bg-orange-100 p-1.5 md:p-2">
              <div className="h-3 w-3 md:h-4 md:w-4 bg-orange-600 rounded-sm"></div>
            </div>
            Paqueterías ({packages.length})
          </h3>
          
          {isLoadingPackages ? (
            <div className="text-center py-4 text-gray-500">
              Cargando paqueterías...
            </div>
          ) : packagesError ? (
            <div className="text-center py-4 text-red-500">
              Error al cargar paqueterías
            </div>
          ) : packages.length === 0 ? (
            <div className="text-center py-4 text-gray-500">
              No hay paqueterías para este viaje.
            </div>
          ) : (
            packages.map((pkg: any) => (
              <Card key={pkg.id} className="border border-orange-200 rounded-xl overflow-hidden shadow-sm bg-orange-50 hover:shadow-md transition-shadow">
                <CardHeader className="border-b border-orange-100 bg-orange-100 px-3 md:px-4 py-2 md:py-2.5">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 sm:gap-0">
                    <div className="flex items-center w-full sm:w-auto">
                      <div className="bg-orange-200 text-orange-800 font-medium px-2 md:px-3 py-1 rounded-md mr-2 md:mr-3 text-xs md:text-sm">
                        Paquete #{pkg.id}
                      </div>
                      <div className="min-w-0 flex-1 sm:flex-none">
                        <div className="font-medium text-sm md:text-base truncate">
                          {pkg.senderName} {pkg.senderLastName}
                        </div>
                        <div className="text-xs text-gray-600 truncate">
                          → {pkg.recipientName} {pkg.recipientLastName}
                        </div>
                      </div>
                    </div>
                    <div className="text-right w-full sm:w-auto flex justify-between sm:block">
                      <div className="text-base md:text-lg font-bold text-orange-700">
                        {formatPrice(pkg.price)}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-xs ${pkg.isPaid
                          ? 'bg-green-100 text-green-800 border-green-200'
                          : 'bg-yellow-100 text-yellow-800 border-yellow-200'}`}
                      >
                        {pkg.isPaid ? 'PAGADO' : 'PENDIENTE'}
                      </Badge>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="p-3 md:p-4">
                  {/* Descripción del paquete */}
                  <div className="mb-3">
                    <div className="text-xs md:text-sm font-medium text-gray-800">
                      Descripción: {pkg.packageDescription || 'Sin descripción'}
                    </div>
                  </div>

                  {/* Origen y destino específicos del paquete */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm mb-3">
                    <div>
                      <div className="text-xs text-gray-500">Origen</div>
                      <div className="font-medium text-xs md:text-sm break-words">
                        {pkg.tripDetails?.origin || pkg.tripOrigin || 'No especificado'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Destino</div>
                      <div className="font-medium text-xs md:text-sm break-words">
                        {pkg.tripDetails?.destination || pkg.tripDestination || 'No especificado'}
                      </div>
                    </div>
                  </div>

                  {/* Información de contacto */}
                  <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-2 sm:space-y-0 text-sm mb-3">
                    <div>
                      <div className="text-xs text-gray-500">Remitente</div>
                      <div className="font-medium flex items-center">
                        <Phone className="h-3 w-3 mr-1 text-gray-500 flex-shrink-0" />
                        <a href={`tel:${pkg.senderPhone}`} className="text-orange-600 hover:underline text-xs md:text-sm truncate">
                          {pkg.senderPhone}
                        </a>
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Destinatario</div>
                      <div className="font-medium flex items-center">
                        <Phone className="h-3 w-3 mr-1 text-gray-500 flex-shrink-0" />
                        <a href={`tel:${pkg.recipientPhone}`} className="text-orange-600 hover:underline text-xs md:text-sm truncate">
                          {pkg.recipientPhone}
                        </a>
                      </div>
                    </div>
                  </div>

                  {/* Estado de entrega y asientos */}
                  <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 text-sm">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Estado de entrega</div>
                      <Badge variant={pkg.deliveryStatus === 'entregado' ? 'default' : 'secondary'} className="text-xs">
                        {pkg.deliveryStatus === 'entregado' ? 'Entregado' : 'Pendiente'}
                      </Badge>
                    </div>
                    {pkg.usesSeats && (
                      <div>
                        <div className="text-xs text-gray-500">Asientos ocupados</div>
                        <div className="font-medium text-xs md:text-sm">{pkg.seatsQuantity || 0}</div>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* Sección de Presupuesto y Gastos - Solo para Choferes */}
        {isDriver && (
          <div className="space-y-4 mt-8">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <div className="rounded-full bg-blue-100 p-2">
                <Calculator className="h-4 w-4 text-blue-600" />
              </div>
              Presupuesto y Gastos
            </h3>

            {isLoadingBudget ? (
              <div className="text-center py-4 text-gray-500 flex items-center justify-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Cargando información financiera...
              </div>
            ) : (
              <>
                {/* Resumen financiero */}
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <Card className="border border-blue-200 bg-blue-50">
                    <CardContent className="p-4 text-center">
                      <div className="text-sm text-blue-600 font-medium">Presupuesto Asignado</div>
                      <div className="text-xl font-bold text-blue-800">
                        {formatCurrency(budget)}
                      </div>
                    </CardContent>
                  </Card>
                  
                  <Card className="border border-red-200 bg-red-50">
                    <CardContent className="p-4 text-center">
                      <div className="text-sm text-red-600 font-medium">Gastos Totales</div>
                      <div className="text-xl font-bold text-red-800">
                        {formatCurrency(expenses.reduce((sum, expense) => sum + expense.amount, 0))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Formulario para agregar gasto */}
                <Card className="border border-gray-200 bg-gray-50">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-sm font-medium text-gray-700 flex items-center gap-2">
                      <PlusCircle className="h-4 w-4" />
                      Agregar Nuevo Gasto
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="expense-amount" className="text-xs font-medium text-gray-600">
                          Monto
                        </Label>
                        <Input
                          id="expense-amount"
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0.00"
                          value={newExpense.amount || ''}
                          onChange={(e) => setNewExpense(prev => ({
                            ...prev,
                            amount: parseFloat(e.target.value) || 0
                          }))}
                          className="text-sm"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="expense-type" className="text-xs font-medium text-gray-600">
                          Categoría
                        </Label>
                        <select
                          id="expense-type"
                          value={newExpense.type}
                          onChange={(e) => setNewExpense(prev => ({
                            ...prev,
                            type: e.target.value
                          }))}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                          <option value="">Seleccionar categoría</option>
                          <option value="Gasolina">Gasolina</option>
                          <option value="Casetas">Casetas</option>
                          <option value="Otros">Otros</option>
                        </select>
                      </div>
                    </div>
                    
                    <div>
                      <Label htmlFor="expense-description" className="text-xs font-medium text-gray-600">
                        Descripción (opcional)
                      </Label>
                      <Input
                        id="expense-description"
                        placeholder="Descripción del gasto..."
                        value={newExpense.description || ''}
                        onChange={(e) => setNewExpense(prev => ({
                          ...prev,
                          description: e.target.value
                        }))}
                        className="text-sm"
                      />
                    </div>
                    
                    <Button
                      onClick={addExpense}
                      disabled={!newExpense.amount || !newExpense.type || isAddingExpense}
                      className="w-full"
                      size="sm"
                    >
                      {isAddingExpense ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Agregando...
                        </>
                      ) : (
                        <>
                          <PlusCircle className="h-4 w-4 mr-2" />
                          Agregar Gasto
                        </>
                      )}
                    </Button>
                  </CardContent>
                </Card>

                {/* Lista de gastos */}
                {expenses.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-sm font-medium text-gray-700">Lista de Gastos</h4>
                    {expenses.map((expense) => (
                      <Card key={expense.id} className="border border-gray-200">
                        <CardContent className="p-3">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <Badge variant="outline" className="text-xs">
                                  {expense.type}
                                </Badge>
                                <span className="text-sm font-medium">
                                  {formatCurrency(expense.amount)}
                                </span>
                              </div>
                              {expense.description && (
                                <p className="text-xs text-gray-600">{expense.description}</p>
                              )}
                              {expense.createdAt && (
                                <p className="text-xs text-gray-400 mt-1">
                                  {format(new Date(expense.createdAt), 'dd/MM/yyyy HH:mm', { locale: es })}
                                </p>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}