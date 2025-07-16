import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog';
import { 
  Search, 
  Clock, 
  DollarSign, 
  User, 
  CheckCircle,
  XCircle,
  AlertTriangle,
  Receipt,
  CreditCard,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import DefaultLayout from '@/components/layout/default-layout';
import { apiRequest } from '@/lib/queryClient';

interface BoxCutoff {
  id: number;
  fecha_inicio: string;
  fecha_fin: string;
  total_ingresos: number;
  total_efectivo: number;
  total_transferencias: number;
  user_id: number;
  createdAt: string;
  updatedAt: string;
  companyId: string;
  check: boolean;
  check_by: number | null;
  check_at: string | null;
  confirmedByName: string | null;
}

interface Transaction {
  id: number;
  details: {
    type: 'reservation' | 'package';
    details: {
      id: number;
      monto: number;
      notas: string;
      metodoPago: string;
      origen?: string;
      destino?: string;
      pasajeros?: string;
      remitente?: string;
      destinatario?: string;
      descripcion?: string;
    };
  };
  cutoff_id: number;
  createdAt: string;
  user_id: number;
  companyId: string;
}

export default function CutoffConfirmationPage() {
  const [cutoffId, setCutoffId] = useState('');
  const [searchedCutoffId, setSearchedCutoffId] = useState<number | null>(null);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const queryClient = useQueryClient();

  // Query para obtener información del corte
  const { data: cutoff, isLoading: isLoadingCutoff, error: cutoffError } = useQuery<BoxCutoff>({
    queryKey: ['/api/cutoffs', searchedCutoffId],
    queryFn: async () => {
      const response = await fetch(`/api/cutoffs/${searchedCutoffId}`);
      if (!response.ok) throw new Error('Error al obtener el corte');
      return response.json();
    },
    enabled: !!searchedCutoffId
  });

  // Query para obtener transacciones del corte
  const { data: transactions, isLoading: isLoadingTransactions } = useQuery<Transaction[]>({
    queryKey: ['/api/cutoffs', searchedCutoffId, 'transactions'],
    queryFn: async () => {
      const response = await fetch(`/api/cutoffs/${searchedCutoffId}/transactions`);
      if (!response.ok) throw new Error('Error al obtener transacciones');
      return response.json();
    },
    enabled: !!searchedCutoffId
  });

  // Mutation para confirmar el corte
  const confirmCutoffMutation = useMutation({
    mutationFn: async (cutoffId: number) => {
      return apiRequest('POST', `/api/cutoffs/${cutoffId}/confirm`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/cutoffs', searchedCutoffId] });
      setShowConfirmModal(false);
    }
  });

  const handleSearch = () => {
    const id = parseInt(cutoffId);
    if (!isNaN(id)) {
      setSearchedCutoffId(id);
    }
  };

  const handleConfirm = () => {
    if (searchedCutoffId) {
      confirmCutoffMutation.mutate(searchedCutoffId);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN'
    }).format(amount);
  };

  const getPaymentMethodColor = (method: string) => {
    switch (method) {
      case 'efectivo':
        return 'bg-green-100 text-green-800';
      case 'transferencia':
        return 'bg-blue-100 text-blue-800';
      case 'tarjeta':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <DefaultLayout>
      <div className="container mx-auto p-6 space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Confirmar Cortes</h1>
          <Badge variant="outline" className="text-sm">
            Sistema de confirmación de cortes
          </Badge>
        </div>

        {/* Buscador */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Buscar Corte
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <label className="block text-sm font-medium mb-2">ID del Corte</label>
                <Input
                  type="number"
                  value={cutoffId}
                  onChange={(e) => setCutoffId(e.target.value)}
                  placeholder="Ingresa el ID del corte"
                  className="w-full"
                />
              </div>
              <Button 
                onClick={handleSearch}
                disabled={!cutoffId || isLoadingCutoff}
                className="flex items-center gap-2"
              >
                {isLoadingCutoff ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Buscando...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Error de búsqueda */}
        {cutoffError && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              {cutoffError.message || 'Error al buscar el corte'}
            </AlertDescription>
          </Alert>
        )}

        {/* Información del corte */}
        {cutoff && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span className="flex items-center gap-2">
                  <Receipt className="w-5 h-5" />
                  Corte #{cutoff.id}
                </span>
                <div className="flex items-center gap-2">
                  {cutoff.check ? (
                    <Badge className="bg-green-100 text-green-800">
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Confirmado
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-yellow-600">
                      <XCircle className="w-4 h-4 mr-1" />
                      Pendiente
                    </Badge>
                  )}
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium">Período</span>
                  </div>
                  <div className="text-sm text-gray-600">
                    <div>Inicio: {format(new Date(cutoff.fecha_inicio), 'PPp', { locale: es })}</div>
                    <div>Fin: {format(new Date(cutoff.fecha_fin), 'PPp', { locale: es })}</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <DollarSign className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium">Totales</span>
                  </div>
                  <div className="text-sm space-y-1">
                    <div>Ingresos: <span className="font-semibold text-green-600">{formatCurrency(cutoff.total_ingresos)}</span></div>
                    <div>Efectivo: <span className="font-semibold text-green-600">{formatCurrency(cutoff.total_efectivo)}</span></div>
                    <div>Transferencias: <span className="font-semibold text-blue-600">{formatCurrency(cutoff.total_transferencias)}</span></div>
                  </div>
                </div>

                {cutoff.check && cutoff.check_at && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-4 h-4 text-green-500" />
                      <span className="text-sm font-medium">Confirmación</span>
                    </div>
                    <div className="text-sm text-gray-600">
                      <div>Confirmado: {format(new Date(cutoff.check_at), 'PPp', { locale: es })}</div>
                      <div>Por: {cutoff.confirmedByName || `Usuario ID: ${cutoff.check_by}`}</div>
                    </div>
                  </div>
                )}
              </div>

              {!cutoff.check && (
                <div className="pt-4 border-t">
                  <Button 
                    onClick={() => setShowConfirmModal(true)}
                    className="w-full md:w-auto"
                    disabled={confirmCutoffMutation.isPending}
                  >
                    {confirmCutoffMutation.isPending ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <CheckCircle className="w-4 h-4 mr-2" />
                        Confirmar Corte
                      </>
                    )}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Transacciones del corte */}
        {transactions && transactions.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="w-5 h-5" />
                Transacciones del Corte ({transactions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {transactions.map((transaction) => (
                  <div key={transaction.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium">
                          {transaction.details.type === 'reservation' ? 'Reservación' : 'Paquete'} #{transaction.details.details.id}
                        </div>
                        <div className="text-sm text-gray-600">
                          {format(new Date(transaction.createdAt), 'PPp', { locale: es })}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-green-600">
                          {formatCurrency(transaction.details.details.monto)}
                        </div>
                        <Badge className={getPaymentMethodColor(transaction.details.details.metodoPago)}>
                          {transaction.details.details.metodoPago}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm text-gray-600">
                      {transaction.details.details.notas}
                    </div>
                    {transaction.details.details.origen && transaction.details.details.destino && (
                      <div className="text-sm text-gray-500 mt-1">
                        {transaction.details.details.origen} → {transaction.details.details.destino}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de confirmación */}
      <Dialog open={showConfirmModal} onOpenChange={setShowConfirmModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar Corte</DialogTitle>
            <DialogDescription>
              Al dar click confirmas que tienes el efectivo y ya verificaste todas las transacciones de esta caja.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirmModal(false)}>
              Cancelar
            </Button>
            <Button onClick={handleConfirm} disabled={confirmCutoffMutation.isPending}>
              {confirmCutoffMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Confirmando...
                </>
              ) : (
                'Confirmar'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DefaultLayout>
  );
}