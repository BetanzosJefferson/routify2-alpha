import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Filter, Calendar, User, Receipt, Package } from 'lucide-react';
import { formatDateForDisplay } from '@/lib/utils';
import DefaultLayout from '@/components/layout/default-layout';

interface TransactionHistoryItem {
  id: number;
  details: any;
  createdAt: string;
  cutoffId: number | null;
  cutoffStatus: 'pending' | 'completed';
  createdBy: {
    id: number;
    name: string;
  };
  type: 'reservation' | 'package';
  amount: number;
}

interface User {
  id: number;
  firstName: string;
  lastName: string;
}

export default function TransactionHistoryPage() {
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string>('all');
  const [selectedCutoffId, setSelectedCutoffId] = useState<string>('all');
  const [isFiltersChanged, setIsFiltersChanged] = useState(false);

  // Obtener historial de transacciones
  const { data: transactionHistory, isLoading, refetch } = useQuery<TransactionHistoryItem[]>({
    queryKey: ['/api/transaction-history', { startDate, endDate, userId: selectedUserId, cutoffId: selectedCutoffId }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedUserId && selectedUserId !== 'all') params.append('userId', selectedUserId);
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

  // Obtener usuarios para filtro
  const { data: users } = useQuery<User[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const response = await fetch('/api/users');
      if (!response.ok) throw new Error('Error al obtener usuarios');
      return response.json();
    }
  });

  // Obtener cortes únicos para filtro
  const uniqueCutoffs = React.useMemo(() => {
    if (!transactionHistory) return [];
    
    const cutoffs = new Set<number>();
    transactionHistory.forEach(transaction => {
      if (transaction.cutoffId) {
        cutoffs.add(transaction.cutoffId);
      }
    });
    
    return Array.from(cutoffs).sort((a, b) => b - a);
  }, [transactionHistory]);

  // Detectar cambios en filtros
  useEffect(() => {
    setIsFiltersChanged(startDate !== '' || endDate !== '' || selectedUserId !== 'all' || selectedCutoffId !== 'all');
  }, [startDate, endDate, selectedUserId, selectedCutoffId]);

  const handleClearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSelectedUserId('all');
    setSelectedCutoffId('all');
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
                      {user.firstName} {user.lastName}
                    </SelectItem>
                  ))}
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-sm text-muted-foreground">Total de transacciones</p>
              <p className="text-2xl font-bold">{transactionHistory?.length || 0}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Monto total</p>
              <p className="text-2xl font-bold text-green-600">{formatCurrency(calculateTotalAmount())}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Promedio por transacción</p>
              <p className="text-2xl font-bold text-blue-600">
                {formatCurrency(transactionHistory?.length ? calculateTotalAmount() / transactionHistory.length : 0)}
              </p>
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
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-green-600">{formatCurrency(transaction.amount)}</span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-muted-foreground">
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
                        <span>Corte #{transaction.cutoffId}</span>
                      ) : (
                        <span className="text-yellow-600">Sin corte</span>
                      )}
                    </div>
                  </div>
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