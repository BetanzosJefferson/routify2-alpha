import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, Edit, Trash2, DollarSign, TrendingUp, BarChart3, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { useToast } from '@/hooks/use-toast';
import { apiRequest } from '@/lib/queryClient';
import { formatCurrency } from '@/lib/utils';

// Esquema de validación para gastos
const expenseSchema = z.object({
  amount: z.string().min(1, "El monto es requerido").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "El monto debe ser un número mayor a 0"
  ),
  concept: z.string().min(1, "El concepto es requerido").max(500, "El concepto no puede exceder 500 caracteres"),
  periodDays: z.string().min(1, "El período es requerido").refine(
    (val) => !isNaN(Number(val)) && Number(val) > 0,
    "El período debe ser un número mayor a 0"
  ),
  category: z.enum(['gastos_fijos', 'gastos_variables', 'sueldos', 'rentas'], {
    required_error: "La categoría es requerida"
  })
});

type ExpenseFormData = z.infer<typeof expenseSchema>;

interface Expense {
  id: number;
  amount: number;
  concept: string;
  periodDays: number;
  category: string;
  companyId: string;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
  createdByName?: string;
}

// Mapeo de categorías para mostrar
const categoryLabels = {
  'gastos_fijos': 'Gastos Fijos',
  'gastos_variables': 'Gastos Variables', 
  'sueldos': 'Sueldos',
  'rentas': 'Rentas'
};

// Colores para las categorías
const categoryColors = {
  'gastos_fijos': 'bg-blue-100 text-blue-800',
  'gastos_variables': 'bg-green-100 text-green-800',
  'sueldos': 'bg-purple-100 text-purple-800',
  'rentas': 'bg-orange-100 text-orange-800'
};

