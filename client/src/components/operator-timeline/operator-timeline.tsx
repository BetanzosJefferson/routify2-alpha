import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon, Search, User, DollarSign, Clock, MapPin } from 'lucide-react';
import { format, parseISO, isWithinInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface Transaction {
  id: number;
  amount: number;
  type: string;
  description: string;
  createdAt: string;
  createdBy: number;
  tripId: string;
}

interface Trip {
  id: number;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  driverId: number;
  companyId: string;
}

interface Operator {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
}

interface Summary {
  totalTrips: number;
  totalTransactions: number;
  totalEfectivo: number;
  totalTransferencia: number;
  totalGeneral: number;
}

interface TimelineData {
  trips: Trip[];
  transactions: Transaction[];
  summary: Summary;
}

export function OperatorTimeline() {
  const [selectedOperator, setSelectedOperator] = useState<string>('');
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [showResults, setShowResults] = useState(false);

  // Obtener lista de operadores
  const { data: operators = [], isLoading: operatorsLoading, error: operatorsError } = useQuery<Operator[]>({
    queryKey: ['/api/users/operators'],
    queryFn: async () => {
      console.log('[OperatorTimeline] Ejecutando consulta de operadores...');
      const response = await fetch('/api/users/operators');
      console.log('[OperatorTimeline] Response status:', response.status);
      
      if (!response.ok) {
        console.error('[OperatorTimeline] Error en respuesta:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('[OperatorTimeline] Error text:', errorText);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[OperatorTimeline] Datos recibidos:', data);
      return data;
    },
    enabled: true
  });

  // Depuración de operadores
  React.useEffect(() => {
    console.log('[OperatorTimeline] Componente cargado');
    console.log('[OperatorTimeline] Operadores:', operators);
    console.log('[OperatorTimeline] Loading:', operatorsLoading);
    console.log('[OperatorTimeline] Error:', operatorsError);
    if (operatorsError) {
      console.error('[OperatorTimeline] Error completo:', operatorsError);
    }
  }, [operators, operatorsLoading, operatorsError]);

  // Obtener datos de la línea de tiempo
  const { data: timelineData, isLoading, refetch } = useQuery<TimelineData>({
    queryKey: ['/api/operator-timeline', selectedOperator, startDate, endDate],
    queryFn: async () => {
      console.log('[OperatorTimeline] Ejecutando consulta de timeline...');
      console.log('[OperatorTimeline] Parámetros:', { selectedOperator, startDate, endDate });
      
      if (!selectedOperator || !startDate || !endDate) {
        console.error('[OperatorTimeline] Faltan parámetros requeridos');
        throw new Error('Faltan parámetros requeridos');
      }
      
      const params = new URLSearchParams({
        operatorId: selectedOperator,
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0]
      });
      
      console.log('[OperatorTimeline] URL:', `/api/operator-timeline?${params}`);
      
      const response = await fetch(`/api/operator-timeline?${params}`);
      console.log('[OperatorTimeline] Timeline response status:', response.status);
      
      if (!response.ok) {
        console.error('[OperatorTimeline] Error en timeline:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('[OperatorTimeline] Timeline error text:', errorText);
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[OperatorTimeline] Timeline data recibida:', data);
      return data;
    },
    enabled: false, // Solo se ejecuta manualmente
  });

  const handleSearch = () => {
    if (selectedOperator && startDate && endDate) {
      setShowResults(true);
      refetch();
    }
  };

  const resetFilters = () => {
    setSelectedOperator('');
    setStartDate(undefined);
    setEndDate(undefined);
    setShowResults(false);
  };

  // Procesar datos para mostrar
  const processedData = React.useMemo(() => {
    if (!timelineData) return { transactionsWithTrips: [], standAloneTransactions: [] };

    const transactionsWithTrips = [];
    const standAloneTransactions = [];
    
    // Procesar transacciones
    timelineData.transactions.forEach(transaction => {
      const tripId = transaction.details?.details?.tripId;
      if (tripId) {
        // Buscar el viaje correspondiente
        const trip = timelineData.trips.find(t => t.id === tripId);
        if (trip) {
          transactionsWithTrips.push({ transaction, trip });
        } else {
          standAloneTransactions.push(transaction);
        }
      } else {
        standAloneTransactions.push(transaction);
      }
    });

    return { transactionsWithTrips, standAloneTransactions };
  }, [timelineData]);

  const formatPrice = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
    }).format(amount);
  };

  const selectedOperatorData = operators.find(op => op.id.toString() === selectedOperator);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Línea de tiempo operador</h1>
          <p className="text-gray-600 mt-2">
            Consulta transacciones y viajes por operador en un rango de fechas específico
          </p>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Filtros de búsqueda
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Selector de operador */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Operador</label>
              <Select value={selectedOperator} onValueChange={setSelectedOperator}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar operador" />
                </SelectTrigger>
                <SelectContent>
                  {operators.map((operator) => (
                    <SelectItem key={operator.id} value={operator.id.toString()}>
                      {operator.firstName} {operator.lastName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Fecha inicio */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha inicio</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !startDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {startDate ? format(startDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Fecha fin */}
            <div className="space-y-2">
              <label className="text-sm font-medium">Fecha fin</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "dd/MM/yyyy", { locale: es }) : "Seleccionar fecha"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={es}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          <div className="flex gap-2">
            <Button 
              onClick={handleSearch}
              disabled={!selectedOperator || !startDate || !endDate}
              className="flex items-center gap-2"
            >
              <Search className="h-4 w-4" />
              Buscar
            </Button>
            <Button 
              variant="outline" 
              onClick={resetFilters}
            >
              Limpiar filtros
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resultados */}
      {showResults && (
        <>
          {/* Contador */}
          {timelineData && (
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <User className="h-5 w-5 text-blue-500" />
                      <span className="font-medium">
                        {selectedOperatorData?.firstName} {selectedOperatorData?.lastName}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-5 w-5 text-green-500" />
                      <span>
                        {format(startDate!, "dd/MM/yyyy", { locale: es })} - {format(endDate!, "dd/MM/yyyy", { locale: es })}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-6">
                    {/* Contador de viajes */}
                    <div className="text-center">
                      <div className="text-xl font-bold text-blue-600">{timelineData.summary?.totalTrips || 0}</div>
                      <div className="text-xs text-gray-500">viajes</div>
                    </div>
                    {/* Contador de transacciones */}
                    <div className="text-center">
                      <div className="text-xl font-bold text-purple-600">{timelineData.summary?.totalTransactions || 0}</div>
                      <div className="text-xs text-gray-500">transacciones</div>
                    </div>
                    {/* Total efectivo */}
                    <div className="text-center">
                      <div className="text-xl font-bold text-green-600">{(timelineData.summary?.totalEfectivo || 0).toLocaleString('es-MX', {
                        style: 'currency',
                        currency: 'MXN'
                      })}</div>
                      <div className="text-xs text-gray-500">efectivo</div>
                    </div>
                    {/* Total transferencia */}
                    <div className="text-center">
                      <div className="text-xl font-bold text-orange-600">{(timelineData.summary?.totalTransferencia || 0).toLocaleString('es-MX', {
                        style: 'currency',
                        currency: 'MXN'
                      })}</div>
                      <div className="text-xs text-gray-500">transferencia</div>
                    </div>
                    {/* Total general */}
                    <div className="text-center">
                      <div className="text-xl font-bold text-gray-800">${(timelineData.summary?.totalGeneral || 0).toLocaleString()}</div>
                      <div className="text-xs text-gray-500">total general</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Lista de viajes y transacciones */}
          {isLoading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                  <p className="mt-2 text-gray-600">Cargando datos...</p>
                </div>
              </CardContent>
            </Card>
          ) : timelineData?.transactions.length > 0 ? (
            <div className="space-y-4">
              {/* Transacciones asociadas a viajes */}
              {processedData.transactionsWithTrips.map((item, index) => (
                <Card key={`trip-${item.transaction.id}`} className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-500" />
                        <span>Viaje #{item.transaction.details.details.tripId}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {(() => {
                          const createdDate = parseISO(item.transaction.createdAt);
                          // Si la transacción se creó después de medianoche pero antes de las 6 AM,
                          // probablemente corresponde al día anterior operacionalmente
                          const operationalDate = createdDate.getHours() < 6 ? 
                            new Date(createdDate.getTime() - 24 * 60 * 60 * 1000) : 
                            createdDate;
                          return format(operationalDate, "dd/MM/yyyy", { locale: es }) + " " + 
                                 format(createdDate, "HH:mm", { locale: es });
                        })()}
                      </div>
                    </CardTitle>
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center gap-4">
                        <span><strong>Origen:</strong> {item.transaction.details.details.origen}</span>
                        <span><strong>Destino:</strong> {item.transaction.details.details.destino}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        Transacción #{item.transaction.id}
                      </h4>
                      <div className="bg-gray-50 p-3 rounded-lg">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="font-medium">{item.transaction.details.details.notas}</div>
                            <div className="text-sm text-gray-500">
                              Reservación #{item.transaction.details.details.id} - {item.transaction.details.details.pasajeros}
                            </div>
                            <div className="text-sm text-gray-500">
                              Método: {item.transaction.details.details.metodoPago}
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold text-green-600">
                              {formatPrice(item.transaction.details.details.monto)}
                            </div>
                            <div className="text-xs text-gray-500 capitalize">
                              {item.transaction.details.type}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
              
              {/* Transacciones sin viaje asociado */}
              {processedData.standAloneTransactions.map((transaction) => (
                <Card key={`standalone-${transaction.id}`} className="border-l-4 border-l-orange-500">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <DollarSign className="h-5 w-5 text-orange-500" />
                        <span>Transacción #{transaction.id}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {(() => {
                          const createdDate = parseISO(transaction.createdAt);
                          // Si la transacción se creó después de medianoche pero antes de las 6 AM,
                          // probablemente corresponde al día anterior operacionalmente
                          const operationalDate = createdDate.getHours() < 6 ? 
                            new Date(createdDate.getTime() - 24 * 60 * 60 * 1000) : 
                            createdDate;
                          return format(operationalDate, "dd/MM/yyyy", { locale: es }) + " " + 
                                 format(createdDate, "HH:mm", { locale: es });
                        })()}
                      </div>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="font-medium">{transaction.details?.details?.notas || 'Sin descripción'}</div>
                          <div className="text-sm text-gray-500">
                            Tipo: {transaction.details?.type || 'No especificado'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-green-600">
                            {formatPrice(transaction.details?.details?.monto || 0)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-8">
                  <div className="text-gray-400 mb-4">
                    <Search className="h-12 w-12 mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No se encontraron resultados</h3>
                  <p className="text-gray-600">
                    No hay transacciones o viajes para el operador seleccionado en el rango de fechas especificado.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}