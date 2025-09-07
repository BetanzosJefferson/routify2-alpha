import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Search, 
  Clock, 
  DollarSign, 
  User, 
  MapPin,
  Calendar,
  CreditCard,
  Loader2,
  Users,
  CheckCircle,
  XCircle,
  Receipt
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import DefaultLayout from '@/components/layout/default-layout';
import { formatDateToLocal } from '@/lib/utils';

interface ReservationWithTransactions {
  id: number;
  companyId: string;
  status: string;
  totalAmount: number;
  paymentMethod: string;
  paymentStatus: string;
  seatNumbers: string[];
  checkInTime: string | null;
  boardingStatus: string;
  createdAt: string;
  tripDetails: {
    date: string;
    origin: string;
    destination: string;
    departureTime: string;
    passengerName: string;
  };
  creator: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
  } | null;
  checker: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
  paidBy: {
    id: number;
    firstName: string;
    lastName: string;
  } | null;
  transactions: Array<{
    id: number;
    details: any;
    createdAt: string;
    user_id: number;
    creator: {
      id: number;
      firstName: string;
      lastName: string;
    } | null;
  }>;
}

export default function PassengerVerificationPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [hasSearched, setHasSearched] = useState(false);

  // Query para obtener reservaciones con transacciones
  const { data: reservations, isLoading, error, refetch } = useQuery<ReservationWithTransactions[]>({
    queryKey: ['/api/reservations/verification', startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        startDate,
        endDate
      });
      const response = await fetch(`/api/reservations/verification?${params}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: ${response.statusText}`);
      }
      return response.json();
    },
    enabled: false, // Solo ejecutar cuando el usuario haga búsqueda
  });

  const handleSearch = () => {
    if (!startDate || !endDate) {
      alert('Por favor selecciona ambas fechas');
      return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
      alert('La fecha de inicio debe ser anterior a la fecha de fin');
      return;
    }
    
    setHasSearched(true);
    refetch();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const getStatusBadge = (status: string) => {
    const statusConfig = {
      'confirmada': { label: 'Confirmada', className: 'bg-green-500' },
      'pendiente': { label: 'Pendiente', className: 'bg-yellow-500' },
      'cancelada': { label: 'Cancelada', className: 'bg-red-500' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
                   { label: status, className: 'bg-gray-500' };
    
    return (
      <Badge className={`${config.className} text-white`}>
        {config.label}
      </Badge>
    );
  };

  const getPaymentStatusBadge = (status: string) => {
    const config = {
      'pagado': { label: 'Pagado', className: 'bg-green-500', icon: CheckCircle },
      'pendiente': { label: 'Pendiente', className: 'bg-yellow-500', icon: Clock },
      'no_pagado': { label: 'No pagado', className: 'bg-red-500', icon: XCircle },
    };
    
    const statusInfo = config[status as keyof typeof config] || 
                      { label: status, className: 'bg-gray-500', icon: Clock };
    
    const Icon = statusInfo.icon;
    
    return (
      <Badge className={`${statusInfo.className} text-white flex items-center gap-1`}>
        <Icon className="w-3 h-3" />
        {statusInfo.label}
      </Badge>
    );
  };

  return (
    <DefaultLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Confirmación de pasajeros en sistema</h1>
        </div>

        {/* Formulario de búsqueda */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Búsqueda por rango de fechas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Fecha de inicio
                </label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">
                  Fecha de fin
                </label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button 
                onClick={handleSearch}
                disabled={!startDate || !endDate || isLoading}
                className="w-full md:w-auto"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error de carga */}
        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              Error al cargar los datos: {(error as Error).message}
            </AlertDescription>
          </Alert>
        )}

        {/* Resultados */}
        {hasSearched && reservations && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                Reservaciones encontradas ({reservations.length})
              </CardTitle>
              {startDate && endDate && (
                <p className="text-sm text-muted-foreground">
                  Reservaciones creadas entre {formatDateToLocal(startDate)} y {formatDateToLocal(endDate)}
                </p>
              )}
            </CardHeader>
            <CardContent>
              {reservations.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-muted-foreground">
                    No se encontraron reservaciones en el rango de fechas seleccionado
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {reservations.map((reservation) => (
                    <Card key={reservation.id} className="border-l-4 border-l-blue-500">
                      <CardContent className="p-6">
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                          {/* Información de la reservación */}
                          <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h3 className="text-lg font-semibold">
                                Reservación #{reservation.id}
                              </h3>
                              {getStatusBadge(reservation.status)}
                            </div>
                            
                            <div className="space-y-2">
                              <div className="flex items-center gap-2">
                                <User className="w-4 h-4 text-muted-foreground" />
                                <span className="font-medium">
                                  {reservation.tripDetails?.passengerName || 'N/A'}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-muted-foreground" />
                                <span>
                                  {reservation.tripDetails?.origin} → {reservation.tripDetails?.destination}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-muted-foreground" />
                                <span>
                                  {reservation.tripDetails?.departureTime} - {formatDateToLocal(reservation.tripDetails?.date)}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <Users className="w-4 h-4 text-muted-foreground" />
                                <span>
                                  Asientos: {reservation.seatNumbers?.join(', ') || 'N/A'}
                                </span>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-muted-foreground" />
                                <span className="font-semibold">
                                  {formatCurrency(reservation.totalAmount)}
                                </span>
                                {getPaymentStatusBadge(reservation.paymentStatus)}
                              </div>
                            </div>

                            {/* Información de usuarios */}
                            <div className="space-y-2 pt-4 border-t">
                              <h4 className="font-medium text-sm text-muted-foreground">
                                Información de gestión
                              </h4>
                              
                              {reservation.creator && (
                                <div className="flex items-center gap-2 text-sm">
                                  <User className="w-3 h-3" />
                                  <span className="font-medium">Creado por:</span>
                                  <span>{reservation.creator.firstName} {reservation.creator.lastName}</span>
                                </div>
                              )}
                              
                              {reservation.checker && (
                                <div className="flex items-center gap-2 text-sm">
                                  <CheckCircle className="w-3 h-3" />
                                  <span className="font-medium">Checado por:</span>
                                  <span>{reservation.checker.firstName} {reservation.checker.lastName}</span>
                                </div>
                              )}
                              
                              {reservation.paidBy && (
                                <div className="flex items-center gap-2 text-sm">
                                  <CreditCard className="w-3 h-3" />
                                  <span className="font-medium">Marcado como pagado por:</span>
                                  <span>{reservation.paidBy.firstName} {reservation.paidBy.lastName}</span>
                                </div>
                              )}
                              
                              <div className="flex items-center gap-2 text-sm">
                                <Calendar className="w-3 h-3" />
                                <span className="font-medium">Creada:</span>
                                <span>{formatDateToLocal(reservation.createdAt)}</span>
                              </div>
                            </div>
                          </div>

                          {/* Información contable */}
                          <div className="space-y-4">
                            <h4 className="font-medium flex items-center gap-2">
                              <Receipt className="w-4 h-4" />
                              Información contable
                            </h4>
                            
                            {reservation.transactions && reservation.transactions.length > 0 ? (
                              <div className="space-y-3">
                                <p className="text-sm text-muted-foreground">
                                  {reservation.transactions.length} transacción(es) asociada(s)
                                </p>
                                
                                {reservation.transactions.map((transaction, index) => (
                                  <Card key={transaction.id} className="bg-muted/50">
                                    <CardContent className="p-4">
                                      <div className="space-y-2">
                                        <div className="flex items-center justify-between">
                                          <span className="font-medium text-sm">
                                            Transacción #{transaction.id}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {formatDateToLocal(transaction.createdAt)}
                                          </span>
                                        </div>
                                        
                                        {transaction.creator && (
                                          <div className="flex items-center gap-2 text-sm">
                                            <User className="w-3 h-3" />
                                            <span className="font-medium">Creada por:</span>
                                            <span>
                                              {transaction.creator.firstName} {transaction.creator.lastName}
                                            </span>
                                          </div>
                                        )}
                                        
                                        {transaction.details && (
                                          <div className="text-xs bg-background p-2 rounded border">
                                            <pre className="whitespace-pre-wrap font-mono">
                                              {JSON.stringify(transaction.details, null, 2)}
                                            </pre>
                                          </div>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-4">
                                <Receipt className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                <p className="text-sm text-muted-foreground">
                                  Sin transacciones asociadas
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
        
        {hasSearched && !reservations && !isLoading && (
          <Card>
            <CardContent className="text-center py-8">
              <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">
                Realiza una búsqueda para ver los resultados
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DefaultLayout>
  );
}