export function ExpensesPage() {
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<ExpenseFormData>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      amount: '',
      concept: '',
      periodDays: '30',
      category: 'gastos_fijos'
    }
  });

  // Query para obtener gastos
  const { data: expenses = [], isLoading } = useQuery<Expense[]>({
    queryKey: ['/api/expenses'],
    queryFn: async () => {
      const response = await apiRequest('GET', '/api/expenses');
      return response.json();
    }
  });

  // Mutación para crear gasto
  const createExpenseMutation = useMutation({
    mutationFn: (data: ExpenseFormData) => 
      apiRequest('POST', '/api/expenses', {
        amount: parseFloat(data.amount),
        concept: data.concept,
        periodDays: parseInt(data.periodDays),
        category: data.category
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      toast({
        title: "Gasto creado",
        description: "El gasto se ha registrado correctamente."
      });
      setIsDialogOpen(false);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo crear el gasto",
        variant: "destructive"
      });
    }
  });

  // Mutación para actualizar gasto
  const updateExpenseMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: ExpenseFormData }) =>
      apiRequest('PUT', `/api/expenses/${id}`, {
        amount: parseFloat(data.amount),
        concept: data.concept,
        periodDays: parseInt(data.periodDays),
        category: data.category
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      toast({
        title: "Gasto actualizado",
        description: "El gasto se ha actualizado correctamente."
      });
      setIsDialogOpen(false);
      setIsEditMode(false);
      setSelectedExpense(null);
      form.reset();
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo actualizar el gasto",
        variant: "destructive"
      });
    }
  });

  // Mutación para eliminar gasto
  const deleteExpenseMutation = useMutation({
    mutationFn: (id: number) => 
      apiRequest('DELETE', `/api/expenses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/expenses'] });
      toast({
        title: "Gasto eliminado",
        description: "El gasto se ha eliminado correctamente."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "No se pudo eliminar el gasto",
        variant: "destructive"
      });
    }
  });

  const handleSubmit = (data: ExpenseFormData) => {
    if (isEditMode && selectedExpense) {
      updateExpenseMutation.mutate({ id: selectedExpense.id, data });
    } else {
      createExpenseMutation.mutate(data);
    }
  };

  const handleEdit = (expense: Expense) => {
    setSelectedExpense(expense);
    setIsEditMode(true);
    form.reset({
      amount: expense.amount.toString(),
      concept: expense.concept,
      periodDays: expense.periodDays.toString(),
      category: expense.category as any
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (expense: Expense) => {
    deleteExpenseMutation.mutate(expense.id);
  };

  const openCreateDialog = () => {
    setSelectedExpense(null);
    setIsEditMode(false);
    form.reset({
      amount: '',
      concept: '',
      periodDays: '30',
      category: 'gastos_fijos'
    });
    setIsDialogOpen(true);
  };

  // Calcular estadísticas
  const stats = {
    total: expenses.reduce((sum, expense) => sum + expense.amount, 0),
    byCategory: expenses.reduce((acc, expense) => {
      acc[expense.category] = (acc[expense.category] || 0) + expense.amount;
      return acc;
    }, {} as Record<string, number>),
    count: expenses.length
  };

  const isSubmitting = createExpenseMutation.isPending || updateExpenseMutation.isPending;

  if (isLoading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-2 text-gray-600">Cargando gastos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gastos de la Empresa</h1>
          <p className="text-gray-600 mt-1">
            Gestión de gastos fijos, variables, sueldos y rentas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={openCreateDialog}>
              <Plus className="h-4 w-4 mr-2" />
              Nuevo Gasto
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>
                {isEditMode ? 'Editar Gasto' : 'Nuevo Gasto'}
              </DialogTitle>
              <DialogDescription>
                {isEditMode 
                  ? 'Modifica los datos del gasto seleccionado'
                  : 'Registra un nuevo gasto para la empresa'
                }
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Monto (MXN)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="0.00"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="concept"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Concepto</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Describe el gasto..."
                          className="resize-none"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="periodDays"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Período (días)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="30"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Categoría</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona categoría" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="gastos_fijos">Gastos Fijos</SelectItem>
                          <SelectItem value="gastos_variables">Gastos Variables</SelectItem>
                          <SelectItem value="sueldos">Sueldos</SelectItem>
                          <SelectItem value="rentas">Rentas</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    disabled={isSubmitting}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSubmitting}>
                    {isSubmitting
                      ? 'Guardando...'
                      : isEditMode
                      ? 'Actualizar'
                      : 'Crear Gasto'
                    }
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Estadísticas */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total de Gastos</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(stats.total)}</div>
            <p className="text-xs text-muted-foreground">
              {stats.count} gasto{stats.count !== 1 ? 's' : ''} registrado{stats.count !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Fijos</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.byCategory['gastos_fijos'] || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Gastos Variables</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(stats.byCategory['gastos_variables'] || 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sueldos + Rentas</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency((stats.byCategory['sueldos'] || 0) + (stats.byCategory['rentas'] || 0))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabla de gastos */}
      <Card>
        <CardHeader>
          <CardTitle>Lista de Gastos</CardTitle>
          <CardDescription>
            Todos los gastos registrados para la empresa
          </CardDescription>
        </CardHeader>
        <CardContent>
          {expenses.length === 0 ? (
            <div className="text-center py-8">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No hay gastos</h3>
              <p className="mt-1 text-sm text-gray-500">
                Comienza registrando el primer gasto de la empresa.
              </p>
              <div className="mt-6">
                <Button onClick={openCreateDialog}>
                  <Plus className="h-4 w-4 mr-2" />
                  Nuevo Gasto
                </Button>
              </div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Concepto</TableHead>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Monto</TableHead>
                  <TableHead>Período</TableHead>
                  <TableHead>Creado por</TableHead>
                  <TableHead>Fecha</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {expenses.map((expense) => (
                  <TableRow key={expense.id}>
                    <TableCell className="font-medium max-w-xs">
                      <div className="truncate" title={expense.concept}>
                        {expense.concept}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={categoryColors[expense.category as keyof typeof categoryColors]}>
                        {categoryLabels[expense.category as keyof typeof categoryLabels]}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(expense.amount)}
                    </TableCell>
                    <TableCell>
                      {expense.periodDays} día{expense.periodDays !== 1 ? 's' : ''}
                    </TableCell>
                    <TableCell>
                      {expense.createdByName || 'Desconocido'}
                    </TableCell>
                    <TableCell>
                      {new Date(expense.createdAt).toLocaleDateString('es-MX')}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(expense)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>¿Eliminar gasto?</AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta acción no se puede deshacer. Se eliminará permanentemente
                                el gasto "{expense.concept}".
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(expense)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Eliminar
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}