import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit, Trash2, Clock, DollarSign } from "lucide-react";
import { DefaultLayout } from '@/components/layout/default-layout';
import { PageTitle } from '@/components/ui/page-title';
import { apiRequest } from '@/lib/queryClient';
import { useAuth } from '@/hooks/use-auth';
import { RouteTemplate, Route } from '@shared/schema';
import { TemplateForm } from '@/components/templates/template-form';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

export function TemplatesPage() {
  const [view, setView] = useState<'list' | 'form'>('list');
  const [editingTemplate, setEditingTemplate] = useState<RouteTemplate | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; template: RouteTemplate | null }>({ open: false, template: null });
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Fetch templates
  const { data: templates = [], isLoading, error } = useQuery<RouteTemplate[]>({
    queryKey: ['/api/route-templates'],
    queryFn: async () => {
      const response = await fetch('/api/route-templates', {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch templates');
      }
      return response.json();
    },
    enabled: !!user,
  });

  // Fetch routes for the form
  const { data: routes = [] } = useQuery<Route[]>({
    queryKey: ['/api/routes'],
    enabled: !!user,
  });

  // Create template mutation
  const createTemplateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/route-templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to create template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/route-templates'] });
      setView('list');
      setEditingTemplate(null);
    },
  });

  // Update template mutation
  const updateTemplateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: any }) => {
      const response = await fetch(`/api/route-templates/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(data),
      });
      if (!response.ok) throw new Error('Failed to update template');
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/route-templates'] });
      setView('list');
      setEditingTemplate(null);
    },
  });

  // Delete template mutation
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/route-templates/${id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to delete template');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/route-templates'] });
      setDeleteDialog({ open: false, template: null });
    },
  });

  const handleAddTemplate = () => {
    setEditingTemplate(null);
    setView('form');
  };

  const handleEditTemplate = (template: RouteTemplate) => {
    setEditingTemplate(template);
    setView('form');
  };

  const handleDeleteTemplate = (template: RouteTemplate) => {
    setDeleteDialog({ open: true, template });
  };

  const confirmDelete = () => {
    if (deleteDialog.template) {
      deleteTemplateMutation.mutate(deleteDialog.template.id);
    }
  };

  const handleFormSubmit = (data: any) => {
    if (editingTemplate) {
      updateTemplateMutation.mutate({ id: editingTemplate.id, data });
    } else {
      createTemplateMutation.mutate(data);
    }
  };

  const formatTimeConfig = (timeConfig: any) => {
    if (!timeConfig || typeof timeConfig !== 'object') return 'Sin configurar';
    
    const entries = Object.entries(timeConfig);
    if (entries.length === 0) return 'Sin configurar';
    
    return entries.map(([segment, time]: [string, any]) => {
      if (typeof time === 'object' && time.hours !== undefined && time.minutes !== undefined) {
        return `${segment}: ${time.hours}h ${time.minutes}min`;
      }
      // Legacy format (just minutes)
      return `${segment}: ${time}min`;
    }).join(', ');
  };

  const formatPriceConfig = (priceConfig: any) => {
    if (!priceConfig) return 'Sin configurar';
    
    if (Array.isArray(priceConfig)) {
      // New format (array of segments)
      if (priceConfig.length === 0) return 'Sin configurar';
      return `${priceConfig.length} segmentos configurados`;
    }
    
    // Legacy format (object)
    if (typeof priceConfig !== 'object') return 'Sin configurar';
    const entries = Object.entries(priceConfig);
    if (entries.length === 0) return 'Sin configurar';
    return `${entries.length} segmentos configurados`;
  };

  if (error) {
    console.error('Error loading templates:', error);
    return (
      <DefaultLayout>
        <Card>
          <CardHeader>
            <CardTitle>Error</CardTitle>
            <CardDescription>
              No se pudieron cargar las plantillas de rutas.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-gray-600">
              {error instanceof Error ? error.message : 'Error desconocido'}
            </p>
          </CardContent>
        </Card>
      </DefaultLayout>
    );
  }

  if (view === 'form') {
    return (
      <DefaultLayout>
        <TemplateForm
          template={editingTemplate}
          routes={routes}
          onSubmit={handleFormSubmit}
          onCancel={() => setView('list')}
          isLoading={createTemplateMutation.isPending || updateTemplateMutation.isPending}
        />
      </DefaultLayout>
    );
  }

  return (
    <DefaultLayout>
      <div className="container mx-auto py-6">
        <div className="flex justify-between items-center mb-6">
          <PageTitle 
            title="Plantillas de Rutas" 
            description="Gestiona plantillas con horarios y precios predefinidos" 
          />
          <Button onClick={handleAddTemplate}>
            <Plus className="w-4 h-4 mr-2" />
            Nueva Plantilla
          </Button>
        </div>

        {isLoading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-2 text-gray-600">Cargando plantillas...</p>
          </div>
        ) : templates.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <h3 className="text-lg font-medium mb-2">No hay plantillas creadas</h3>
              <p className="text-gray-600 mb-4">
                Crea tu primera plantilla para agilizar la publicación de viajes
              </p>
              <Button onClick={handleAddTemplate}>
                <Plus className="w-4 h-4 mr-2" />
                Nueva Plantilla
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {templates.map((template: RouteTemplate & { route?: Route }) => (
              <Card key={template.id} className="hover:shadow-md transition-shadow">
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle className="text-lg">{template.name}</CardTitle>
                      <CardDescription>
                        {template.route?.name || 'Ruta no encontrada'}
                      </CardDescription>
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleEditTemplate(template)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleDeleteTemplate(template)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium mb-1">
                        <Clock className="w-4 h-4" />
                        Configuración de Tiempos
                      </div>
                      <p className="text-xs text-gray-600 break-all">
                        {formatTimeConfig(template.timeConfiguration)}
                      </p>
                    </div>
                    
                    <div>
                      <div className="flex items-center gap-2 text-sm font-medium mb-1">
                        <DollarSign className="w-4 h-4" />
                        Configuración de Precios
                      </div>
                      <p className="text-xs text-gray-600 break-all">
                        {formatPriceConfig(template.priceConfiguration)}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialog.open} onOpenChange={(open) => setDeleteDialog({ open, template: null })}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar plantilla?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción no se puede deshacer. La plantilla "{deleteDialog.template?.name}" será eliminada permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} disabled={deleteTemplateMutation.isPending}>
              {deleteTemplateMutation.isPending ? 'Eliminando...' : 'Eliminar'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DefaultLayout>
  );
}