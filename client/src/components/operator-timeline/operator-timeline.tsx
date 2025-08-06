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

interface TimelineData {
  trips: Trip[];
  transactions: Transaction[];
  totalCount: number;
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

  // Agrupar transacciones por viaje
  const groupedData = React.useMemo(() => {
    if (!timelineData) return [];

    const tripMap = new Map();
    
    // Crear mapa de viajes
    timelineData.trips.forEach(trip => {
      tripMap.set(trip.id.toString(), {
        trip,
        transactions: []
      });
    });

    // Agregar transacciones a sus viajes correspondientes
    timelineData.transactions.forEach(transaction => {
      const tripData = tripMap.get(transaction.tripId);
      if (tripData) {
        tripData.transactions.push(transaction);
      }
    });

    return Array.from(tripMap.values()).filter(item => item.transactions.length > 0);
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
                  <div className="text-right">
                    <div className="text-2xl font-bold">{groupedData.length}</div>
                    <div className="text-sm text-gray-500">viajes con transacciones</div>
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
          ) : groupedData.length > 0 ? (
            <div className="space-y-4">
              {groupedData.map((item, index) => (
                <Card key={item.trip.id} className="border-l-4 border-l-blue-500">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-5 w-5 text-blue-500" />
                        <span>Viaje #{item.trip.id}</span>
                      </div>
                      <div className="text-sm text-gray-500">
                        {format(parseISO(item.trip.departureDate), "dd/MM/yyyy", { locale: es })} - {item.trip.departureTime}
                      </div>
                    </CardTitle>
                    <div className="text-sm text-gray-600">
                      <div className="flex items-center gap-4">
                        <span><strong>Origen:</strong> {item.trip.origin}</span>
                        <span><strong>Destino:</strong> {item.trip.destination}</span>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <DollarSign className="h-4 w-4 text-green-500" />
                        Transacciones ({item.transactions.length})
                      </h4>
                      <div className="space-y-2">
                        {item.transactions.map((transaction) => (
                          <div key={transaction.id} className="bg-gray-50 p-3 rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <div className="font-medium">{transaction.description}</div>
                                <div className="text-sm text-gray-500">
                                  {format(parseISO(transaction.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="font-bold text-green-600">
                                  {formatPrice(transaction.amount)}
                                </div>
                                <div className="text-xs text-gray-500 capitalize">
                                  {transaction.type}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
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