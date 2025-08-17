import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CalendarIcon, ClockIcon, MapPinIcon, UsersIcon, TruckIcon, DollarSignIcon } from "lucide-react";
import { DefaultLayout } from "@/components/layout/default-layout";
import { formatDate, formatTime } from "@/lib/utils";

interface Transaction {
  id: number;
  type: string;
  amount: number;
  reservationId: number | null;
  passenger: string | null;
  paymentMethod: string | null;
  notes: string | null;
  contact: any;
  origin: string | null;
  destination: string | null;
  createdAt: string;
}

interface TripBudget {
  id: number;
  tripId: number;
  amount: number;
  createdAt: string;
}

interface TripExpense {
  id: number;
  tripId: number;
  type: string;
  amount: number;
  description: string | null;
  createdAt: string;
  createdBy: string | null;
}

interface OperatorTimelineData {
  trips: Array<{
    id: number;
    tripData: any[];
    capacity: number;
    visibility: string;
    companyId: string;
    route: {
      id: number;
      name: string;
      origin: string;
      destination: string;
      stops: string[];
    } | null;
    vehicle: {
      id: number;
      plates: string;
      brand: string;
      model: string;
      capacity: number;
      hasAC: boolean;
      hasRecliningSeats: boolean;
      services: string[];
    } | null;
    driver: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
    transactions: Transaction[]; // Transacciones agrupadas en cada viaje
    budget: TripBudget | null; // Presupuesto del viaje
    expenses: TripExpense[]; // Gastos del viaje
  }>;
  transactions: Array<{
    id: number;
    tripId: number;
    type: string;
    amount: number;
    passenger: string;
    paymentMethod: string;
    notes: string;
    reservationId: number;
    createdAt: string;
    companyId: string;
  }>;
}

