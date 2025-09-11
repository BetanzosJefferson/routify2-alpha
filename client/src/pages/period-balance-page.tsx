import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import * as Collapsible from '@radix-ui/react-collapsible';
import { CalendarDays, DollarSign, TrendingUp, TrendingDown, Receipt, User, Calendar, MapPin, Clock, Car, FileText, ChevronDown, ChevronUp } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DefaultLayout } from '@/components/layout/default-layout';

interface PeriodBalanceData {
  income: number;
  expenses: number;
  balance: number;
  transactionCount: number;
  expenseBreakdown: Array<{
    category: string;
    concept: string;
    amount: number;
    proportionalAmount: number;
  }>;
  transactions: Array<{
    id: number;
    details: any;
    createdAt: string;
    createdBy: {
      id: number;
      name: string;
    };
    amount: number;
  }>;
  tripsCount: number;
  trips: Array<{
    id: number;
    tripData: any[];
    operator?: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
    } | null;
    expenses: Array<{
      id: number;
      tripId: number;
      type: string;
      amount: number;
      description?: string;
      createdAt: string;
    }>;
  }>;
  tripExpenses: Array<{
    id: number;
    tripId: number;
    type: string;
    amount: number;
    description?: string;
    createdAt: string;
  }>;
  totalTripExpenses: number;
}

