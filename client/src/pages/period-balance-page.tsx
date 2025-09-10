import { useState } from 'react';
import { useAuth } from '@/hooks/use-auth';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { CalendarDays, DollarSign, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';
import { DefaultLayout } from '@/components/layout/default-layout';

interface PeriodBalanceData {
  income: number;
  expenses: number;
  balance: number;
  transactionCount: number;
  expenseBreakdown: Array<{
    category: string;
    amount: number;
    proportionalAmount: number;
  }>;
}

function PeriodBalancePageContent() {
  const { user } = useAuth();
  const [startDateTime, setStartDateTime] = useState('');
  const [endDateTime, setEndDateTime] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

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
          <div className="grid gap-4 md:grid-cols-3">
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

          {/* Desglose de gastos */}
          {periodBalance.expenseBreakdown.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Desglose de Gastos</CardTitle>
                <CardDescription>
                  Gastos proporcionales calculados por horas en el periodo seleccionado
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {periodBalance.expenseBreakdown.map((expense, index) => (
                    <div key={index} className="flex justify-between items-center p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium capitalize">{expense.category}</p>
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