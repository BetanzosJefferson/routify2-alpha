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
                      operators.map((operator) => (
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
            {/* Resumen */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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

              <Card>
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <p className="text-sm font-medium text-gray-600">Periodo</p>
                    <p className="text-sm font-bold">
                      {formatDate(startDate)} - {formatDate(endDate)}
                    </p>
                  </div>
                  <CalendarIcon className="h-8 w-8 text-purple-500" />
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
                    {timelineData.trips.map((trip) => {
                      const firstSegment = trip.tripData[0];
                      if (!firstSegment) return null;

                      return (
                        <div 
                          key={trip.id} 
                          className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
                        >
                          <div className="flex items-start justify-between">
                            <div className="space-y-2 flex-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline">Viaje #{trip.id}</Badge>
                                <Badge variant={trip.visibility === "publicado" ? "default" : "secondary"}>
                                  {trip.visibility}
                                </Badge>
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

                              {trip.route && (
                                <div className="text-sm text-gray-600">
                                  <span className="font-medium">Ruta:</span> {trip.route.name}
                                </div>
                              )}

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
                                              <Badge variant="default" className="text-xs">
                                                Reserva #{transaction.reservationId}
                                              </Badge>
                                            )}
                                          </div>
                                          <div className="font-semibold text-green-600">
                                            ${transaction.amount.toLocaleString()} MXN
                                          </div>
                                        </div>
                                        
                                        <div className="space-y-1 text-xs text-gray-600">
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