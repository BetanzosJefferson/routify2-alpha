import { useState, useEffect } from "react";
import { X, DollarSign, Package, Users, PlusCircle, MinusCircle, Calculator, Loader2, Trash2 } from "lucide-react";
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

export function TripLogDetailsSidebar({ tripData, onClose }: TripLogDetailsSidebarProps) {
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
        toast({
          title: "Presupuesto guardado",
          description: "El presupuesto se ha actualizado correctamente.",
        });
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
  const netProfit = tripData.totalSales - totalExpenses;
  const budgetVariance = budget > 0 ? ((totalExpenses - budget) / budget) * 100 : 0;

  // Obtener información del viaje padre para horarios
  const parentTripInfo = tripData.tripInfo.parentTrip || tripData.tripInfo;

  return (
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
              <p className="text-sm text-gray-600">Ventas Totales</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(tripData.totalSales)}</p>
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
              <TabsContent value="reservations" className="p-6 space-y-4 m-0">
                {tripData.reservations.map((reservation: any) => (
                  <div key={reservation.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <p className="font-medium">Reservación #{reservation.id}</p>
                        <p className="text-sm text-gray-600">{reservation.phone}</p>
                      </div>
                      <div className="text-right">
                        <p className="font-bold">{formatCurrency(reservation.totalAmount)}</p>
                        {getPaymentStatusBadge(reservation.paymentStatus)}
                      </div>
                    </div>
                    {reservation.passengers && reservation.passengers.length > 0 && (
                      <div className="mt-2">
                        <p className="text-sm font-medium">Pasajeros:</p>
                        <ul className="text-sm text-gray-600">
                          {reservation.passengers.map((passenger: any, idx: number) => (
                            <li key={idx}>{passenger.firstName} {passenger.lastName}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                ))}
                
                {tripData.reservations.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No hay reservaciones para este viaje
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
                      <Select 
                        value={newExpense.type} 
                        onValueChange={(value) => setNewExpense(prev => ({ ...prev, type: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar categoría" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="combustible">Combustible</SelectItem>
                          <SelectItem value="mantenimiento">Mantenimiento</SelectItem>
                          <SelectItem value="peajes">Peajes</SelectItem>
                          <SelectItem value="comida">Comida</SelectItem>
                          <SelectItem value="hospedaje">Hospedaje</SelectItem>
                          <SelectItem value="otros">Otros</SelectItem>
                        </SelectContent>
                      </Select>
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
}