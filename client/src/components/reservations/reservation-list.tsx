import { useState, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { formatDate, formatPrice, generateReservationId, normalizeToStartOfDay, isSameLocalDay } from "@/lib/utils";
import { formatTripTime } from "@/lib/trip-utils";
import { useLocation } from "wouter";
import {
  UserIcon,
  SearchIcon,
  Loader2Icon,
  XIcon,
  PhoneIcon,
  MailIcon,
  CalendarIcon,
  ArchiveIcon,
  FilterIcon,
  QrCode,
  ExternalLink,
  Building2,
  ArrowRightLeft,
  Check as CheckIcon,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Edit,
  X,
  MoreHorizontal,
  Eye,
  Trash as TrashIcon,
  Clock,
  Car,
  Users,
} from "lucide-react";
import { useReservations } from "@/hooks/use-reservations";
import { useAuth } from "@/hooks/use-auth";
import ReservationDetailsModal from "@/components/reservations/reservation-details-modal";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Reservation, ReservationWithDetails } from "@shared/schema";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ReservationList() {
  // Mapeo de company_id a nombres amigables
  const getCompanyDisplayName = (companyId?: string | null): string => {
    const companyMap: Record<string, string> = {
      "bamo-350045": "BAMO",
      "turismo-mega-876598": "Turismo Mega",
      "viaja-facil-123": "Viaja Fácil",
      // Agregar más mapeos según sea necesario
    };
    
    if (!companyId) return "Sin empresa";
    return companyMap[companyId] || companyId;
  };
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [, setLocation] = useLocation();
  const [searchTerm, setSearchTerm] = useState("");
  const [dateFilter, setDateFilter] = useState(""); // Vacío por defecto = mostrar todas las reservaciones
  const [confirmingDelete, setConfirmingDelete] = useState<number | null>(null);
  const [editingReservation, setEditingReservation] = useState<ReservationWithDetails | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<string>("cash");
  const [advancePaymentMethod, setAdvancePaymentMethod] = useState<string>("cash");
  const [advanceAmount, setAdvanceAmount] = useState<string>("");
  const [remainingAmount, setRemainingAmount] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  // Modal de detalles de reservación
  const [selectedReservationId, setSelectedReservationId] = useState<number | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  // Por defecto mostramos las reservaciones actuales/futuras
  const [activeTab, setActiveTab] = useState("upcoming");

  // Estados adicionales para mejorar la UX
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [showLoadingDelay, setShowLoadingDelay] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // New states for filtering and sorting
  const [sortBy, setSortBy] = useState<"date" | "name" | "time">("date");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedReservations, setSelectedReservations] = useState<number[]>([]);

  // Obtener información del usuario actual
  const { user } = useAuth();

  // Utilizar el nuevo hook especializado para cargar reservaciones
  const {
    data: reservations,
    isLoading,
    error: reservationsError
  } = useReservations({
    date: dateFilter || undefined, // Solo usar filtro de fecha si el usuario lo especifica
    archived: activeTab === "archived" // Usar endpoint archivadas cuando el filtro sea "archived"
  });

  // Actualizar estados de UI basados en el estado de carga
  useEffect(() => {
    if (isLoading) {
      const loadingTimeout = setTimeout(() => setShowLoadingDelay(true), 500);
      return () => clearTimeout(loadingTimeout);
    } else {
      setIsInitialLoad(false);
      setHasError(!!reservationsError);
    }
  }, [isLoading, reservationsError]);

  // Ahora usamos funciones inline para manejar las comparaciones de fechas

  // Separar reservaciones en actuales, archivadas y canceladas
  // Primero, separamos las canceladas (tendrán su propia pestaña)
  const canceledReservations = reservations?.filter(
    (reservation) => reservation.status === 'canceled' || reservation.status === 'canceledAndRefund'
  ) || [];

  // Usar la fecha actual real del sistema
  const SYSTEM_DATE = new Date();
  console.log(`[SISTEMA] Fecha actual del sistema: ${SYSTEM_DATE.toISOString()}`);

  // Luego filtramos las reservaciones actuales/futuras (que no estén canceladas)
  const upcomingReservations = reservations?.filter(
    (reservation) => {
      // Solo incluir reservaciones confirmadas (no canceladas)
      if (reservation.status !== 'confirmed') return false;

      // Usar normalizeToStartOfDay para obtener la fecha normalizada del viaje
      // CORRECTED: Access reservation.trip.departureDate directly
      const tripDate = normalizeToStartOfDay(reservation.trip.departureDate || reservation.createdAt);
      // Normalizar la fecha actual del sistema para una comparación correcta
      const today = normalizeToStartOfDay(SYSTEM_DATE);

      console.log(`[Clasificación] Evaluando reservación ${reservation.id} para 'Actuales y Futuras'`);
      console.log(`[Clasificación] Fecha viaje: ${tripDate.toISOString()}, Fecha sistema: ${today.toISOString()}`);
      console.log(`[Clasificación] ¿Es actual o futura? ${tripDate >= today ? 'SÍ' : 'NO'}`);

      // Las reservaciones con fecha igual o posterior a hoy se consideran "actuales o futuras"
      return tripDate >= today;
    }
  ) || [];

  const archivedReservations = reservations?.filter(
    (reservation) => {
      // Solo incluir reservaciones confirmadas (no canceladas)
      if (reservation.status !== 'confirmed') return false;

      // Usar normalizeToStartOfDay para obtener la fecha normalizada del viaje
      // CORRECTED: Access reservation.trip.departureDate directly
      const tripDate = normalizeToStartOfDay(reservation.trip.departureDate || reservation.createdAt);
      // Usar la misma fecha del sistema declarada arriba
      const today = normalizeToStartOfDay(SYSTEM_DATE);

      console.log(`[Clasificación] Evaluando reservación ${reservation.id} para 'Archivadas'`);
      console.log(`[Clasificación] Fecha viaje: ${tripDate.toISOString()}, Fecha sistema: ${today.toISOString()}`);
      console.log(`[Clasificación] ¿Es archivada? ${tripDate < today ? 'SÍ' : 'NO'}`);

      // Cambiamos a 'estrictamente menor que' para que las reservaciones del día actual
      // NO se consideren archivadas sino actuales
      return tripDate < today;
    }
  ) || [];

  // Obtener las reservaciones según la pestaña activa
  const activeReservations =
    activeTab === "upcoming"
      ? upcomingReservations
      : activeTab === "archived"
        ? archivedReservations
        : canceledReservations;

  // Function to handle sorting
  const getSortedReservations = (reservations: ReservationWithDetails[]) => {
    return [...reservations].sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "date": {
          // CORRECTED: Access a.trip.departureDate directly
          const dateA = new Date(a.trip.departureDate || a.createdAt);
          // CORRECTED: Access b.trip.departureDate directly
          const dateB = new Date(b.trip.departureDate || b.createdAt);
          comparison = dateA.getTime() - dateB.getTime();
          break;
        }
        case "name": {
          const nameA = a.passengers[0] ? `${a.passengers[0].firstName} ${a.passengers[0].lastName}` : "";
          const nameB = b.passengers[0] ? `${b.passengers[0].firstName} ${b.passengers[0].lastName}` : "";
          comparison = nameA.localeCompare(nameB);
          break;
        }
        case "time": {
          // CORRECTED: Access a.trip.departureTime directly
          const timeA = a.trip.departureTime || "00:00";
          // CORRECTED: Access b.trip.departureTime directly
          const timeB = b.trip.departureTime || "00:00";
          comparison = timeA.localeCompare(timeB);
          break;
        }
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });
  };

  // Filter reservations based on search term and date filter
  const filteredReservations = getSortedReservations(activeReservations.filter((reservation) => {
    // Aplicar filtro de búsqueda
    let matchesSearch = true;
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      const routeName = reservation.trip.route.name.toLowerCase();
      const passengerNames = reservation.passengers.map(
        p => `${p.firstName} ${p.lastName}`.toLowerCase()
      ).join(" ");
      const email = (reservation.email || '').toLowerCase();
      const phone = (reservation.phone || '').toLowerCase();

      matchesSearch = (
        routeName.includes(searchLower) ||
        passengerNames.includes(searchLower) ||
        email.includes(searchLower) ||
        phone.includes(searchLower)
      );
    }

    // Aplicar filtro de fecha específica
    let matchesDate = true;
    if (selectedDate) {
      // CORRECTED: Access reservation.trip.departureDate directly
      const tripDate = normalizeToStartOfDay(reservation.trip.departureDate || reservation.createdAt);
      const filterDate = normalizeToStartOfDay(new Date(selectedDate));
      matchesDate = isSameLocalDay(tripDate, filterDate);
    }

    // Aplicar filtro de fecha usando nuestras utilidades de normalización
    let matchesDateFilter = true;
    if (dateFilter) {
      // Usar isSameLocalDay para comparar las fechas
      // CORRECTED: Access reservation.trip.departureDate directly
      const tripDate = normalizeToStartOfDay(reservation.trip.departureDate || reservation.createdAt);
      const filterDate = normalizeToStartOfDay(dateFilter);
      matchesDateFilter = isSameLocalDay(tripDate, filterDate);
    }

    return matchesSearch && matchesDate && matchesDateFilter;
  }));

  // Functions for handling checkbox selections
  const handleSelectReservation = (reservationId: number, checked: boolean) => {
    setSelectedReservations(prev =>
      checked
        ? [...prev, reservationId]
        : prev.filter(id => id !== reservationId)
    );
  };

  const handleSelectAll = (checked: boolean) => {
    setSelectedReservations(checked ? filteredReservations.map(r => r.id) : []);
  };

  const isAllSelected = selectedReservations.length === filteredReservations.length && filteredReservations.length > 0;
  const isIndeterminate = selectedReservations.length > 0 && selectedReservations.length < filteredReservations.length;

  // Pagination Logic
  const totalPages = Math.ceil(filteredReservations.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedReservations = filteredReservations.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  const handleItemsPerPageChange = (value: string) => {
    setItemsPerPage(Number(value));
    setCurrentPage(1); // Reset to first page when items per page changes
  };

  // Cancel reservation mutation (soft delete)
  const cancelReservationMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/reservations/${id}/cancel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cancelar la reservación');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reservación cancelada",
        description: "La reservación ha sido cancelada exitosamente. Los asientos han sido liberados.",
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });

      // Close confirmation dialog
      setConfirmingDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error al cancelar reservación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete reservation mutation (hard delete)
  const deleteReservationMutation = useMutation({
    mutationFn: async (id: number) => {
      // Importante: No intentamos parsear JSON para una respuesta 204 (sin contenido)
      const response = await fetch(`/api/reservations/${id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        // Si hay un error, intentamos extraer el mensaje
        const errorData = response.status !== 204 ? await response.json() : { error: 'Unknown error' };
        throw new Error(errorData.error || 'Failed to delete reservation completely');
      }

      // Retornamos un valor simple ya que la respuesta no tiene cuerpo
      return true;
    },
    onSuccess: () => {
      toast({
        title: "Reservación eliminada",
        description: "La reservación ha sido eliminada completamente del sistema.",
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });

      // Close confirmation dialog
      setConfirmingDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error al eliminar reservación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Cancel reservation with refund mutation
  const cancelReservationWithRefundMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/reservations/${id}/cancel-refund`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error al cancelar la reservación con reembolso');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast({
        title: "Reservación cancelada con reembolso",
        description: `La reservación ha sido cancelada y se ha procesado un reembolso de ${formatPrice(data.refundAmount)}.`,
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
      queryClient.invalidateQueries({ queryKey: ["/api/transactions"] });

      // Close confirmation dialog
      setConfirmingDelete(null);
    },
    onError: (error) => {
      toast({
        title: "Error al cancelar reservación con reembolso",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Estados adicionales para el formulario de edición
  const [email, setEmail] = useState<string>("");
  const [phone, setPhone] = useState<string>("");

  // Edit reservation mutation
  const editReservationMutation = useMutation({
    mutationFn: async (data: { id: number, updates: Partial<Reservation> }) => {
      const response = await apiRequest(
        "PUT",
        `/api/reservations/${data.id}`,
        data.updates
      );
      if (!response.ok) {
        throw new Error("Failed to update reservation");
      }
      return await response.json();
    },
    onSuccess: () => {
      toast({
        title: "Reservación actualizada",
        description: "La reservación ha sido actualizada exitosamente.",
      });

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ["/api/reservations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/trips"] });

      // Close edit modal
      setIsEditModalOpen(false);
      setEditingReservation(null);
    },
    onError: (error) => {
      toast({
        title: "Error al actualizar la reservación",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Edit handlers
  const openEditModal = (reservation: ReservationWithDetails) => {
    setEditingReservation(reservation);
    // Inicializar todos los campos del formulario con los valores actuales
    setPaymentMethod(reservation.paymentMethod || "efectivo");
    setAdvancePaymentMethod(reservation.advancePaymentMethod || "efectivo");
    setAdvanceAmount((reservation.advanceAmount || 0).toString());
    setRemainingAmount((reservation.totalAmount - (reservation.advanceAmount || 0)).toString());
    setNotes(reservation.notes || "");
    setEmail(reservation.email || "");
    setPhone(reservation.phone || "");
    setIsEditModalOpen(true);
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditingReservation(null);
  };

  const handleSaveEdit = () => {
    if (!editingReservation) return;

    // Preparamos las actualizaciones básicas que siempre se envían
    const updates: Partial<Reservation> = {
      paymentMethod,
      advancePaymentMethod,
      notes,
      email,
      phone
    };

    // Agregar los montos editables
    const advanceAmountNum = parseFloat(advanceAmount) || 0;
    const remainingAmountNum = parseFloat(remainingAmount) || 0;

    // Validar que el anticipo no sea mayor al total original
    if (advanceAmountNum > editingReservation.totalAmount) {
      toast({
        title: "Error en el anticipo",
        description: `El anticipo no puede ser mayor al precio del boleto (${formatPrice(editingReservation.totalAmount)})`,
        variant: "destructive",
      });
      return;
    }

    // Validar que ambos montos sean positivos
    if (advanceAmountNum < 0 || remainingAmountNum < 0) {
      toast({
        title: "Error en las cantidades",
        description: "Las cantidades no pueden ser negativas",
        variant: "destructive",
      });
      return;
    }

    updates.advanceAmount = advanceAmountNum;
    // Actualizar el total amount si el restante es mayor (para casos de exceso de equipaje)
    const newTotal = advanceAmountNum + remainingAmountNum;
    if (newTotal !== editingReservation.totalAmount) {
      updates.totalAmount = newTotal;
    }

    // Enviamos todas las actualizaciones
    editReservationMutation.mutate({
      id: editingReservation.id,
      updates
    });
  };

  // Confirmation dialog handlers
  const [confirmationType, setConfirmationType] = useState<'cancel' | 'cancel-refund' | 'delete'>('cancel');

  const openDeleteConfirm = (id: number, type: 'cancel' | 'cancel-refund' | 'delete' = 'cancel') => {
    setConfirmingDelete(id);
    setConfirmationType(type);
  };

  const handleDeleteConfirm = () => {
    if (confirmingDelete !== null) {
      if (confirmationType === 'cancel') {
        cancelReservationMutation.mutate(confirmingDelete);
      } else if (confirmationType === 'cancel-refund') {
        cancelReservationWithRefundMutation.mutate(confirmingDelete);
      } else {
        deleteReservationMutation.mutate(confirmingDelete);
      }
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1); // Reset to first page on search
  };

  return (
    <div className="py-6">
      <Card>
        <CardHeader className="pb-4 pt-4 px-4">
          {/* Título y botones de categoría */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
            <div className="flex items-center gap-2">
              {activeTab === "upcoming" ? (
                <>
                  <CalendarIcon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">Reservaciones</CardTitle>
                </>
              ) : activeTab === "archived" ? (
                <>
                  <ArchiveIcon className="h-5 w-5 text-muted-foreground" />
                  <CardTitle className="text-lg">Archivadas</CardTitle>
                </>
              ) : (
                <>
                  <XIcon className="h-5 w-5 text-red-600" />
                  <CardTitle className="text-lg">Canceladas</CardTitle>
                </>
              )}
            </div>

            {/* Botones de categoría */}
            <div className="flex gap-2">
              <Button
                variant={activeTab === "archived" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  // Si ya está activo el filtro "archived", quitarlo (volver a "upcoming")
                  if (activeTab === "archived") {
                    setActiveTab("upcoming");
                  } else {
                    setActiveTab("archived");
                  }
                }}
                className="gap-1"
              >
                <ArchiveIcon className="h-4 w-4" />
                Archivadas
                <Badge variant="secondary" className="ml-1">{archivedReservations.length}</Badge>
              </Button>
              <Button
                variant={activeTab === "canceled" ? "default" : "outline"}
                size="sm"
                onClick={() => {
                  // Si ya está activo el filtro "canceled", quitarlo (volver a "upcoming")
                  if (activeTab === "canceled") {
                    setActiveTab("upcoming");
                  } else {
                    setActiveTab("canceled");
                  }
                }}
                className="gap-1"
              >
                <XIcon className="h-4 w-4" />
                Canceladas
                <Badge variant="secondary" className="ml-1">{canceledReservations.length}</Badge>
              </Button>
            </div>
          </div>

          {/* Controles de filtrado y búsqueda */}
          <div className="flex flex-col lg:flex-row gap-4 justify-between">
            {/* Barra de búsqueda */}
            <div className="flex-1 max-w-md">
              <div className="relative">
                <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Buscar por nombre, correo o teléfono..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Controles de filtrado y ordenamiento */}
            <div className="flex gap-2 flex-wrap">
              {/* Filtro por fecha específica */}
              <div className="flex items-center gap-2">
                <CalendarIcon className="h-4 w-4 text-gray-500" />
                <Input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="w-auto"
                />
              </div>

              {/* Ordenamiento por fecha */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (sortBy === "date") {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("date");
                    setSortOrder("desc");
                  }
                }}
                className="gap-1"
              >
                {sortBy === "date" && sortOrder === "asc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : sortBy === "date" && sortOrder === "desc" ? (
                  <ArrowDown className="h-4 w-4" />
                ) : (
                  <ArrowUpDown className="h-4 w-4" />
                )}
                Fecha
              </Button>

              {/* Ordenamiento por hora */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (sortBy === "time") {
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc");
                  } else {
                    setSortBy("time");
                    setSortOrder("desc");
                  }
                }}
                className="gap-1"
              >
                {sortBy === "time" && sortOrder === "asc" ? (
                  <ArrowUp className="h-4 w-4" />
                ) : sortBy === "time" && sortOrder === "desc" ? (
                  <ArrowDown className="h-4 w-4" />
                ) : (
                  <ArrowUpDown className="h-4 w-4" />
                )}
                Hora
              </Button>

              {/* Filtro general */}
              <Button
                variant="outline"
                size="sm"
                className="gap-1"
              >
                <FilterIcon className="h-4 w-4" />
                Filtros
              </Button>
            </div>
          </div>
        </CardHeader>

        {/* Vista para Desktop: Tabla tradicional */}
        <div className="hidden md:block overflow-x-auto">
          {isLoading && showLoadingDelay ? (
            <div className="flex justify-center items-center p-8">
              <Loader2Icon className="h-8 w-8 animate-spin text-primary" />
              <span className="ml-2">Cargando reservaciones...</span>
            </div>
          ) : hasError && !isInitialLoad ? (
            <div className="text-center p-8 text-red-500">
              Error al cargar las reservaciones. Por favor intenta de nuevo.
            </div>
          ) : paginatedReservations && paginatedReservations.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pasajero</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ruta</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Fecha</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Asientos</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Pago</th>
                  {activeTab === "canceled" && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Estado</th>
                  )}
                  {user?.role !== "taquilla" && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Creado por</th>
                  )}
                  {user?.role === "taquilla" && (
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      <Building2 className="h-4 w-4 inline mr-1" />
                      Empresa
                    </th>
                  )}
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedReservations.map((reservation) => (
                  <tr
                    key={reservation.id}
                    className={`hover:bg-gray-50 ${
                      reservation.status === 'canceled' ? 'bg-gray-50' : ''
                    } ${
                      selectedReservations.includes(reservation.id) ? 'bg-blue-50' : ''
                    }`}
                  >

                    <td
                      className="px-6 py-4 whitespace-nowrap text-sm cursor-pointer"
                      onClick={() => {
                        setSelectedReservationId(reservation.id);
                        setIsDetailsModalOpen(true);
                      }}
                    >
                      <div className="text-gray-500">
                        #{generateReservationId(reservation.id)}
                      </div>
                      {/* Indicador de Check */}
                      <div className="mt-1">
                        {reservation.checkCount && reservation.checkCount > 0 ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                            <CheckIcon className="h-3 w-3 mr-1" />
                            Check
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                            <XIcon className="h-3 w-3 mr-1" />
                            No check
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {reservation.passengers[0]?.firstName} {reservation.passengers[0]?.lastName}
                        {reservation.passengers.length > 1 && ` +${reservation.passengers.length - 1}`}
                      </div>
                      <div className="text-sm text-gray-500">{reservation.email}</div>
                      <div className="text-sm text-gray-500">Tel: {reservation.phone}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{reservation.trip.route.name}</div>
                      {/* CORRECTED: Access reservation.trip.origin and reservation.trip.destination directly */}
                      <div className="text-sm text-gray-500">
                        {reservation.trip.origin} → {reservation.trip.destination}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {/* CORRECTED: Access reservation.trip.departureDate directly */}
                      <div className="text-sm text-gray-900">{formatDate(reservation.trip.departureDate)}</div>
                      {/* CORRECTED: Access reservation.trip.departureTime directly */}
                      <div className="text-sm text-gray-500">{formatTripTime(reservation.trip.departureTime, true, 'pretty')}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {reservation.passengers.length}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          {/* Si está cancelado mostrar tratamiento especial */}
                          {activeTab === "canceled" ? (
                            <>
                              {/* Si está pagado, mostrar el valor total normalmente */}
                              {reservation.paymentStatus === 'pagado' ? (
                                <span className="text-sm font-medium">{formatPrice(reservation.totalAmount)}</span>
                              ) : (
                                <>
                                  {/* Si está pendiente, mostrar el valor total tachado */}
                                  <span className="text-sm font-medium line-through text-gray-500">{formatPrice(reservation.totalAmount)}</span>

                                  {/* Si tiene anticipo mostrar ese valor, si no mostrar $0 */}
                                  {(reservation.advanceAmount && reservation.advanceAmount > 0) ? (
                                    <span className="text-sm font-medium ml-1">{formatPrice(reservation.advanceAmount)}</span>
                                  ) : (
                                    <span className="text-sm font-medium ml-1">{formatPrice(0)}</span>
                                  )}
                                </>
                              )}
                            </>
                          ) : (
                            <span className="text-sm font-medium">{formatPrice(reservation.totalAmount)}</span>
                          )}
                          <Badge
                            variant={reservation.paymentStatus === 'pagado' ? "outline" : "secondary"}
                            className={
                              reservation.status === 'canceledAndRefund'
                                ? "bg-blue-100 text-blue-800 border-blue-200"
                                : reservation.paymentStatus === 'pagado'
                                ? "bg-green-100 text-green-800 border-green-200"
                                : "bg-amber-100 text-amber-800 border-amber-200"
                            }
                          >
                            {reservation.status === 'canceledAndRefund' 
                              ? 'REEMBOLSADO' 
                              : reservation.paymentStatus === 'pagado' 
                              ? 'PAGADO' 
                              : 'PENDIENTE'}
                          </Badge>
                        </div>

                        {(!reservation.advanceAmount || reservation.advanceAmount <= 0) ? (
                          activeTab === "canceled" ? (
                            <div className="flex text-xs">
                              <span className="text-gray-500">Método de pago:</span>
                              <span className="ml-1">{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</span>
                            </div>
                          ) : (
                            <div className="flex text-xs">
                              <span className="text-gray-500">Método de pago:</span>
                              <span className="ml-1">{reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}</span>
                            </div>
                          )
                        ) : (
                          <>
                            <div className="text-xs mb-1 flex">
                              <span className="text-gray-500">Anticipo:</span>
                              <span className="font-medium ml-1">
                                {formatPrice(reservation.advanceAmount)}{" "}
                                <span className="font-normal">({reservation.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</span>
                              </span>
                            </div>

                            {reservation.advanceAmount < reservation.totalAmount && (
                              <div className="text-xs flex">
                                <span className="text-gray-500">{reservation.paymentStatus === 'pagado' ? 'Pagó:' : 'Resta:'}</span>
                                {/* Si está cancelado pero pagado, mostrar normal; si está cancelado y pendiente, tachar */}
                                {activeTab === "canceled" ? (
                                  reservation.paymentStatus === 'pagado' ? (
                                    <span className="font-medium ml-1">
                                      {formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))}{" "}
                                      <span className="font-normal">({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</span>
                                    </span>
                                  ) : (
                                    <span className="font-medium ml-1 line-through text-gray-500">
                                      {formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))}{" "}
                                      <span className="font-normal">({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</span>
                                    </span>
                                  )
                                ) : (
                                  <span className="font-medium ml-1">
                                    {formatPrice(reservation.totalAmount - (reservation.advanceAmount || 0))}{" "}
                                    <span className="font-normal">({reservation.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'})</span>
                                  </span>
                                )}
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                    {activeTab === "canceled" && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge
                          variant="outline"
                          className={
                            reservation.status === 'canceledAndRefund'
                              ? "bg-blue-100 text-blue-800 border-blue-200"
                              : "bg-red-100 text-red-800 border-red-200"
                          }
                        >
                          {reservation.status === 'canceledAndRefund' 
                            ? 'CANCELADA Y REEMBOLSADA' 
                            : 'CANCELADA'}
                        </Badge>
                      </td>
                    )}
                    {user?.role !== "taquilla" && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        {/* Mostrar información de la empresa de origen si es una transferencia */}
                        {reservation.notes && reservation.notes.includes("Transferido desde") ? (
                          <div>
                            <div className="flex items-center text-sm font-medium text-blue-700">
                              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                              {/* Extraer el nombre de la empresa del texto de las notas */}
                              {reservation.notes.split("Transferido desde ")[1]?.split(" (")[0] || "Empresa externa"}
                            </div>
                            <div className="text-xs text-blue-600">
                              Transferencia
                            </div>
                          </div>
                        ) : (
                          // Mostrar el creador normal si no es transferencia
                          reservation.createdByUser ? (
                            <div>
                              <div className="text-sm font-medium text-gray-900">
                                {reservation.createdByUser.firstName} {reservation.createdByUser.lastName}
                              </div>
                              <div className="text-xs text-gray-500">
                                {reservation.createdByUser.role}
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 text-sm">No disponible</span>
                          )
                        )}
                      </td>
                    )}
                    {user?.role === "taquilla" && (
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {getCompanyDisplayName(reservation.companyId || undefined)}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {reservation.companyId || 'N/A'}
                        </div>
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            variant="ghost"
                            className="h-8 w-8 p-0"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-48">
                          <DropdownMenuItem
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedReservationId(reservation.id);
                              setIsDetailsModalOpen(true);
                            }}
                          >
                            <Eye className="mr-2 h-4 w-4" />
                            Ver detalles
                          </DropdownMenuItem>
                          {user?.role !== "taquilla" && (
                            <>
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditModal(reservation);
                                }}
                              >
                                <Edit className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {(reservation.status === 'canceled' || reservation.status === 'canceledAndRefund') ? (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openDeleteConfirm(reservation.id, 'delete');
                                  }}
                                  className="text-red-600"
                                >
                                  <TrashIcon className="mr-2 h-4 w-4" />
                                  Eliminar
                                </DropdownMenuItem>
                              ) : (
                                <>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteConfirm(reservation.id, 'cancel');
                                    }}
                                    className="text-amber-600"
                                  >
                                    <X className="mr-2 h-4 w-4" />
                                    Cancelar
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openDeleteConfirm(reservation.id, 'cancel-refund');
                                    }}
                                    className="text-red-600"
                                  >
                                    <X className="mr-2 h-4 w-4" />
                                    Cancelar con reembolso
                                  </DropdownMenuItem>
                                </>
                              )}
                            </>
                          )}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center p-8 text-gray-500">
              {activeTab === "upcoming"
                ? "No hay reservaciones actuales o futuras disponibles."
                : "No hay reservaciones archivadas disponibles."}
            </div>
          )}
        </div>

        {/* Vista para Móvil: Tarjetas Minimalistas */}
        <div className="md:hidden">
          {isLoading && showLoadingDelay ? (
            <div className="flex justify-center items-center p-8">
              <Loader2Icon className="h-6 w-6 animate-spin text-primary" />
              <span className="ml-2 text-sm">Cargando...</span>
            </div>
          ) : hasError && !isInitialLoad ? (
            <div className="text-center p-6 text-red-500 text-sm">
              Error al cargar las reservaciones.
            </div>
          ) : paginatedReservations && paginatedReservations.length > 0 ? (
            <div className="space-y-4">
              {paginatedReservations.map((reservation) => (
                <div
                  key={reservation.id}
                  className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden cursor-pointer hover:shadow-md transition-shadow duration-200"
                  onClick={() => {
                    setSelectedReservationId(reservation.id);
                    setIsDetailsModalOpen(true);
                  }}
                >
                  {/* Header principal con el nombre de la ruta */}
                  <div className="p-4 pb-3">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {reservation.trip.route.name}
                    </h3>
                    <div className="text-sm text-gray-600 mb-3">
                      {reservation.trip.origin} → {reservation.trip.destination}
                    </div>
                    
                    {/* Información con iconos en filas */}
                    <div className="space-y-2">
                      {/* Fecha */}
                      <div className="flex items-center text-sm text-gray-700">
                        <CalendarIcon className="h-4 w-4 mr-3 text-gray-500" />
                        <span>{formatDate(reservation.trip.departureDate)}</span>
                      </div>
                      
                      {/* Horario */}
                      <div className="flex items-center text-sm text-gray-700">
                        <Clock className="h-4 w-4 mr-3 text-gray-500" />
                        <span>{formatTripTime(reservation.trip.departureTime)} - {formatTripTime(reservation.trip.arrivalTime || "00:00")}</span>
                      </div>
                      
                      {/* Vehículo */}
                      <div className="flex items-center text-sm text-gray-700">
                        <Car className="h-4 w-4 mr-3 text-gray-500" />
                        <span>Sin Unidad Asignada</span>
                      </div>
                      
                      {/* Pasajeros */}
                      <div className="flex items-center text-sm text-gray-700">
                        <Users className="h-4 w-4 mr-3 text-gray-500" />
                        <span>
                          {reservation.passengers.length} pasajero{reservation.passengers.length !== 1 ? 's' : ''}
                          {reservation.passengers[0] && (
                            <span className="ml-1 text-gray-600">
                              ({reservation.passengers[0].firstName} {reservation.passengers[0].lastName}
                              {reservation.passengers.length > 1 && ` +${reservation.passengers.length - 1}`})
                            </span>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500 text-sm">
              {activeTab === "upcoming"
                ? "No hay reservaciones actuales o futuras disponibles."
                : "No hay reservaciones archivadas disponibles."}
            </div>
          )}
        </div>

        {/* Pagination controls */}
        <div className="bg-white px-4 py-3 border-t border-gray-200 sm:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between">
            <div className="text-sm text-gray-700 mb-2 sm:mb-0">
              Showing <span className="font-medium">{startIndex + 1}</span> to <span className="font-medium">{Math.min(endIndex, filteredReservations.length)}</span> of <span className="font-medium">{filteredReservations.length}</span> results
            </div>
            <div className="flex items-center space-x-3">
              <Select onValueChange={handleItemsPerPageChange} value={String(itemsPerPage)}>
                <SelectTrigger className="w-[120px] h-9">
                  <SelectValue placeholder="Items per page" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="5">5 per page</SelectItem>
                  <SelectItem value="10">10 per page</SelectItem>
                  <SelectItem value="20">20 per page</SelectItem>
                  <SelectItem value="50">50 per page</SelectItem>
                </SelectContent>
              </Select>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <span className="text-sm font-medium">Page {currentPage} of {totalPages}</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </Card>

      {/* Modal de detalles de reservación */}
      {selectedReservationId && (
        <ReservationDetailsModal
          reservationId={selectedReservationId}
          isOpen={isDetailsModalOpen}
          onOpenChange={setIsDetailsModalOpen}
        />
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmingDelete !== null} onOpenChange={() => setConfirmingDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmationType === 'cancel' 
                ? 'Cancelar Reservación' 
                : confirmationType === 'cancel-refund'
                ? 'Cancelar con Reembolso'
                : 'Eliminar Reservación'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationType === 'cancel'
                ? "¿Estás seguro que deseas cancelar esta reservación? La reservación quedará registrada en el sistema pero los asientos serán liberados para que otros pasajeros puedan reservarlos."
                : confirmationType === 'cancel-refund'
                ? "¿Estás seguro que deseas cancelar esta reservación con reembolso? Se cancelará la reservación, se liberarán los asientos y se eliminará la transacción asociada sin corte del sistema."
                : "¿Estás seguro que deseas eliminar completamente esta reservación? Esta acción no se puede deshacer y la reservación será eliminada de la base de datos."
              }
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Volver</AlertDialogCancel>
            <AlertDialogAction
              className={confirmationType === 'cancel'
                ? "bg-amber-600 hover:bg-amber-700"
                : "bg-red-600 hover:bg-red-700"
              }
              onClick={handleDeleteConfirm}
            >
              {confirmationType === 'cancel' 
                ? 'Cancelar Reservación' 
                : confirmationType === 'cancel-refund'
                ? 'Cancelar con Reembolso'
                : 'Eliminar Permanentemente'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Reservation Dialog */}
      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="sm:max-w-[500px] p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Reservación</DialogTitle>
            <DialogDescription>
              Actualiza los detalles de esta reservación.
            </DialogDescription>
          </DialogHeader>

          {editingReservation && (
            <div className="grid gap-3 sm:gap-4 py-2 sm:py-4">
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <div>
                  <Label htmlFor="reservation-id" className="text-gray-500 text-xs">CÓDIGO DE RESERVACIÓN</Label>
                  <div id="reservation-id" className="text-sm font-medium">#{generateReservationId(editingReservation?.id || 0)}</div>
                </div>

                <div>
                  <Label htmlFor="created-by" className="text-gray-500 text-xs">CREADA POR</Label>
                  <div id="created-by" className="text-sm">
                    {editingReservation.createdByUser ? (
                      <div className="flex items-center gap-1 text-sm">
                        <UserIcon className="h-3.5 w-3.5 text-primary/70" />
                        <span>{editingReservation.createdByUser.firstName} {editingReservation.createdByUser.lastName}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground">No disponible</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Información de contacto */}
              <div className="space-y-2 sm:space-y-3 mt-1 sm:mt-2">
                <h3 className="text-xs sm:text-sm font-medium border-b pb-1">Información de contacto</h3>

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <Label htmlFor="passenger-name" className="text-gray-500 text-xs">PASAJEROS</Label>
                    <div id="passenger-name" className="text-sm">
                      {editingReservation.passengers[0]?.firstName} {editingReservation.passengers[0]?.lastName}
                      {editingReservation.passengers.length > 1 && ` +${editingReservation.passengers.length - 1}`}
                    </div>
                  </div>
                  <div>
                    <Label htmlFor="seats" className="text-gray-500 text-xs">ASIENTOS</Label>
                    <div id="seats" className="text-sm font-medium">
                      {editingReservation.passengers.length}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="email" className="text-gray-500 text-xs">EMAIL</Label>
                  <div className="relative">
                    <MailIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="pl-8"
                      placeholder="ejemplo@correo.com"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="phone" className="text-gray-500 text-xs">TELÉFONO</Label>
                  <div className="relative">
                    <PhoneIcon className="absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
                    <Input
                      id="phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="pl-8"
                      placeholder="(999) 123-4567"
                    />
                  </div>
                </div>
              </div>

              {/* Información del viaje */}
              <div className="space-y-2 sm:space-y-3 mt-1 sm:mt-2">
                <h3 className="text-xs sm:text-sm font-medium border-b pb-1">Información del viaje</h3>

                <div className="grid grid-cols-1 gap-2">
                  <Label htmlFor="route-info" className="text-gray-500 text-xs">RUTA</Label>
                  <div id="route-info" className="text-sm">
                    {editingReservation.trip.route.name}
                  </div>
                  {/* CORRECTED: Access editingReservation.trip.origin and editingReservation.trip.destination directly */}
                  <div className="text-sm">
                    <span className="text-gray-500">Origen:</span> {editingReservation.trip.origin}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Destino:</span> {editingReservation.trip.destination}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Fecha:</span> {formatDate(editingReservation.trip.departureDate)}
                  </div>
                  <div className="text-sm">
                    <span className="text-gray-500">Hora de salida:</span> {formatTripTime(editingReservation.trip.departureTime, true, 'pretty')}
                  </div>
                </div>
              </div>

              {/* Información de pago */}
              <div className="space-y-2 sm:space-y-3 mt-1 sm:mt-2">
                <h3 className="text-xs sm:text-sm font-medium border-b pb-1">Información de pago</h3>

                {/* Campos editables manteniendo la estructura original */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-gray-500 text-xs font-medium whitespace-nowrap">ANTICIPO:</Label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs">$</span>
                        <Input
                          type="number"
                          value={advanceAmount}
                          onChange={(e) => {
                            const value = e.target.value;
                            const advance = parseFloat(value) || 0;

                            // Validar que el anticipo no sea mayor al total original
                            if (advance > editingReservation.totalAmount) {
                              // No permitir anticipo mayor al total
                              return;
                            }

                            setAdvanceAmount(value);

                            // Si el anticipo cubre el monto original, poner restante en 0
                            if (advance >= editingReservation.totalAmount) {
                              setRemainingAmount("0");
                            } else {
                              // Si el anticipo es menor, calcular el restante automáticamente
                              const remaining = editingReservation.totalAmount - advance;
                              setRemainingAmount(remaining.toString());
                            }
                          }}
                          placeholder="0"
                          className="h-8 w-20 text-xs"
                          min="0"
                          max={editingReservation.totalAmount}
                        />
                      </div>
                    </div>
                    <div className="w-32">
                      <Select
                        value={advancePaymentMethod}
                        onValueChange={setAdvancePaymentMethod}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Método" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="efectivo">Efectivo</SelectItem>
                          <SelectItem value="transferencia">Transferencia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Label className="text-gray-500 text-xs font-medium whitespace-nowrap">RESTA:</Label>
                      <div className="flex items-center gap-1">
                        <span className="text-xs">$</span>
                        <Input
                          type="number"
                          value={remainingAmount}
                          onChange={(e) => {
                            const value = e.target.value;
                            setRemainingAmount(value);
                            // No calculamos automáticamente el anticipo desde aquí
                            // porque el "resta" puede ser mayor al total para exceso de equipaje
                          }}
                          placeholder="0"
                          className="h-8 w-20 text-xs"
                          min="0"
                          // Sin límite máximo para permitir exceso de equipaje
                        />
                      </div>
                    </div>
                    <div className="w-32">
                      <Select
                        value={paymentMethod}
                        onValueChange={setPaymentMethod}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder="Método" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="efectivo">Efectivo</SelectItem>
                          <SelectItem value="transferencia">Transferencia</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                {/* Mostrar el total dinámico */}
                <div className="border-t pt-2">
                  <div className="flex justify-between items-center">
                    <Label className="text-gray-700 font-medium text-sm">TOTAL</Label>
                    <div className="text-lg font-semibold">
                      {formatPrice((parseFloat(advanceAmount) || 0) + (parseFloat(remainingAmount) || 0))}
                      {((parseFloat(advanceAmount) || 0) + (parseFloat(remainingAmount) || 0)) !== editingReservation.totalAmount && (
                        <span className="text-xs text-gray-500 ml-2">
                          (Original: {formatPrice(editingReservation.totalAmount)})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Notas adicionales */}
              <div className="grid grid-cols-1 gap-2 mt-1 sm:mt-2">
                <Label htmlFor="notes" className="text-gray-500 text-xs">NOTAS ADICIONALES</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Instrucciones especiales o detalles adicionales"
                  className="min-h-[60px] sm:min-h-[80px] text-sm"
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2 sm:gap-0">
            <Button className="w-full sm:w-auto order-2 sm:order-1" variant="outline" onClick={closeEditModal}>Cancelar</Button>
            <Button
              className="w-full sm:w-auto order-1 sm:order-2"
              onClick={handleSaveEdit}
              disabled={editReservationMutation.isPending}
            >
              {editReservationMutation.isPending ? (
                <>
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                  Guardando...
                </>
              ) : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}