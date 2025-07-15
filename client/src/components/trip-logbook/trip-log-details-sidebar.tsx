import { useState, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { X, DollarSign, Package, Users, PlusCircle, MinusCircle, Calculator, Loader2, Trash2, MapPin, Clock, CheckCircle, XCircle, CreditCard, AlertCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { useToast } from "@/hooks/use-toast";

type TripLogData = {
  recordId: number;
  tripInfo: any;
  reservations: any[];
  packages: any[];
  totalSales: number;
  totalExpenses: number;
  netProfit: number;
};

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

interface TripLogDetailsSidebarProps {
  tripData: TripLogData;
  onClose: () => void;
}

export function TripLogDetailsSidebar({ tripData, onClose }: TripLogDetailsSidebarProps): JSX.Element {
  const [budget, setBudget] = useState<number>(0);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [newExpense, setNewExpense] = useState<Expense>({
    id: '',
    tripId: tripData.recordId,
    amount: 0,
    type: '',
    description: ''
  });

  const [isLoadingBudget, setIsLoadingBudget] = useState(false);
  const [isLoadingExpenses, setIsLoadingExpenses] = useState(false);
  const [isSavingBudget, setIsSavingBudget] = useState(false);
  const [isSavingExpense, setIsSavingExpense] = useState(false);
  const [isRemovingExpense, setIsRemovingExpense] = useState<number | null>(null);
  
  // Estados para modales de confirmación
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const { toast } = useToast();

  // Cargar presupuesto y gastos al abrir el sidebar
  useEffect(() => {
    loadBudget();
    loadExpenses();
  }, [tripData.recordId]);

  const loadBudget = async () => {
    setIsLoadingBudget(true);
    try {
      const response = await fetch(`/api/trips/${tripData.recordId}/budget`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setBudget(data.amount || 0);
      }
    } catch (error) {
      console.error('Error al cargar presupuesto:', error);
    } finally {
      setIsLoadingBudget(false);
    }
  };

  const loadExpenses = async () => {
    setIsLoadingExpenses(true);
    try {
      const response = await fetch(`/api/trips/${tripData.recordId}/expenses`, {
        credentials: 'include'
      });
      
      if (response.ok) {
        const data = await response.json();
        setExpenses(Array.isArray(data) ? data : []);
      }
    } catch (error) {
      console.error('Error al cargar gastos:', error);
    } finally {
      setIsLoadingExpenses(false);
    }
  };

  const saveBudget = async () => {
    setIsSavingBudget(true);
    try {
      const response = await fetch(`/api/trips/${tripData.recordId}/budget`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: budget }),
        credentials: 'include'
      });

      if (response.ok) {
        setShowBudgetModal(true);
        setTimeout(() => setShowBudgetModal(false), 2000);
      } else {
        throw new Error('Error al guardar presupuesto');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo guardar el presupuesto.",
        variant: "destructive"
      });
    } finally {
      setIsSavingBudget(false);
    }
  };

  const addExpense = async () => {
    if (!newExpense.type || newExpense.amount <= 0) return;

    setIsSavingExpense(true);
    try {
      const response = await fetch(`/api/trips/${tripData.recordId}/expenses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newExpense.type,
          amount: newExpense.amount,
          description: newExpense.description,
          tripId: tripData.recordId
        }),
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        setExpenses(prev => [...prev, data]);
        setNewExpense({
          id: '',
          tripId: tripData.recordId,
          amount: 0,
          type: '',
          description: ''
        });
        
        setShowExpenseModal(true);
        setTimeout(() => setShowExpenseModal(false), 2000);
      } else {
        throw new Error('Error al agregar gasto');
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "No se pudo agregar el gasto.",
        variant: "destructive"
      });
    } finally {
      setIsSavingExpense(false);
    }
  };

  const removeExpense = async (expenseId: number) => {
    setIsRemovingExpense(expenseId);
    try {
      const response = await fetch(`/api/trips/expenses/remove`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ expenseId }),
        credentials: 'include'
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
        description: "No se pudo eliminar el gasto.",
        variant: "destructive"
      });
    } finally {
      setIsRemovingExpense(null);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    
    // Crear fecha usando componentes locales para evitar problemas de timezone
    const date = new Date(dateString + 'T00:00:00');
    
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${day}/${month}/${year}`;
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    
    // Extraer solo la hora (HH:MM) sin segundos
    const timeParts = timeString.split(':');
    if (timeParts.length < 2) return timeString;
    
    const hours = parseInt(timeParts[0]);
    const minutes = parseInt(timeParts[1]);
    
    if (isNaN(hours) || isNaN(minutes)) return timeString;
    
    // Convertir a formato 12 horas
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;
    
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  };

  const getPaymentStatusBadge = (status: string) => {
    switch (status) {
      case 'pagado':
        return <Badge className="bg-green-100 text-green-800">Pagado</Badge>;
      case 'anticipo':
        return <Badge className="bg-yellow-100 text-yellow-800">Anticipo</Badge>;
      case 'pendiente':
        return <Badge className="bg-gray-100 text-gray-800">Pendiente</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const totalExpenses = expenses.reduce((sum, expense) => sum + expense.amount, 0);
  
  // Calcular ventas reales vs total por vender para este viaje
  const ventasReales = useMemo(() => {
    let ventas = 0;
    let totalPorVender = 0;
    
    // Calcular de reservaciones
    tripData.reservations.forEach((reservation: any) => {
      totalPorVender += reservation.totalAmount;
      const advanceAmount = reservation.advanceAmount || 0;
      ventas += advanceAmount;
    });
    
    // Calcular de paqueterías
    tripData.packages.forEach((pkg: any) => {
      totalPorVender += pkg.price || 0;
      ventas += pkg.price || 0; // Asumir que paqueterías están pagadas
    });
    
    return { ventas, totalPorVender };
  }, [tripData.reservations, tripData.packages]);
  
  const netProfit = ventasReales.ventas - totalExpenses;
  const budgetVariance = budget > 0 ? ((totalExpenses - budget) / budget) * 100 : 0;

  // Obtener información del viaje padre para horarios
  const parentTripInfo = tripData.tripInfo.parentTrip || tripData.tripInfo;

  const sidebarContent = (
    <div className="fixed inset-0 z-[9999] flex" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}>
      {/* Overlay */}
      <div 
        className="flex-1 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Sidebar principal */}
      <div className="w-1/2 min-w-[400px] bg-white shadow-2xl flex flex-col h-full border-l-2 border-gray-200 relative">
        {/* Header fijo */}
        <div className="flex items-center justify-between p-6 border-b bg-white">
          <div>
            <h2 className="text-xl font-semibold">Detalles Financieros</h2>
            <p className="text-sm text-gray-600">
              {parentTripInfo.origin} → {parentTripInfo.destination}
            </p>
            <p className="text-xs text-gray-500">
              {parentTripInfo.departureTime} - {parentTripInfo.arrivalTime}
            </p>
          </div>
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Resumen financiero fijo */}
        <div className="p-6 border-b bg-gray-50">
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-sm text-gray-600">Ventas</p>
              <p className="text-xl font-bold">
                <span className={ventasReales.ventas === ventasReales.totalPorVender ? 'text-green-600' : 'text-gray-500'}>
                  {formatCurrency(ventasReales.ventas)}
                </span>
                <span className="text-gray-400"> / </span>
                <span className="text-green-600">
                  {formatCurrency(ventasReales.totalPorVender)}
                </span>
              </p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Gastos Totales</p>
              <p className="text-xl font-bold text-red-600">{formatCurrency(totalExpenses)}</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600">Ganancia Neta</p>
              <p className={`text-xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(netProfit)}
              </p>
            </div>
          </div>
        </div>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-hidden">
          <Tabs defaultValue="reservations" className="h-full flex flex-col">
            <TabsList className="grid w-full grid-cols-3 bg-white border-b">
              <TabsTrigger value="reservations">
                <Users className="h-4 w-4 mr-2" />
                Reservaciones ({tripData.reservations.length})
              </TabsTrigger>
              <TabsTrigger value="packages">
                <Package className="h-4 w-4 mr-2" />
                Paqueterías ({tripData.packages.length})
              </TabsTrigger>
              <TabsTrigger value="finances">
                <Calculator className="h-4 w-4 mr-2" />
                Finanzas
              </TabsTrigger>
            </TabsList>

            <div className="flex-1 overflow-y-auto">
              <TabsContent value="reservations" className="p-6 space-y-3 m-0">
                {tripData.reservations.map((reservation: any) => {
                  // Calcular el restante
                  const advanceAmount = reservation.advanceAmount || 0;
                  const remainingAmount = reservation.totalAmount - advanceAmount;
                  const seatCount = reservation.seatCount || reservation.passengers?.length || 1;
                  
                  // Determinar estado de pago
                  let paymentStatus = 'pendiente';
                  if (advanceAmount > 0 && remainingAmount > 0) {
                    paymentStatus = 'anticipo';
                  } else if (advanceAmount > 0 && remainingAmount === 0) {
                    paymentStatus = 'pagado';
                  }
                  
                  return (
                  <div key={reservation.id} className="border rounded-lg p-3 bg-white shadow-sm">
                    {/* Header con información básica */}
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">Reservación #{reservation.id}</p>
                        <p className="text-sm text-gray-600">{reservation.phone}</p>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-base">
                          {formatCurrency(reservation.totalAmount)}
                        </div>
                        {getPaymentStatusBadge(paymentStatus)}
                      </div>
                    </div>

                    {/* Información del viaje en una sola sección */}
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4 text-blue-600" />
                        <span className="font-medium">Asientos:</span>
                        <span>{seatCount}</span>
                        <span className="text-gray-300">|</span>
                        <MapPin className="h-4 w-4 text-green-600" />
                        <span className="font-medium">Ruta:</span>
                        <span>{reservation.trip?.origin || 'N/A'} → {reservation.trip?.destination || 'N/A'}</span>
                      </div>
                      
                      <div className="flex items-center gap-2">
                        <Clock className="h-4 w-4 text-orange-600" />
                        <span className="font-medium">Salida:</span>
                        <span>
                          {formatDate(reservation.trip?.departureDate || '')} - {formatTime(reservation.trip?.departureTime || '')}
                        </span>
                        <span className="text-gray-300">|</span>
                        {reservation.checkedIn ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                        <span className={`font-medium ${reservation.checkedIn ? 'text-green-600' : 'text-red-600'}`}>
                          {reservation.checkedIn ? 'Confirmado' : 'Pendiente'}
                        </span>
                      </div>

                      {/* Información de pago */}
                      <div className="flex items-center gap-2 text-sm">
                        <CreditCard className="h-4 w-4 text-purple-600" />
                        <span className="font-medium">Pago:</span>
                        
                        {/* Anticipo (si existe) */}
                        {advanceAmount > 0 && (
                          <span>
                            <span className="text-green-600 font-medium">Anticipo: {formatCurrency(advanceAmount)}</span>
                            <span className="text-gray-500 ml-1">({reservation.advancePaymentMethod})</span>
                          </span>
                        )}
                        
                        {/* Restante (si existe) */}
                        {remainingAmount > 0 && (
                          <span>
                            <span className="text-gray-300 mx-1">|</span>
                            <span className="text-blue-600 font-medium">Restante: {formatCurrency(remainingAmount)}</span>
                            <span className="text-gray-500 ml-1">({reservation.paymentMethod})</span>
                          </span>
                        )}
                        
                        {/* Si está totalmente pagado */}
                        {advanceAmount > 0 && remainingAmount === 0 && (
                          <span className="text-green-600 font-medium">Pagado completo</span>
                        )}
                      </div>
                    </div>
                    
                    {/* Lista de pasajeros */}
                    {reservation.passengers && reservation.passengers.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="text-sm font-medium mb-1 flex items-center gap-2">
                          <Users className="h-4 w-4 text-blue-600" />
                          Pasajeros ({reservation.passengers.length}):
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {reservation.passengers.map((passenger: any, idx: number) => (
                            <span key={idx} className="text-sm text-gray-700 bg-gray-100 px-2 py-1 rounded">
                              {passenger.firstName} {passenger.lastName}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  );
                })}
                
                {tripData.reservations.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <p>No hay reservaciones para este viaje</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="packages" className="p-6 space-y-4 m-0">
                {tripData.packages.map((pkg: any) => (
                  <div key={pkg.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">Paquete #{pkg.id}</p>
                        <p className="text-sm text-gray-600">
                          {pkg.senderName} → {pkg.recipientName}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(pkg.price)}</p>
                        <Badge className="bg-green-100 text-green-800">Pagado</Badge>
                      </div>
                    </div>
                    <p className="text-sm text-gray-600">{pkg.packageDescription}</p>
                  </div>
                ))}
                
                {tripData.packages.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay paqueterías para este viaje
                  </div>
                )}
              </TabsContent>

              <TabsContent value="finances" className="p-6 space-y-6 m-0">
                {/* Gestión de presupuesto */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Presupuesto del Viaje
                  </h3>
                  
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label htmlFor="budget">Presupuesto</Label>
                      <Input
                        id="budget"
                        type="number"
                        value={budget}
                        onChange={(e) => setBudget(Number(e.target.value))}
                        placeholder="Ingrese el presupuesto"
                      />
                    </div>
                    <Button 
                      onClick={saveBudget} 
                      disabled={isSavingBudget || isLoadingBudget}
                      className="mt-6"
                    >
                      {isSavingBudget && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Guardar
                    </Button>
                  </div>

                  {budget > 0 && (
                    <div className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between text-sm">
                        <span>Presupuesto:</span>
                        <span>{formatCurrency(budget)}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span>Gastado:</span>
                        <span>{formatCurrency(totalExpenses)}</span>
                      </div>
                      <div className="flex justify-between text-sm font-medium">
                        <span>Variación:</span>
                        <span className={budgetVariance > 0 ? 'text-red-600' : 'text-green-600'}>
                          {budgetVariance > 0 ? '+' : ''}{budgetVariance.toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Gestión de gastos */}
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2">
                    <MinusCircle className="h-5 w-5" />
                    Gastos del Viaje
                  </h3>

                  {/* Formulario para agregar gasto */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label htmlFor="expense-type">Categoría</Label>
                      <select
                        id="expense-type"
                        value={newExpense.type}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, type: e.target.value }))}
                        className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        <option value="none">Seleccionar categoría</option>
                        <option value="gasolina">Gasolina</option>
                        <option value="casetas">Casetas</option>
                        <option value="otros">Otros</option>
                      </select>
                    </div>
                    
                    <div>
                      <Label htmlFor="expense-amount">Monto</Label>
                      <Input
                        id="expense-amount"
                        type="number"
                        value={newExpense.amount}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, amount: Number(e.target.value) }))}
                        placeholder="0.00"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <Label htmlFor="expense-description">Descripción (opcional)</Label>
                      <Input
                        id="expense-description"
                        value={newExpense.description || ''}
                        onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                        placeholder="Descripción del gasto"
                      />
                    </div>
                    
                    <div className="col-span-2">
                      <Button 
                        onClick={addExpense} 
                        disabled={isSavingExpense || !newExpense.type || newExpense.amount <= 0}
                        className="w-full"
                      >
                        {isSavingExpense && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        <PlusCircle className="h-4 w-4 mr-2" />
                        Agregar Gasto
                      </Button>
                    </div>
                  </div>

                  {/* Lista de gastos */}
                  <div className="space-y-2 max-h-60 overflow-auto">
                    {isLoadingExpenses ? (
                      <div className="text-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                      </div>
                    ) : expenses.length > 0 ? (
                      expenses.map((expense) => (
                        <div key={expense.id} className="flex justify-between items-center p-3 border rounded-lg">
                          <div>
                            <p className="font-medium capitalize">{expense.type}</p>
                            {expense.description && (
                              <p className="text-sm text-gray-600">{expense.description}</p>
                            )}
                            {expense.createdBy && (
                              <p className="text-xs text-gray-500">Por: {expense.createdBy}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold">{formatCurrency(expense.amount)}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeExpense(expense.id as number)}
                              disabled={isRemovingExpense === expense.id}
                            >
                              {isRemovingExpense === expense.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </div>
                      ))
                    ) : (
                      <div className="text-center py-8 text-gray-500">
                        No hay gastos registrados para este viaje
                      </div>
                    )}
                  </div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  );

  // Modales personalizados con z-index superior
  const budgetModal = showBudgetModal && (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowBudgetModal(false)} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 z-[10002]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-green-600 mb-2">¡Presupuesto Guardado!</h3>
          <p className="text-gray-600 mb-4">El presupuesto se ha actualizado correctamente.</p>
          <div className="flex justify-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const expenseModal = showExpenseModal && (
    <div className="fixed inset-0 z-[10001] flex items-center justify-center">
      <div className="fixed inset-0 bg-black bg-opacity-50" onClick={() => setShowExpenseModal(false)} />
      <div className="relative bg-white rounded-lg shadow-xl p-6 max-w-md mx-4 z-[10002]">
        <div className="text-center">
          <h3 className="text-lg font-semibold text-green-600 mb-2">¡Gasto Agregado!</h3>
          <p className="text-gray-600 mb-4">El gasto se ha registrado correctamente.</p>
          <div className="flex justify-center py-4">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
              <PlusCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {createPortal(sidebarContent, document.body)}
      {budgetModal && createPortal(budgetModal, document.body)}
      {expenseModal && createPortal(expenseModal, document.body)}
    </>
  );
}