export default function OperatorTimelinePage() {
  const [selectedOperator, setSelectedOperator] = useState<string>("");
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");

  // Consultar operadores (usuarios con rol chofer)
  const { data: operators, isLoading: operatorsLoading } = useQuery({
    queryKey: ["/api/operators"],
    queryFn: async () => {
      console.log("[OperatorTimeline] Consultando operadores...");
      const response = await fetch('/api/operators');
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      const data = await response.json();
      console.log("[OperatorTimeline] Operadores recibidos:", data);
      return data;
    }
  });

  // Consultar línea de tiempo del operador
  const { 
    data: timelineData, 
    isLoading: timelineLoading, 
    error: timelineError,
    refetch: refetchTimeline 
  } = useQuery<OperatorTimelineData>({
    queryKey: ["/api/operator-timeline", { operatorId: selectedOperator, startDate, endDate }],
    enabled: !!(selectedOperator && startDate && endDate),
    queryFn: async () => {
      console.log("[OperatorTimeline] Ejecutando consulta de timeline...");
      console.log("[OperatorTimeline] Parámetros:", { selectedOperator, startDate, endDate });
      
      const url = `/api/operator-timeline?operatorId=${selectedOperator}&startDate=${startDate}&endDate=${endDate}`;
      console.log("[OperatorTimeline] URL:", url);
      
      const response = await fetch(url);
      console.log("[OperatorTimeline] Timeline response status:", response.status);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log("[OperatorTimeline] Timeline data recibida:", data);
      return data;
    }
  });

  const handleSearch = () => {
    if (selectedOperator && startDate && endDate) {
      refetchTimeline();
    }
  };

  console.log("[OperatorTimeline] Componente cargado");
  console.log("[OperatorTimeline] Operadores:", operators);
  console.log("[OperatorTimeline] Loading:", timelineLoading);
  console.log("[OperatorTimeline] Error:", timelineError);

  return (
    <DefaultLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Línea de tiempo operador</h1>
        </div>

        {/* Filtros */}
        <Card>
          <CardHeader>
            <CardTitle>Filtros de búsqueda</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="space-y-2">
                <Label htmlFor="operator">Operador</Label>
                <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar operador" />
                  </SelectTrigger>
                  <SelectContent>
                    {operatorsLoading ? (
                      <SelectItem value="loading" disabled>Cargando...</SelectItem>
                    ) : operators && operators.length > 0 ? (
                      operators.map((operator: any) => (
                        <SelectItem key={operator.id} value={operator.id.toString()}>
                          {operator.firstName} {operator.lastName}
                        </SelectItem>
                      ))
                    ) : (
                      <SelectItem value="no-operators" disabled>No hay operadores disponibles</SelectItem>
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="startDate">Fecha inicio</Label>
                <Input
                  id="startDate"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="endDate">Fecha fin</Label>
                <Input
                  id="endDate"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div className="space-y-2 flex items-end">
                <Button 
                  onClick={handleSearch}
                  disabled={!selectedOperator || !startDate || !endDate || timelineLoading}
                  className="w-full"
                >
                  {timelineLoading ? "Consultando..." : "Buscar"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resultados */}
        {timelineError && (
          <Card>
            <CardContent className="text-center py-8">
              <p className="text-red-500">Error al cargar la línea de tiempo: {timelineError.message}</p>
            </CardContent>
          </Card>
        )}

        {timelineData && (
          <div className="space-y-6">
            {/* Resumen financiero expandido */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4">
              <Card>
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Total viajes</p>
                    <p className="text-2xl font-bold">{timelineData.trips.length}</p>
                  </div>
                  <TruckIcon className="h-8 w-8 text-blue-500" />
                </CardContent>
              </Card>

              <Card>
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Transacciones</p>
                    <p className="text-2xl font-bold">
                      {timelineData.trips.reduce((total, trip) => total + (trip.transactions?.length || 0), 0)}
                    </p>
                  </div>
                  <DollarSignIcon className="h-8 w-8 text-green-500" />
                </CardContent>
              </Card>

              {/* Card de ingresos por método de pago */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSignIcon className="h-5 w-5 text-emerald-500" />
                    <p className="text-sm font-medium text-gray-600">Ingresos</p>
                  </div>
                  {(() => {
                    // Calcular totales por método de pago
                    const allTransactions: Transaction[] = timelineData.trips.reduce((acc: Transaction[], trip) => {
                      return acc.concat(trip.transactions || []);
                    }, []);
                    
                    const efectivoTotal = allTransactions
                      .filter((t: Transaction) => t.paymentMethod?.toLowerCase() === 'efectivo')
                      .reduce((sum, t) => sum + (t.amount || 0), 0);
                    
                    const transferenciaTotal = allTransactions
                      .filter((t: Transaction) => t.paymentMethod?.toLowerCase() === 'transferencia')
                      .reduce((sum, t) => sum + (t.amount || 0), 0);
                    
                    const total = allTransactions
                      .reduce((sum, t) => sum + (t.amount || 0), 0);
                    
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Efectivo:</span>
                          <span className="font-medium text-green-600">${efectivoTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Transferencia:</span>
                          <span className="font-medium text-blue-600">${transferenciaTotal.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
                          <span className="font-medium text-gray-800">Total:</span>
                          <span className="font-bold text-emerald-700">${total.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Card de presupuestos */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSignIcon className="h-5 w-5 text-purple-500" />
                    <p className="text-sm font-medium text-gray-600">Presupuestos</p>
                  </div>
                  {(() => {
                    const tripsWithBudget = timelineData.trips.filter(trip => trip.budget);
                    const totalBudget = timelineData.trips.reduce((sum, trip) => 
                      sum + (trip.budget?.amount || 0), 0);
                    
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Viajes con presupuesto:</span>
                          <span className="font-medium">{tripsWithBudget.length}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
                          <span className="font-medium text-gray-800">Total:</span>
                          <span className="font-bold text-purple-700">${totalBudget.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Card de gastos */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <DollarSignIcon className="h-5 w-5 text-red-500" />
                    <p className="text-sm font-medium text-gray-600">Gastos</p>
                  </div>
                  {(() => {
                    const allExpenses = timelineData.trips.reduce((acc: TripExpense[], trip) => {
                      return acc.concat(trip.expenses || []);
                    }, []);
                    
                    const totalExpenses = allExpenses.reduce((sum, expense) => sum + expense.amount, 0);
                    
                    return (
                      <div className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-gray-600">Total registros:</span>
                          <span className="font-medium">{allExpenses.length}</span>
                        </div>
                        <div className="flex justify-between text-sm pt-1 border-t border-gray-200">
                          <span className="font-medium text-gray-800">Total:</span>
                          <span className="font-bold text-red-700">${totalExpenses.toLocaleString()}</span>
                        </div>
                      </div>
                    );
                  })()}
                </CardContent>
              </Card>

              {/* Card de periodo */}
              <Card>
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-3">
                    <CalendarIcon className="h-5 w-5 text-gray-500" />
                    <p className="text-sm font-medium text-gray-600">Periodo</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Desde:</span>
                      <span className="font-medium">{formatDate(startDate)}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-gray-600">Hasta:</span>
                      <span className="font-medium">{formatDate(endDate)}</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Lista de viajes */}
            <Card>
              <CardHeader>
                <CardTitle>Viajes asignados</CardTitle>
              </CardHeader>
              <CardContent>
                {timelineData.trips.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No se encontraron viajes en el periodo seleccionado
                  </div>
                ) : (
                  <div className="space-y-4">
                    {timelineData.trips
                      .sort((a, b) => {
                        const segmentA = a.tripData[0];
                        const segmentB = b.tripData[0];
                        
                        if (!segmentA || !segmentB) return 0;
                        
                        const dateA = segmentA.departureDate || '';
                        const dateB = segmentB.departureDate || '';
                        const timeA = segmentA.departureTime || '';
                        const timeB = segmentB.departureTime || '';
                        
                        // Primero ordenar por fecha
                        const dateDiff = new Date(dateA).getTime() - new Date(dateB).getTime();
                        if (dateDiff !== 0) return dateDiff;
                        
                        // Si las fechas son iguales, ordenar por hora
                        // Convertir formato 12h a 24h para comparar correctamente
                        const convertTo24Hour = (time12h: string) => {
                          const [time, modifier] = time12h.split(' ');
                          if (!time || !modifier) return '';
                          
                          let [hours, minutes] = time.split(':');
                          const hourNum = parseInt(hours, 10);
                          const isPM = modifier.toLowerCase() === 'pm';
                          
                          if (isPM && hourNum !== 12) {
                            hours = (hourNum + 12).toString();
                          } else if (!isPM && hourNum === 12) {
                            hours = '00';
                          }
                          
                          return `${hours.padStart(2, '0')}:${minutes}`;
                        };
                        
                        const time24A = convertTo24Hour(timeA);
                        const time24B = convertTo24Hour(timeB);
                        
                        return time24A.localeCompare(time24B);
                      })
                      .map((trip) => {
                      const firstSegment = trip.tripData[0];
                      if (!firstSegment) return null;

                      return (
                        <div 
                          key={trip.id} 
                          className="border-2 border-blue-300 rounded-lg p-4 hover:bg-gray-50 transition-colors shadow-sm"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">Viaje #{trip.id}</Badge>
                               
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-sm">
                                    <CalendarIcon className="h-4 w-4 text-gray-500" />
                                    <span>{firstSegment.departureDate || 'N/A'}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-sm">
                                    <ClockIcon className="h-4 w-4 text-gray-500" />
                                    <span>{firstSegment.departureTime}</span>
                                  </div>
                                </div>

                                <div className="space-y-1">
                                  <div className="flex items-center gap-2 text-sm">
                                    <UsersIcon className="h-4 w-4 text-gray-500" />
                                    <span>Capacidad: {trip.capacity}</span>
                                  </div>
                                  {trip.vehicle && (
                                    <div className="flex items-center gap-2 text-sm">
                                      <TruckIcon className="h-4 w-4 text-gray-500" />
                                      <span>{trip.vehicle.brand} {trip.vehicle.model} - {trip.vehicle.plates}</span>
                                    </div>
                                  )}
                                </div>
                              </div>

                              <div className="space-y-1">
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPinIcon className="h-4 w-4 text-green-500" />
                                  <span className="font-medium">Origen:</span>
                                  <span>{firstSegment.origin}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm">
                                  <MapPinIcon className="h-4 w-4 text-red-500" />
                                  <span className="font-medium">Destino:</span>
                                  <span>{firstSegment.destination}</span>
                                </div>
                              </div>

                              {/* Resumen financiero detallado del viaje */}
                              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 mt-3">
                                <div className="flex items-center justify-between mb-3">
                                  <span className="font-medium text-sm text-gray-700">Resumen financiero</span>
                                  <span className="text-lg font-bold text-green-600">
                                    ${trip.transactions?.reduce((sum, t) => sum + (t.amount || 0), 0).toLocaleString() || '0'} MXN
                                  </span>
                                </div>

                                {/* Desglose de ingresos por método de pago */}
                                {trip.transactions && trip.transactions.length > 0 && (
                                  <div className="grid grid-cols-2 gap-3 mb-3">
                                    <div className="bg-green-50 border border-green-200 rounded p-2">
                                      <div className="text-xs text-gray-600 mb-1">Efectivo</div>
                                      <div className="font-bold text-green-700">
                                        ${trip.transactions
                                          .filter((t: Transaction) => t.paymentMethod?.toLowerCase() === 'efectivo')
                                          .reduce((sum, t) => sum + (t.amount || 0), 0)
                                          .toLocaleString()}
                                      </div>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-200 rounded p-2">
                                      <div className="text-xs text-gray-600 mb-1">Transferencia</div>
                                      <div className="font-bold text-blue-700">
                                        ${trip.transactions
                                          .filter((t: Transaction) => t.paymentMethod?.toLowerCase() === 'transferencia')
                                          .reduce((sum, t) => sum + (t.amount || 0), 0)
                                          .toLocaleString()}
                                      </div>
                                    </div>
                                  </div>
                                )}

                                {/* Presupuesto del viaje */}
                                {trip.budget && (
                                  <div className="bg-purple-50 border border-purple-200 rounded p-2 mb-2">
                                    <div className="text-xs text-gray-600 mb-1">Presupuesto asignado</div>
                                    <div className="font-bold text-purple-700">
                                      ${trip.budget.amount.toLocaleString()} MXN
                                    </div>
                                  </div>
                                )}

                                {/* Gastos del viaje - Lista individual */}
                                {trip.expenses && trip.expenses.length > 0 && (
                                  <div className="bg-red-50 border border-red-200 rounded p-2 mb-2">
                                    <div className="text-xs text-gray-600 mb-2">
                                      Gastos ({trip.expenses.length} registr{trip.expenses.length > 1 ? 'os' : 'o'})
                                    </div>
                                    <div className="space-y-1">
                                      {trip.expenses.map((expense, index) => (
                                        <div key={expense.id} className="flex justify-between items-center text-xs bg-white rounded p-1.5 border border-red-100">
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium text-red-700 capitalize">{expense.type}</span>
                                            {expense.description && (
                                              <span className="text-gray-500">- {expense.description}</span>
                                            )}
                                          </div>
                                          <span className="font-bold text-red-700">${expense.amount.toLocaleString()}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}

                                {trip.transactions && trip.transactions.length > 0 && (
                                  <div className="text-xs text-gray-500 mt-2">
                                    {trip.transactions.length} transacción{trip.transactions.length > 1 ? 'es' : ''}
                                  </div>
                                )}
                              </div>

                              {/* Transacciones asociadas a este viaje */}
                              {trip.transactions && trip.transactions.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-gray-200">
                                  <div className="flex items-center gap-2 mb-3">
                                    <DollarSignIcon className="h-4 w-4 text-green-500" />
                                    <span className="font-medium text-sm">Actividad financiera ({trip.transactions.length})</span>
                                  </div>
                                  <div className="space-y-2">
                                    {trip.transactions.map((transaction) => (
                                      <div 
                                        key={transaction.id}
                                        className="bg-green-50 border border-green-200 rounded p-3 text-sm"
                                      >
                                        <div className="flex items-start justify-between mb-2">
                                          <div className="flex items-center gap-2">
                                            <Badge variant="outline" className="text-xs">
                                              Trans #{transaction.id}
                                            </Badge>
                                            {transaction.reservationId && (
                                              <Badge 
                                                variant="default" 
                                                className={`text-xs ${
                                                  transaction.type === 'package' 
                                                    ? 'bg-orange-500 hover:bg-orange-600 text-white' 
                                                    : 'bg-blue-500 hover:bg-blue-600 text-white'
                                                }`}
                                              >
                                                {transaction.type === 'package' ? 'Paquetería' : 'Reserva'} #{transaction.reservationId}
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="font-semibold text-green-600">
                                            ${transaction.amount.toLocaleString()} MXN
                                          </div>
                                        </div>
                                        
                                        <div className="space-y-1 text-xs text-gray-600">
                                          {/* Mostrar información específica para paqueterías */}
                                          {transaction.type === 'package' ? (
                                            <>
                                              {/* Información de envío */}
                                              {transaction.origin && (
                                                <div className="flex items-center gap-1">
                                                  <MapPinIcon className="h-3 w-3 text-green-500" />
                                                  <span className="font-medium">Origen:</span> 
                                                  <span className="truncate">{transaction.origin}</span>
                                                </div>
                                              )}
                                              {transaction.destination && (
                                                <div className="flex items-center gap-1">
                                                  <MapPinIcon className="h-3 w-3 text-red-500" />
                                                  <span className="font-medium">Destino:</span> 
                                                  <span className="truncate">{transaction.destination}</span>
                                                </div>
                                              )}
                                              
                                              {/* Remitente y Destinatario */}
                                              <div className="grid grid-cols-2 gap-2 mt-2 p-2 bg-orange-50 rounded border border-orange-100">
                                                <div>
                                                  <span className="font-medium text-orange-700">Remitente:</span>
                                                  <div className="text-xs text-gray-700 mt-0.5">{(transaction as any).remitente || 'No especificado'}</div>
                                                </div>
                                                <div>
                                                  <span className="font-medium text-orange-700">Destinatario:</span>
                                                  <div className="text-xs text-gray-700 mt-0.5">{(transaction as any).destinatario || 'No especificado'}</div>
                                                </div>
                                              </div>
                                              
                                              {/* Descripción del paquete */}
                                              {(transaction as any).descripcion && (
                                                <div className="mt-2 p-2 bg-gray-50 rounded border">
                                                  <span className="font-medium">Descripción:</span>
                                                  <div className="text-xs text-gray-700 mt-0.5">{(transaction as any).descripcion}</div>
                                                </div>
                                              )}
                                              
                                              {/* Método de pago */}
                                              {transaction.paymentMethod && (
                                                <div>
                                                  <span className="font-medium">Método de pago:</span> {transaction.paymentMethod}
                                                </div>
                                              )}
                                            </>
                                          ) : (
                                            <>
                                              {/* Información para reservas normales */}
                                              {transaction.passenger && (
                                                <div>
                                                  <span className="font-medium">Pasajero:</span> {transaction.passenger}
                                                </div>
                                              )}
                                              {transaction.paymentMethod && (
                                                <div>
                                                  <span className="font-medium">Método:</span> {transaction.paymentMethod}
                                                </div>
                                              )}
                                              
                                              {/* Origen y Destino de la reserva */}
                                              {transaction.origin && (
                                                <div className="flex items-center gap-1">
                                                  <MapPinIcon className="h-3 w-3 text-green-500" />
                                                  <span className="font-medium">Origen:</span> 
                                                  <span className="truncate">{transaction.origin}</span>
                                                </div>
                                              )}
                                              {transaction.destination && (
                                                <div className="flex items-center gap-1">
                                                  <MapPinIcon className="h-3 w-3 text-red-500" />
                                                  <span className="font-medium">Destino:</span> 
                                                  <span className="truncate">{transaction.destination}</span>
                                                </div>
                                              )}
                                            </>
                                          )}
                                          
                                          <div className="text-xs text-gray-500 mt-1">
                                            <span className="font-medium">Creada:</span> {
                                              transaction.createdAt ? (() => {
                                                // Asegurar que la fecha se trate como UTC
                                                const dateStr = transaction.createdAt.toString();
                                                const utcDate = dateStr.includes('Z') ? 
                                                  new Date(dateStr) : 
                                                  new Date(dateStr + 'Z');
                                                
                                                const formattedDate = utcDate.toLocaleDateString('es-MX', {
                                                  timeZone: 'America/Mexico_City'
                                                });
                                                const formattedTime = utcDate.toLocaleTimeString('es-MX', { 
                                                  hour: '2-digit', 
                                                  minute: '2-digit', 
                                                  hour12: true,
                                                  timeZone: 'America/Mexico_City'
                                                });
                                                return `${formattedDate} a las ${formattedTime}`;
                                              })() : 'N/A'
                                            }
                                          </div>
                                        </div>
                                        
                                        {transaction.notes && (
                                          <div className="text-xs text-gray-500 mt-1 bg-white p-1.5 rounded border">
                                            {transaction.notes}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>

                          
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Lista de transacciones */}
            {timelineData.transactions.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Actividad de transacciones</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {timelineData.transactions.map((transaction) => (
                      <div 
                        key={transaction.id} 
                        className="border rounded-lg p-4 bg-green-50 border-green-200"
                      >
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">Transacción #{transaction.id}</Badge>
                              <Badge variant="default">Reservación #{transaction.reservationId}</Badge>
                              <Badge variant="secondary">Viaje #{transaction.tripId}</Badge>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1">
                                <div className="text-sm">
                                  <span className="font-medium">Pasajero:</span> {transaction.passenger}
                                </div>
                                <div className="text-sm">
                                  <span className="font-medium">Monto:</span> ${transaction.amount.toLocaleString()} MXN
                                </div>
                              </div>
                              
                              <div className="space-y-1">
                                <div className="text-sm">
                                  <span className="font-medium">Método de pago:</span> {transaction.paymentMethod}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {transaction.createdAt ? (() => {
                                    // Asegurar que la fecha se trate como UTC
                                    const dateStr = transaction.createdAt.toString();
                                    const utcDate = dateStr.includes('Z') ? 
                                      new Date(dateStr) : 
                                      new Date(dateStr + 'Z');
                                    
                                    const formattedDate = utcDate.toLocaleDateString('es-MX', {
                                      timeZone: 'America/Mexico_City'
                                    });
                                    const formattedTime = utcDate.toLocaleTimeString('es-MX', { 
                                      hour: '2-digit', 
                                      minute: '2-digit', 
                                      hour12: true,
                                      timeZone: 'America/Mexico_City'
                                    });
                                    return `${formattedDate} - ${formattedTime}`;
                                  })() : 'N/A'}
                                </div>
                              </div>
                            </div>
                            
                            {transaction.notes && (
                              <div className="text-xs text-gray-600 bg-white p-2 rounded border">
                                <span className="font-medium">Notas:</span> {transaction.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}

        {!timelineData && !timelineLoading && !timelineError && (
          <Card>
            <CardContent className="text-center py-12">
              <div className="text-gray-500">
                <CalendarIcon className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Selecciona un operador y rango de fechas para ver su línea de tiempo</p>
                <p className="text-sm mt-2">Utiliza los filtros arriba para comenzar la búsqueda.</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DefaultLayout>
  );
}