import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Filter, Calendar, User, Receipt, Package, CheckCircle, AlertCircle, MapPin, Clock, Users, FileText } from 'lucide-react';
import { formatDateForDisplay, getCurrentLocalDate } from '@/lib/utils';
import DefaultLayout from '@/components/layout/default-layout';

interface TransactionHistoryItem {
  id: number;
  details: any;
  createdAt: string;
  cutoffId: number | null;
  cutoffStatus: 'pending' | 'completed';
  cutoffVerified?: boolean; // Indica si el corte ha sido verificado (check: true/false)
  cutoffVerifiedBy?: string; // Nombre del usuario que verificó el corte
  cutoffVerifiedAt?: string; // Fecha de verificación del corte
  createdBy: {
    id: number;
    name: string;
  };
  type: 'reservation' | 'package';
  amount: number;
}



export default function TransactionHistoryPage() {
  const [startDate, setStartDate] = useState(getCurrentLocalDate());
  const [endDate, setEndDate] = useState(getCurrentLocalDate());
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedCutoffId, setSelectedCutoffId] = useState<string>('all');
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<string>('all');
  const [isFiltersChanged, setIsFiltersChanged] = useState(false);

  // Obtener historial de transacciones
  const { data: transactionHistory, isLoading, refetch } = useQuery<TransactionHistoryItem[]>({
    queryKey: ['/api/transaction-history', { startDate, endDate, userId: selectedUserId, cutoffId: selectedCutoffId, paymentMethod: selectedPaymentMethod }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedUserId && selectedUserId !== 'all') params.append('userId', selectedUserId);
      if (selectedPaymentMethod && selectedPaymentMethod !== 'all') params.append('paymentMethod', selectedPaymentMethod);
      if (selectedCutoffId && selectedCutoffId !== 'all') {
        if (selectedCutoffId === 'pending') {
          params.append('cutoffId', '0');
        } else {
          params.append('cutoffId', selectedCutoffId);
        }
      }
      
      const response = await fetch(`/api/transaction-history?${params}`);
      if (!response.ok) throw new Error('Error al obtener historial de transacciones');
      return response.json();
    },
    enabled: true
  });

  // Obtener usuarios que tienen transacciones para filtro
  const { data: users } = useQuery<{ id: number; name: string; }[]>({
    queryKey: ['/api/transaction-users'],
    queryFn: async () => {
      const response = await fetch('/api/transaction-users');
      if (!response.ok) throw new Error('Error al obtener usuarios con transacciones');
      return response.json();
    }
  });

  // Obtener cortes únicos para filtro - usar query separada para evitar filtro circular
  const { data: allTransactionHistory } = useQuery({
    queryKey: ['/api/transaction-history', 'all-cutoffs'],
    queryFn: async () => {
      const params = new URLSearchParams();
      // Usar un rango más razonable basado en el año actual para obtener los cortes únicos
      const currentYear = new Date().getFullYear();
      params.append('startDate', `${currentYear}-01-01`);
      params.append('endDate', `${currentYear}-12-31`);
      
      const response = await fetch(`/api/transaction-history?${params}`);
      if (!response.ok) throw new Error('Error al obtener historial de transacciones');
      return response.json();
    }
  });

  const uniqueCutoffs = React.useMemo(() => {
    if (!allTransactionHistory) return [];
    
    const cutoffs = new Set<number>();
    
    // Si hay un usuario seleccionado, filtrar solo sus cortes
    const transactionsToProcess = selectedUserId !== 'all' 
      ? allTransactionHistory.filter((t: TransactionHistoryItem) => t.createdBy.id.toString() === selectedUserId)
      : allTransactionHistory;
    
    transactionsToProcess.forEach((transaction: TransactionHistoryItem) => {
      if (transaction.cutoffId) {
        cutoffs.add(transaction.cutoffId);
      }
    });
    
    return Array.from(cutoffs).sort((a, b) => b - a);
  }, [allTransactionHistory, selectedUserId]);

  // Detectar cambios en filtros - ahora compara con la fecha actual por defecto
  useEffect(() => {
    const currentDate = getCurrentLocalDate();
    const hasDateFilters = startDate !== currentDate || endDate !== currentDate;
    setIsFiltersChanged(hasDateFilters || selectedUserId !== 'all' || selectedCutoffId !== 'all' || selectedPaymentMethod !== 'all');
  }, [startDate, endDate, selectedUserId, selectedCutoffId, selectedPaymentMethod]);

  // Resetear filtro de corte cuando cambia el usuario
  useEffect(() => {
    setSelectedCutoffId('all');
  }, [selectedUserId]);

  const handleClearFilters = () => {
    const currentDate = getCurrentLocalDate();
    setStartDate(currentDate);
    setEndDate(currentDate);
    setSelectedUserId('all');
    setSelectedCutoffId('all');
    setSelectedPaymentMethod('all');
    // Refetch to reset the data
    refetch();
  };

  const handleApplyFilters = () => {
    refetch();
  };

  const getTransactionTypeIcon = (type: 'reservation' | 'package') => {
    return type === 'reservation' ? <Receipt className="w-4 h-4" /> : <Package className="w-4 h-4" />;
  };

  const getTransactionTypeLabel = (type: 'reservation' | 'package') => {
    return type === 'reservation' ? 'Reservación' : 'Paquete';
  };

  const getCutoffStatusBadge = (status: 'pending' | 'completed') => {
    return status === 'completed' ? (
      <Badge variant="default" className="bg-green-100 text-green-800">
        Completado
      </Badge>
    ) : (
      <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
        Pendiente
      </Badge>
    );
  };

  const getCutoffVerificationBadge = (transaction: TransactionHistoryItem) => {
    if (!transaction.cutoffId) return null;
    
    if (transaction.cutoffVerified) {
      return (
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-3 h-3" />
            <span className="text-xs font-medium">Verificado</span>
          </div>
          {transaction.cutoffVerifiedBy && (
            <span className="text-xs text-gray-500">
              Por: {transaction.cutoffVerifiedBy}
            </span>
          )}
          {transaction.cutoffVerifiedAt && (
            <span className="text-xs text-gray-500">
              {formatDateForDisplay(transaction.cutoffVerifiedAt)}
            </span>
          )}
        </div>
      );
    } else {
      return (
        <div className="flex items-center gap-1 text-orange-600">
          <AlertCircle className="w-3 h-3" />
          <span className="text-xs">Sin verificar</span>
        </div>
      );
    }
  };

  const getPaymentMethodBadge = (method: string) => {
    const colors = {
      efectivo: 'bg-green-100 text-green-800',
      transferencia: 'bg-blue-100 text-blue-800',
      tarjeta: 'bg-purple-100 text-purple-800'
    };
    
    return (
      <Badge variant="outline" className={colors[method as keyof typeof colors] || 'bg-gray-100 text-gray-800'}>
        {method === 'efectivo' ? 'Efectivo' : 
         method === 'transferencia' ? 'Transferencia' : 
         method === 'tarjeta' ? 'Tarjeta' : method}
      </Badge>
    );
  };

  const renderTransactionDetails = (transaction: TransactionHistoryItem) => {
    const details = transaction.details?.details || transaction.details;
    
    if (transaction.type === 'reservation') {
      return (
        <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Receipt className="w-4 h-4 text-blue-600" />
            <span className="font-medium text-blue-800">Detalles de la Reservación</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">ID Reservación:</span>
              <span>#{details?.id}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Users className="w-3 h-3 text-gray-500" />
              <span className="font-medium text-gray-600">Pasajero:</span>
              <span>{details?.pasajeros}</span>
            </div>
            
            <div className="flex items-start gap-2">
              <MapPin className="w-3 h-3 text-gray-500 mt-0.5" />
              <div>
                <span className="font-medium text-gray-600">Origen:</span>
                <div className="text-gray-700">{details?.origen}</div>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <MapPin className="w-3 h-3 text-gray-500 mt-0.5" />
              <div>
                <span className="font-medium text-gray-600">Destino:</span>
                <div className="text-gray-700">{details?.destino}</div>
              </div>
            </div>
            
            {details?.tripId && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600">ID Viaje:</span>
                <span>{details.tripId}</span>
              </div>
            )}
            
            {details?.contacto?.telefono && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600">Teléfono:</span>
                <span>{details.contacto.telefono}</span>
              </div>
            )}
          </div>
          
          {details?.notas && (
            <div className="mt-3 pt-3 border-t border-blue-200">
              <div className="flex items-start gap-2">
                <FileText className="w-3 h-3 text-gray-500 mt-0.5" />
                <div>
                  <span className="font-medium text-gray-600">Notas:</span>
                  <div className="text-gray-700">{details.notas}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    } else if (transaction.type === 'package') {
      return (
        <div className="mt-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-orange-600" />
            <span className="font-medium text-orange-800">Detalles de la Paquetería</span>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">ID Paquete:</span>
              <span>#{details?.id}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Remitente:</span>
              <span>{details?.remitente}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Destinatario:</span>
              <span>{details?.destinatario}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="font-medium text-gray-600">Asientos:</span>
              <span>{details?.asientos || 0}</span>
            </div>
            
            <div className="flex items-start gap-2">
              <MapPin className="w-3 h-3 text-gray-500 mt-0.5" />
              <div>
                <span className="font-medium text-gray-600">Origen:</span>
                <div className="text-gray-700">{details?.origen}</div>
              </div>
            </div>
            
            <div className="flex items-start gap-2">
              <MapPin className="w-3 h-3 text-gray-500 mt-0.5" />
              <div>
                <span className="font-medium text-gray-600">Destino:</span>
                <div className="text-gray-700">{details?.destino}</div>
              </div>
            </div>
            
            {details?.tripId && (
              <div className="flex items-center gap-2">
                <span className="font-medium text-gray-600">ID Viaje:</span>
                <span>{details.tripId}</span>
              </div>
            )}
          </div>
          
          {details?.descripcion && (
            <div className="mt-3 pt-3 border-t border-orange-200">
              <div className="flex items-start gap-2">
                <FileText className="w-3 h-3 text-gray-500 mt-0.5" />
                <div>
                  <span className="font-medium text-gray-600">Descripción:</span>
                  <div className="text-gray-700">{details.descripcion}</div>
                </div>
              </div>
            </div>
          )}
          
          {details?.notas && (
            <div className="mt-3 pt-3 border-t border-orange-200">
              <div className="flex items-start gap-2">
                <FileText className="w-3 h-3 text-gray-500 mt-0.5" />
                <div>
                  <span className="font-medium text-gray-600">Notas:</span>
                  <div className="text-gray-700">{details.notas}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }
    
    return null;
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const calculateTotalAmount = () => {
    if (!transactionHistory) return 0;
    return transactionHistory.reduce((sum, transaction) => sum + transaction.amount, 0);
  };

  const getPaymentMethodStats = () => {
    if (!transactionHistory) return { efectivo: 0, transferencia: 0, tarjeta: 0, total: 0 };
    
    const stats = transactionHistory.reduce((acc, transaction) => {
      // Extraer método de pago de múltiples ubicaciones posibles
      const method = 
        transaction.details?.paymentMethod || 
        transaction.details?.details?.paymentMethod || 
        transaction.details?.details?.advancePaymentMethod ||
        transaction.details?.details?.metodoPago || 
        'efectivo';
      const amount = transaction.amount || 0;
      
      if (method === 'efectivo') {
        acc.efectivo += amount;
      } else if (method === 'transferencia') {
        acc.transferencia += amount;
      } else if (method === 'tarjeta') {
        acc.tarjeta += amount;
      }
      
      acc.total += amount;
      return acc;
    }, { efectivo: 0, transferencia: 0, tarjeta: 0, total: 0 });
    
    return stats;
  };

  return (
    <DefaultLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Historial de Transacciones</h1>
          <Badge variant="outline" className="text-sm">
            {transactionHistory?.length || 0} transacciones
          </Badge>
        </div>

      {/* Filtros */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="w-5 h-5" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
            {/* Fecha inicio */}
            <div>
              <label className="block text-sm font-medium mb-2">Fecha inicio</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                placeholder="Seleccionar fecha"
              />
            </div>

            {/* Fecha fin */}
            <div>
              <label className="block text-sm font-medium mb-2">Fecha fin</label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                placeholder="Seleccionar fecha"
              />
            </div>

            {/* Usuario */}
            <div>
              <label className="block text-sm font-medium mb-2">Usuario</label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los usuarios" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los usuarios</SelectItem>
                  {users?.map((user) => (
                    <SelectItem key={user.id} value={user.id.toString()}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Método de pago */}
            <div>
              <label className="block text-sm font-medium mb-2">Método de pago</label>
              <Select value={selectedPaymentMethod} onValueChange={setSelectedPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los métodos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los métodos</SelectItem>
                  <SelectItem value="efectivo">Efectivo</SelectItem>
                  <SelectItem value="transferencia">Transferencia</SelectItem>
                  <SelectItem value="tarjeta">Tarjeta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Corte */}
            <div>
              <label className="block text-sm font-medium mb-2">Estado de corte</label>
              <Select value={selectedCutoffId} onValueChange={setSelectedCutoffId}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos los estados" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos los estados</SelectItem>
                  <SelectItem value="pending">Pendientes</SelectItem>
                  {uniqueCutoffs.map((cutoffId) => (
                    <SelectItem key={cutoffId} value={cutoffId.toString()}>
                      Corte #{cutoffId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex gap-2 mt-4">
            <Button onClick={handleApplyFilters} disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Aplicando...
                </>
              ) : (
                'Aplicar Filtros'
              )}
            </Button>
            
            {isFiltersChanged && (
              <Button variant="outline" onClick={handleClearFilters}>
                Limpiar Filtros
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Resumen */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Total de transacciones</p>
              <p className="text-2xl font-bold">{transactionHistory?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total efectivo</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(getPaymentMethodStats().efectivo)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total transferencias</p>
              <p className="text-2xl font-bold text-blue-600">{formatCurrency(getPaymentMethodStats().transferencia)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total</p>
              <p className="text-2xl font-bold text-purple-600">{formatCurrency(getPaymentMethodStats().total)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de transacciones */}
      <Card>
        <CardHeader>
          <CardTitle>Transacciones</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center items-center py-8">
              <Loader2 className="w-8 h-8 animate-spin" />
              <span className="ml-2">Cargando transacciones...</span>
            </div>
          ) : !transactionHistory || transactionHistory.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No se encontraron transacciones con los filtros aplicados.
            </div>
          ) : (
            <div className="space-y-4">
              {transactionHistory.map((transaction) => (
                <div key={transaction.id} className="border rounded-lg p-4 hover:bg-gray-50">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      {getTransactionTypeIcon(transaction.type)}
                      <span className="font-medium">Transacción ID</span>
                      <span className="text-sm text-muted-foreground">#{transaction.id}</span>
                      {getPaymentMethodBadge(
                        transaction.details?.paymentMethod || 
                        transaction.details?.details?.paymentMethod || 
                        transaction.details?.details?.advancePaymentMethod ||
                        transaction.details?.details?.metodoPago || 
                        'efectivo'
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`font-bold ${
                        (transaction.details?.paymentMethod || 
                         transaction.details?.details?.paymentMethod || 
                         transaction.details?.details?.advancePaymentMethod ||
                         transaction.details?.details?.metodoPago) === 'transferencia' ? 'text-blue-600' : 'text-green-600'
                      }`}>
                        {formatCurrency(transaction.amount)}
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <User className="w-3 h-3" />
                      <span>{transaction.createdBy.name}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      <span>{formatDateForDisplay(transaction.createdAt)}</span>
                    </div>
                    <div>
                      {transaction.cutoffId ? (
                        <div className="flex items-center gap-2">
                          <span>Corte #{transaction.cutoffId}</span>
                          {getCutoffVerificationBadge(transaction)}
                        </div>
                      ) : (
                        <span className="text-yellow-600">Sin corte</span>
                      )}
                    </div>
                    <div>
                      {getTransactionTypeLabel(transaction.type)}
                    </div>
                  </div>
                  
                  {/* Detalles expandidos de la transacción */}
                  {renderTransactionDetails(transaction)}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      </div>
    </DefaultLayout>
  );
}