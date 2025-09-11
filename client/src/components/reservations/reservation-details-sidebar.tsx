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
  Loader2,
  Check
  
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
import { useReservationsByTrip } from "@/hooks/use-reservations-by-trip";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";

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
  onReservationUpdate?: () => void; // Callback para notificar actualizaciones
}

export function ReservationDetailsSidebar({ 
  recordId, 
  tripInfo, 
  reservations: propsReservations, // renombrar props para evitar conflicto
  onClose,
  onReservationUpdate
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
  
  // Estados para acciones de reservación
  const [loadingActions, setLoadingActions] = useState<Record<number, 'check' | 'payment' | null>>({});
  const [isLoadingBudget, setIsLoadingBudget] = useState(false);
  const [isAddingExpense, setIsAddingExpense] = useState(false);
  const [isRemovingExpense, setIsRemovingExpense] = useState<number | null>(null);
  
  // Estados para acciones de paqueterías
  const [loadingPackageActions, setLoadingPackageActions] = useState<Record<number, 'payment' | 'delivery' | null>>({});
  
  // Estado para actualizaciones optimistas de paquetes
  const [optimisticPackageUpdates, setOptimisticPackageUpdates] = useState<Record<number, {
    isPaid?: boolean;
    deliveryStatus?: string;
  }>>({});

  // Estado para forzar refresh de datos
  const [refreshKey, setRefreshKey] = useState(0);
  

  
  // Hooks
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copiedPhone, setCopiedPhone] = useState<string | null>(null);
  
  // Usar hook para obtener reservaciones actuales del servidor
  const { 
    data: serverReservations = [], 
    isLoading: isLoadingReservations 
  } = useReservationsByTrip({ 
    recordId, 
    tripInfo, 
    enabled: true 
  });
  
  // Usar reservaciones del servidor si están disponibles, sino usar las de props como fallback
  const reservations = serverReservations.length > 0 ? serverReservations : propsReservations;

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
        const tripId = firstReservation.trip.id as any;
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

  // Función para marcar reservación como checked
  const markAsChecked = async (reservationId: number) => {
    console.log('[markAsChecked] Iniciando proceso para reservación:', reservationId);
    console.log('[markAsChecked] Estado actual loadingActions:', loadingActions);
    
    // Prevenir múltiples clics
    if (loadingActions[reservationId] === 'check' || loadingActions[reservationId] === 'payment') {
      console.log('[markAsChecked] Cancelando - ya hay acción en progreso:', loadingActions[reservationId]);
      return;
    }
    
    console.log('[markAsChecked] Estableciendo estado de loading...');
    setLoadingActions(prev => ({ ...prev, [reservationId]: 'check' }));
    
    try {
      console.log('[markAsChecked] Enviando petición POST a /api/reservations/' + reservationId + '/check');
      const response = await apiRequest(
        "POST",
        `/api/reservations/${reservationId}/check`,
        {}
      );

      console.log('[markAsChecked] Respuesta recibida:', response);
      
      if (response.ok) {
        console.log('[markAsChecked] Éxito - invalidando cache para datos reales del servidor...');
        
        // Invalidar queries con el queryKey exacto que usa useReservationsByTrip
        console.log('[markAsChecked] Invalidando queries con queryKey de useReservationsByTrip...');
        await Promise.all([
          queryClient.invalidateQueries({ 
            queryKey: ["reservations-by-trip", recordId, tripInfo?.departureDate, user?.role] 
          }),
          queryClient.invalidateQueries({ 
            predicate: (query) => query.queryKey[0] === 'reservations-by-trip'
          })
        ]);
        
        // Notificar al componente padre para que actualice los datos
        if (onReservationUpdate) {
          onReservationUpdate();
        }
        
        toast({
          title: "Reservación marcada como check",
          description: "La reservación ha sido marcada como check correctamente.",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[markAsChecked] Error en respuesta:', errorData);
        throw new Error(errorData.message || 'Error al marcar como check');
      }
    } catch (error) {
      console.error('[markAsChecked] Error capturado:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo marcar la reservación como check. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      // Limpiar estado loading siempre al finalizar (éxito o error)
      console.log('[markAsChecked] Finalizando - limpiando estado loading...');
      setLoadingActions(prev => ({ ...prev, [reservationId]: null }));
    }
  };

  // Función para marcar reservación como pagada
  const markAsPaid = async (reservationId: number) => {
    console.log('[markAsPaid] Iniciando proceso para reservación:', reservationId);
    console.log('[markAsPaid] Estado actual loadingActions:', loadingActions);
    
    // Prevenir múltiples clics
    if (loadingActions[reservationId] === 'payment' || loadingActions[reservationId] === 'check') {
      console.log('[markAsPaid] Cancelando - ya hay acción en progreso:', loadingActions[reservationId]);
      return;
    }
    
    console.log('[markAsPaid] Estableciendo estado de loading...');
    setLoadingActions(prev => ({ ...prev, [reservationId]: 'payment' }));
    
    try {
      console.log('[markAsPaid] Enviando petición PUT a /api/reservations/' + reservationId);
      const response = await apiRequest(
        "PUT",
        `/api/reservations/${reservationId}`,
        { paymentStatus: "pagado" }
      );

      console.log('[markAsPaid] Respuesta recibida:', response);
      
      if (response.ok) {
        console.log('[markAsPaid] Éxito - invalidando cache para datos reales del servidor...');
        
        // Invalidar queries con el queryKey exacto que usa useReservationsByTrip
        console.log('[markAsPaid] Invalidando queries con queryKey de useReservationsByTrip...');
        await Promise.all([
          queryClient.invalidateQueries({ 
            queryKey: ["reservations-by-trip", recordId, tripInfo?.departureDate, user?.role] 
          }),
          queryClient.invalidateQueries({ 
            predicate: (query) => query.queryKey[0] === 'reservations-by-trip'
          })
        ]);
        
        // Notificar al componente padre para que actualice los datos
        if (onReservationUpdate) {
          onReservationUpdate();
        }
        
        toast({
          title: "Reservación marcada como pagada",
          description: "La reservación ha sido marcada como pagada correctamente.",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('[markAsPaid] Error en respuesta:', errorData);
        throw new Error(errorData.message || 'Error al marcar como pagada');
      }
    } catch (error) {
      console.error('[markAsPaid] Error capturado:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo marcar la reservación como pagada. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      // Limpiar estado loading siempre al finalizar (éxito o error)
      console.log('[markAsPaid] Finalizando - limpiando estado loading...');
      setLoadingActions(prev => ({ ...prev, [reservationId]: null }));
    }
  };

  // Función para marcar paquete como pagado
  const markPackageAsPaid = async (packageId: number) => {
    console.log('[markPackageAsPaid] Iniciando proceso para paquete:', packageId);
    
    // Prevenir múltiples clics
    if (loadingPackageActions[packageId] === 'payment' || loadingPackageActions[packageId] === 'delivery') {
      console.log('[markPackageAsPaid] Cancelando - ya hay acción en progreso:', loadingPackageActions[packageId]);
      return;
    }
    
    setLoadingPackageActions(prev => ({ ...prev, [packageId]: 'payment' }));
    
    try {
      // Usar el mismo endpoint que la página pública para asegurar que se cree la transacción
      const response = await fetch(`/api/public/packages/${packageId}/mark-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          isPaid: true
        })
      });
      
      if (response.ok) {
        // Invalidar queries para refrescar los datos inmediatamente
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/packages'] }),
          queryClient.invalidateQueries({ queryKey: [`/api/packages/trip`] }),
          queryClient.invalidateQueries({ queryKey: ["packages-by-trip"] }),
          // También invalidar transacciones para que aparezcan en la línea de tiempo
          queryClient.invalidateQueries({ queryKey: ['/api/transactions'] }),
          queryClient.invalidateQueries({ queryKey: ['/api/operator-timeline'] })
        ]);
        
        toast({
          title: "Paquete marcado como pagado",
          description: "El paquete ha sido marcado como pagado y se ha creado la transacción correspondiente.",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al marcar paquete como pagado');
      }
    } catch (error) {
      console.error('[markPackageAsPaid] Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo marcar el paquete como pagado. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoadingPackageActions(prev => ({ ...prev, [packageId]: null }));
    }
  };

  // Función para marcar paquete como entregado
  const markPackageAsDelivered = async (packageId: number) => {
    console.log('[markPackageAsDelivered] Iniciando proceso para paquete:', packageId);
    
    // Prevenir múltiples clics
    if (loadingPackageActions[packageId] === 'delivery' || loadingPackageActions[packageId] === 'payment') {
      console.log('[markPackageAsDelivered] Cancelando - ya hay acción en progreso:', loadingPackageActions[packageId]);
      return;
    }
    
    setLoadingPackageActions(prev => ({ ...prev, [packageId]: 'delivery' }));
    
    try {
      const response = await apiRequest(
        "PATCH",
        `/api/packages/${packageId}`,
        { 
          deliveryStatus: "entregado",
          deliveredBy: user?.id
        }
      );
      
      if (response.ok) {
        // Invalidar queries para refrescar los datos inmediatamente
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['/api/packages'] }),
          queryClient.invalidateQueries({ queryKey: [`/api/packages/trip`] }),
          queryClient.invalidateQueries({ queryKey: ["packages-by-trip"] })
        ]);
        
        toast({
          title: "Paquete marcado como entregado",
          description: "El paquete ha sido marcado como entregado correctamente.",
        });
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Error al marcar paquete como entregado');
      }
    } catch (error) {
      console.error('[markPackageAsDelivered] Error:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "No se pudo marcar el paquete como entregado. Inténtalo de nuevo.",
        variant: "destructive",
      });
    } finally {
      setLoadingPackageActions(prev => ({ ...prev, [packageId]: null }));
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

  // Debug logging para paqueterías
  console.log(`[ReservationDetailsSidebar] Packages debug:`, {
    recordId,
    tripInfo,
    packagesCount: packages.length,
    userRole: user?.role,
    isLoadingPackages,
    packagesError: packagesError?.message
  });

  // Función para copiar teléfono con feedback visual
  const handleCopyPhone = async (phone: string) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        // Método moderno para navegadores compatibles
        await navigator.clipboard.writeText(phone);
      } else {
        // Fallback para navegadores más antiguos
        const textArea = document.createElement("textarea");
        textArea.value = phone;
        textArea.style.position = "fixed";
        textArea.style.left = "-999999px";
        textArea.style.top = "-999999px";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      }
      
      // Mostrar feedback visual
      setCopiedPhone(phone);
      setTimeout(() => setCopiedPhone(null), 2000);
      
      toast({
        title: "Copiado",
        description: "Número de teléfono copiado al portapapeles",
      });
    } catch (err) {
      console.error('Error al copiar:', err);
      toast({
        title: "Error",
        description: "No se pudo copiar el número de teléfono",
        variant: "destructive"
      });
    }
  };

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
      // Filtrar por estado: EXCLUIR reservaciones canceladas
      const status = reservation.status?.toLowerCase();
      if (status === 'canceled' || status === 'canceledandrefund') {
        console.log(`[ReservationDetailsSidebar] Excluyendo reservación ${reservation.id} con estado: ${reservation.status}`);
        return false;
      }
      
      // Si no hay búsqueda, mostrar todas las no canceladas
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



  const totalPassengers = filteredReservations.reduce((total: number, reservation: ReservationWithDetails) => {
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
                <p className="font-semibold text-sm">
                  {formatTime(tripInfo?.departureTime || '00:00')} - {formatTime(tripInfo?.arrivalTime || '00:00')}
                </p>
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
                          {(reservation.checkCount && reservation.checkCount > 0) || reservation.checkedBy ? (
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
                                ? '$ 0 (Efectivo)'
                                : `$ ${(reservation.totalAmount - (reservation.advanceAmount || 0)).toFixed(0)}`
                              }
                              {reservation.paymentStatus !== 'pagado' && (
                                <span className="text-xs font-normal text-gray-500 ml-1">
                                  ({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})
                                </span>
                              )}
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
                      {(reservation.checkCount && reservation.checkCount > 0) || reservation.checkedBy ? (
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
                            // Función helper para obtener origen/destino específico de cada reservación
                            const getSegmentInfo = (isOrigin: boolean) => {
                              const tripDetails = reservation.tripDetails as any;
                              const tripId = tripDetails?.tripId;
                              
                              // Si tripId es string con formato "1288_91" (sub-viaje)
                              if (typeof tripId === 'string' && tripId.includes('_')) {
                                const [, segmentIndexStr] = tripId.split('_');
                                const segmentIndex = parseInt(segmentIndexStr, 10);
                                const route = reservation.trip?.route;
                                
                                if (route?.stops && !isNaN(segmentIndex)) {
                                  // Generar segmentos desde las paradas
                                  const stops = route.stops;
                                  let currentIndex = 0;
                                  for (let i = 0; i < stops.length - 1; i++) {
                                    for (let j = i + 1; j < stops.length; j++) {
                                      if (currentIndex === segmentIndex) {
                                        return isOrigin ? stops[i] : stops[j];
                                      }
                                      currentIndex++;
                                    }
                                  }
                                }
                              }
                              
                              // Para tripId numérico o fallback: usar información específica si existe
                              if (tripDetails?.segmentOrigin && tripDetails?.segmentDestination) {
                                return isOrigin ? tripDetails.segmentOrigin : tripDetails.segmentDestination;
                              }
                              
                              // Fallback final: información de la ruta
                              return isOrigin 
                                ? (reservation.trip?.route?.origin || 'Origen')
                                : (reservation.trip?.route?.destination || 'Destino');
                            };
                            
                            return getSegmentInfo(true);
                          })()}
                        </div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">Destino</div>
                        <div className="font-medium">
                          {(() => {
                            // Función helper para obtener origen/destino específico de cada reservación
                            const getSegmentInfo = (isOrigin: boolean) => {
                              const tripDetails = reservation.tripDetails as any;
                              const tripId = tripDetails?.tripId;
                              
                              // Si tripId es string con formato "1288_91" (sub-viaje)
                              if (typeof tripId === 'string' && tripId.includes('_')) {
                                const [, segmentIndexStr] = tripId.split('_');
                                const segmentIndex = parseInt(segmentIndexStr, 10);
                                const route = reservation.trip?.route;
                                
                                if (route?.stops && !isNaN(segmentIndex)) {
                                  // Generar segmentos desde las paradas
                                  const stops = route.stops;
                                  let currentIndex = 0;
                                  for (let i = 0; i < stops.length - 1; i++) {
                                    for (let j = i + 1; j < stops.length; j++) {
                                      if (currentIndex === segmentIndex) {
                                        return isOrigin ? stops[i] : stops[j];
                                      }
                                      currentIndex++;
                                    }
                                  }
                                }
                              }
                              
                              // Para tripId numérico o fallback: usar información específica si existe
                              if (tripDetails?.segmentOrigin && tripDetails?.segmentDestination) {
                                return isOrigin ? tripDetails.segmentOrigin : tripDetails.segmentDestination;
                              }
                              
                              // Fallback final: información de la ruta
                              return isOrigin 
                                ? (reservation.trip?.route?.origin || 'Origen')
                                : (reservation.trip?.route?.destination || 'Destino');
                            };
                            
                            return getSegmentInfo(false);
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* Teléfono de contacto con botón para copiar - oculto para checador y chofer */}
                    {reservation.phone && user?.role !== 'checador' && user?.role !== 'chofer' && (
                      <div className="text-sm mb-3">
                        <div className="text-xs text-gray-500">Contacto</div>
                        <div className="font-medium flex items-center">
                          <Phone className="h-3 w-3 mr-1 text-gray-500" />
                          <a href={`tel:${reservation.phone}`} className="text-primary hover:underline">
                            {reservation.phone}
                          </a>
                          <button
                            onClick={() => handleCopyPhone(reservation.phone || '')}
                            className={`ml-2 p-1 rounded-sm hover:bg-gray-100 transition-colors duration-200 ${
                              copiedPhone === reservation.phone 
                                ? 'bg-green-100 text-green-600' 
                                : 'text-gray-500'
                            }`}
                            title="Copiar al portapapeles"
                          >
                            {copiedPhone === reservation.phone ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <ClipboardCopy className="h-3.5 w-3.5" />
                            )}
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

                    {/* Botones de acción */}
                    <div className="mt-3 flex flex-col sm:flex-row gap-2">
                      {/* Botón Marcar como check - solo mostrar si no está checked (considerando actualizaciones optimistas) */}
                      {!(reservation.checkCount && reservation.checkCount > 0) && !reservation.checkedBy && (
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-blue-600 hover:bg-blue-700 text-white"
                          onClick={() => markAsChecked(reservation.id)}
                          disabled={
                            loadingActions[reservation.id] === 'check' ||
                            loadingActions[reservation.id] === 'payment'
                          }
                        >
                          {loadingActions[reservation.id] === 'check' ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Procesando...
                            </>
                          ) : (
                            <>
                              <CheckIcon className="h-4 w-4 mr-2" />
                              Marcar como check
                            </>
                          )}
                        </Button>
                      )}

                      {/* Botón Marcar como pagado - solo mostrar si no está pagado */}
                      {reservation.paymentStatus !== 'pagado' && (
                        <Button
                          size="sm"
                          variant="default"
                          className="bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => {
                            console.log('[Button Click] Reservación ID:', reservation.id);
                            console.log('[Button Click] Payment Status:', reservation.paymentStatus);
                            console.log('[Button Click] Loading Actions:', loadingActions);
                            console.log('[Button Click] Is Loading Payment:', loadingActions[reservation.id] === 'payment');
                            console.log('[Button Click] Is Paid:', reservation.paymentStatus === 'pagado');
                            markAsPaid(reservation.id);
                          }}
                          disabled={
                            loadingActions[reservation.id] === 'payment' || 
                            loadingActions[reservation.id] === 'check'
                          }
                        >
                          {loadingActions[reservation.id] === 'payment' ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Procesando...
                            </>
                          ) : (
                            <>
                              <DollarSign className="h-4 w-4 mr-2" />
                              Marcar como pagado
                            </>
                          )}
                        </Button>
                      )}
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
                        {pkg.tripDetails?.origin || pkg.trip?.route?.origin || pkg.tripOrigin || 'No especificado'}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Destino</div>
                      <div className="font-medium text-xs md:text-sm break-words">
                        {pkg.tripDetails?.destination || pkg.trip?.route?.destination || pkg.tripDestination || 'No especificado'}
                      </div>
                    </div>
                  </div>

                  {/* Horario de salida */}
                  {(pkg.tripDetails?.departureTime || pkg.tripDepartureTime) && (
                    <div className="mb-3">
                      <div className="text-xs text-gray-500">Hora de salida</div>
                      <div className="font-medium text-xs md:text-sm text-orange-600">
                        {pkg.tripDetails?.departureTime || pkg.tripDepartureTime}
                      </div>
                    </div>
                  )}

                  {/* Información de contacto */}
                  <div className="space-y-2 sm:grid sm:grid-cols-2 sm:gap-2 sm:space-y-0 text-sm mb-3">
                    <div>
                      <div className="text-xs text-gray-500">Remitente</div>
                      <div className="font-medium">
                        <div className="text-xs md:text-sm text-orange-600">
                          {pkg.senderName} {pkg.senderLastName}
                        </div>
                        {user?.role !== 'checador' && user?.role !== 'chofer' && pkg.senderPhone && (
                          <div className="flex items-center mt-1">
                            <Phone className="h-3 w-3 mr-1 text-gray-500 flex-shrink-0" />
                            <a href={`tel:${pkg.senderPhone}`} className="text-orange-600 hover:underline text-xs md:text-sm truncate">
                              {pkg.senderPhone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Destinatario</div>
                      <div className="font-medium">
                        <div className="text-xs md:text-sm text-orange-600">
                          {pkg.recipientName} {pkg.recipientLastName}
                        </div>
                        {user?.role !== 'checador' && user?.role !== 'chofer' && pkg.recipientPhone && (
                          <div className="flex items-center mt-1">
                            <Phone className="h-3 w-3 mr-1 text-gray-500 flex-shrink-0" />
                            <a href={`tel:${pkg.recipientPhone}`} className="text-orange-600 hover:underline text-xs md:text-sm truncate">
                              {pkg.recipientPhone}
                            </a>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Estado de entrega y asientos */}
                  <div className="flex flex-col sm:grid sm:grid-cols-2 gap-2 text-sm mb-4">
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

                  {/* Botones de acción para paquetes */}
                  {(user?.role === 'admin' || user?.role === 'callCenter' || user?.role === 'taquilla' || user?.role === 'checador' || user?.role === 'dueño' || user?.role === 'chofer') && (
                    <div className="flex flex-col sm:flex-row gap-2">
                      {/* Botón Marcar como pagado */}
                      {!pkg.isPaid && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markPackageAsPaid(pkg.id)}
                          disabled={loadingPackageActions[pkg.id] === 'payment'}
                          className="flex items-center gap-2 border-green-200 text-green-700 hover:bg-green-50 disabled:opacity-50"
                        >
                          {loadingPackageActions[pkg.id] === 'payment' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <DollarSign className="h-3 w-3" />
                          )}
                          Marcar como pagado
                        </Button>
                      )}

                      {/* Botón Marcar como entregado */}
                      {pkg.deliveryStatus !== 'entregado' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => markPackageAsDelivered(pkg.id)}
                          disabled={loadingPackageActions[pkg.id] === 'delivery'}
                          className="flex items-center gap-2 border-blue-200 text-blue-700 hover:bg-blue-50 disabled:opacity-50"
                        >
                          {loadingPackageActions[pkg.id] === 'delivery' ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <Check className="h-3 w-3" />
                          )}
                          Marcar como entregado
                        </Button>
                      )}
                    </div>
                  )}
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
                          <option value="none">Seleccionar categoría</option>
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