function PeriodBalancePageContent() {
  const { user } = useAuth();
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  // Estados para controlar los dropdowns
  const [isExpensesExpanded, setIsExpensesExpanded] = useState(true);
  const [isTransactionsExpanded, setIsTransactionsExpanded] = useState(true);
  const [isTripExpensesExpanded, setIsTripExpensesExpanded] = useState(true);

  // Generar valores por defecto para las fechas
  const generateDefaultDates = () => {
    const now = new Date();
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    const formatDateTime = (date: Date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    if (!startDateTime) setStartDateTime(formatDateTime(startOfDay));
    if (!endDateTime) setEndDateTime(formatDateTime(endOfDay));
  };

  // Query para obtener datos del balance por periodo
  const { data: periodBalance, refetch, isLoading } = useQuery<PeriodBalanceData>({
    queryKey: ['/api/period-balance', startDateTime, endDateTime],
    queryFn: async () => {
      if (!startDateTime || !endDateTime) {
        throw new Error('Se requieren fechas de inicio y fin');
      }
      
      const params = new URLSearchParams({
        startDateTime: startDateTime,
        endDateTime: endDateTime
      });
      
      const response = await fetch(`/api/period-balance?${params}`, {
        credentials: 'include'
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al obtener balance por periodo');
      }
      
      return response.json();
    },
    enabled: false, // Solo ejecutar manualmente
  });

  const handleAnalyze = async () => {
    if (!startDateTime || !endDateTime) {
      alert('Por favor selecciona ambas fechas');
      return;
    }

    if (new Date(startDateTime) >= new Date(endDateTime)) {
      alert('La fecha de inicio debe ser anterior a la fecha de fin');
      return;
    }

    console.log('Analizando periodo:', { startDateTime, endDateTime });
    setIsAnalyzing(true);
    
    try {
      const result = await refetch();
      console.log('Resultado del análisis:', result);
      
      if (result.error) {
        console.error('Error en el análisis:', result.error);
        alert(`Error: ${result.error.message}`);
      }
    } catch (error) {
      console.error('Error al analizar periodo:', error);
      alert(`Error: ${error.message || 'Error desconocido'}`);
    }
    
    setIsAnalyzing(false);
  };

  // Calcular horas totales en el rango
  const getTotalHours = () => {
    if (!startDateTime || !endDateTime) return 0;
    const start = new Date(startDateTime);
    const end = new Date(endDateTime);
    return Math.abs(end.getTime() - start.getTime()) / (1000 * 60 * 60);
  };

  // Inicializar fechas por defecto
  if (!startDateTime || !endDateTime) {
    generateDefaultDates();
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Balance por Periodo</h1>
        <p className="text-muted-foreground">
          Analiza ingresos y gastos en rangos específicos de fecha y hora
        </p>
      </div>

      {/* Selector de fechas */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5" />
            Seleccionar Periodo
          </CardTitle>
          <CardDescription>
            Elige el rango de fecha y hora para analizar (Zona horaria: CDMX)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="start-date">Fecha y Hora de Inicio</Label>
              <Input
                id="start-date"
                type="datetime-local"
                value={startDateTime}
                onChange={(e) => setStartDateTime(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end-date">Fecha y Hora de Fin</Label>
              <Input
                id="end-date"
                type="datetime-local"
                value={endDateTime}
                onChange={(e) => setEndDateTime(e.target.value)}
              />
            </div>
          </div>
          
          {startDateTime && endDateTime && (
            <div className="text-sm text-muted-foreground">
              <p>Periodo seleccionado: {getTotalHours().toFixed(1)} horas</p>
              <p>
                Desde: {new Date(startDateTime).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })} hasta{' '}
                {new Date(endDateTime).toLocaleString('es-MX', { timeZone: 'America/Mexico_City' })}
              </p>
            </div>
          )}

          <Button 
            onClick={handleAnalyze}
            disabled={isAnalyzing || isLoading || !startDateTime || !endDateTime}
            className="w-full md:w-auto"
          >
            {isAnalyzing || isLoading ? 'Analizando...' : 'Analizar Periodo'}
          </Button>
        </CardContent>
      </Card>

      {/* Resultados */}
      {periodBalance && (
        <>
          {/* Cards de resumen */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Ingresos</CardTitle>
                <TrendingUp className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {formatCurrency(periodBalance.income)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {periodBalance.transactionCount} transacción{periodBalance.transactionCount !== 1 ? 'es' : ''}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gastos</CardTitle>
                <TrendingDown className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600">
                  {formatCurrency(periodBalance.expenses)}
                </div>
                <p className="text-xs text-muted-foreground">
                  Proporcional por {getTotalHours().toFixed(1)} horas
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Gastos de Viajes</CardTitle>
                <Car className="h-4 w-4 text-orange-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(periodBalance.totalTripExpenses || 0)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {periodBalance.trips?.filter(trip => trip.expenses && trip.expenses.length > 0).length || 0} viaje{(periodBalance.trips?.filter(trip => trip.expenses && trip.expenses.length > 0).length || 0) !== 1 ? 's' : ''} con gastos
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Balance Final</CardTitle>
                <DollarSign className={`h-4 w-4 ${periodBalance.balance >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${periodBalance.balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {formatCurrency(periodBalance.balance)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {periodBalance.balance >= 0 ? 'Ganancia' : 'Pérdida'} en el periodo
                </p>
              </CardContent>
            </Card>
          </div>


          {/* Desglose de gastos con dropdown */}
          {periodBalance.expenseBreakdown.length > 0 && (
            <Collapsible.Root open={isExpensesExpanded} onOpenChange={setIsExpensesExpanded}>
              <Card>
                <Collapsible.Trigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Desglose de Gastos</CardTitle>
                        <CardDescription>
                          Gastos proporcionales calculados por horas en el periodo seleccionado
                        </CardDescription>
                      </div>
                      {isExpensesExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </CardHeader>
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <CardContent>
                    <div className="space-y-3">
                      {periodBalance.expenseBreakdown.map((expense, index) => (
                        <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                          <div>
                            <p className="font-medium capitalize">{expense.category}</p>
                            <p className="text-sm font-medium text-gray-700">{expense.concept}</p>
                            <p className="text-sm text-muted-foreground">
                              Total: {formatCurrency(expense.amount)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-bold">{formatCurrency(expense.proportionalAmount)}</p>
                            <p className="text-xs text-muted-foreground">Proporcional</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Collapsible.Content>
              </Card>
            </Collapsible.Root>
          )}

          {/* Desglose de transacciones con dropdown */}
          {periodBalance.transactions && periodBalance.transactions.length > 0 && (
            <Collapsible.Root open={isTransactionsExpanded} onOpenChange={setIsTransactionsExpanded}>
              <Card>
                <Collapsible.Trigger asChild>
                  <CardHeader className="cursor-pointer hover:bg-gray-50 transition-colors">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle className="flex items-center gap-2">
                          <Receipt className="w-5 h-5" />
                          Desglose de Transacciones
                        </CardTitle>
                        <CardDescription>
                          Transacciones realizadas en el periodo seleccionado
                        </CardDescription>
                      </div>
                      {isTransactionsExpanded ? (
                        <ChevronUp className="h-5 w-5 text-gray-500" />
                      ) : (
                        <ChevronDown className="h-5 w-5 text-gray-500" />
                      )}
                    </div>
                  </CardHeader>
                </Collapsible.Trigger>
                <Collapsible.Content>
                  <CardContent>
                    <div className="space-y-4">
                      {periodBalance.transactions.map((transaction) => (
                        <div key={transaction.id} className="border rounded-lg p-4 hover:bg-gray-50">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Receipt className="w-4 h-4 text-blue-600" />
                              <span className="font-medium">Transacción #{transaction.id}</span>
                              <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded-full">
                                {transaction.details?.type === 'reservation' ? 'Reservación' : 
                                 transaction.details?.type === 'package' ? 'Paquetería' : 'Transacción'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-green-600">
                                {formatCurrency(transaction.amount)}
                              </span>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              <span>{transaction.createdBy?.name || 'Usuario no identificado'}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              <span>{new Date(transaction.createdAt).toLocaleDateString('es-MX')}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              <span>{new Date(transaction.createdAt).toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>

                          {/* Detalles de la transacción */}
                          {transaction.details?.details && (
                            <div className="mt-3 pt-3 border-t">
                              {transaction.details.type === 'reservation' && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-3 h-3 text-gray-500 mt-0.5" />
                                    <div>
                                      <span className="font-medium text-gray-600">Origen:</span>
                                      <div className="text-gray-700">{transaction.details.details.origen}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-start gap-2">
                                    <MapPin className="w-3 h-3 text-gray-500 mt-0.5" />
                                    <div>
                                      <span className="font-medium text-gray-600">Destino:</span>
                                      <div className="text-gray-700">{transaction.details.details.destino}</div>
                                    </div>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-600">Pasajeros:</span>
                                    <span>{transaction.details.details.pasajeros}</span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium text-gray-600">Método de pago:</span>
                                    <span className="capitalize">{transaction.details.details.metodoPago}</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Collapsible.Content>
              </Card>
            </Collapsible.Root>
          )}

          {/* Información de viajes realizados */}
          {periodBalance.tripsCount > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Car className="w-5 h-5" />
                  Viajes Realizados
                </CardTitle>
                <CardDescription>
                  Viajes principales realizados en el periodo seleccionado
                </CardDescription>
              </CardHeader>
              <CardContent>
         
                {periodBalance.trips && periodBalance.trips.length > 0 && (
                  <div className="space-y-3">
                    {periodBalance.trips.slice(0, 5).map((trip) => {
                      const mainTrip = trip.tripData?.find((t: any) => t.isMainTrip);
                      if (!mainTrip) return null;
                      
                      // Calcular total de gastos del viaje
                      const tripTotalExpenses = trip.expenses?.reduce((sum: number, expense: any) => sum + expense.amount, 0) || 0;
                      
                      return (
                        <div key={trip.id} className="border rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <Car className="w-4 h-4 text-gray-600" />
                              <span className="font-medium">Viaje #{trip.id}</span>
                              {trip.operator && (
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                                  - Operador: {trip.operator.firstName} {trip.operator.lastName}
                                </span>
                              )}
                            </div>

                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm mb-3">
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3 h-3 text-gray-500 mt-0.5" />
                              <div>
                                <span className="font-medium text-gray-600">Origen:</span>
                                <div className="text-gray-700">{mainTrip.origin}</div>
                              </div>
                            </div>
                            <div className="flex items-start gap-2">
                              <MapPin className="w-3 h-3 text-gray-500 mt-0.5" />
                              <div>
                                <span className="font-medium text-gray-600">Destino:</span>
                                <div className="text-gray-700">{mainTrip.destination}</div>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Calendar className="w-3 h-3 text-gray-500" />
                              <span className="text-gray-600">Fecha:</span>
                              <span>{mainTrip.departureDate.split('T')[0].split('-').reverse().join('/')}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <Clock className="w-3 h-3 text-gray-500" />
                              <span className="text-gray-600">Hora:</span>
                              <span>{mainTrip.departureTime}</span>
                            </div>
                          </div>

                          {/* Gastos del viaje */}
                          {trip.expenses && trip.expenses.length > 0 && (
                            <div className="border-t pt-3">
                              <h4 className="font-medium text-gray-800 mb-2 flex items-center gap-2">
                                <Receipt className="w-4 h-4" />
                                Gastos del viaje:
                              </h4>
                              <div className="space-y-2">
                                {trip.expenses.map((expense: any) => (
                                  <div key={expense.id} className="flex items-center justify-between p-2 bg-gray-50 rounded border">
                                    <div className="flex items-center gap-2">
                                      <Receipt className="w-4 h-4 text-gray-500" />
                                      <div>
                                        <div className="font-medium text-sm">{expense.type}</div>
                                        {expense.description && (
                                          <div className="text-xs text-gray-600">{expense.description}</div>
                                        )}
                                      </div>
                                    </div>
                                    <div className="text-sm font-semibold text-red-600">
                                      {formatCurrency(expense.amount)}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                    
                    {periodBalance.trips.length > 5 && (
                      <div className="text-center text-sm text-muted-foreground">
                        ... y {periodBalance.trips.length - 5} viajes más
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Estado vacío */}
      {!periodBalance && !isLoading && !isAnalyzing && (
        <Card>
          <CardContent className="text-center py-8">
            <CalendarDays className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">Sin análisis</h3>
            <p className="mt-1 text-sm text-gray-500">
              Selecciona un periodo y presiona "Analizar Periodo" para ver los resultados.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default function PeriodBalancePage() {
  return (
    <DefaultLayout>
      <PeriodBalancePageContent />
    </DefaultLayout>
  );
}