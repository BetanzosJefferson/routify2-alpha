import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Plus, Trash2, Clock, DollarSign } from "lucide-react";
import { PageTitle } from '@/components/ui/page-title';
import { RouteTemplate, Route } from '@shared/schema';

// Validation schema
const templateSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  routeId: z.number().min(1, "Debe seleccionar una ruta"),
  timeConfiguration: z.record(z.number().min(1, "Los tiempos deben ser mayores a 0")),
  priceConfiguration: z.record(z.number().min(0, "Los precios no pueden ser negativos")),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateFormProps {
  template?: RouteTemplate | null;
  routes: Route[];
  onSubmit: (data: TemplateFormData) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export function TemplateForm({ template, routes, onSubmit, onCancel, isLoading }: TemplateFormProps) {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [timeConfig, setTimeConfig] = useState<Record<string, number>>({});
  const [priceConfig, setPriceConfig] = useState<Record<string, number>>({});

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name || '',
      routeId: template?.routeId || 0,
      timeConfiguration: template?.timeConfiguration as Record<string, number> || {},
      priceConfiguration: template?.priceConfiguration as Record<string, number> || {},
    }
  });

  const watchedRouteId = watch('routeId');

  // Update selected route when routeId changes
  useEffect(() => {
    if (watchedRouteId && routes.length > 0) {
      const route = routes.find(r => r.id === watchedRouteId);
      setSelectedRoute(route || null);
      
      // If editing existing template, load its configurations
      if (template && route) {
        const timeConf = template.timeConfiguration as Record<string, number> || {};
        const priceConf = template.priceConfiguration as Record<string, number> || {};
        setTimeConfig(timeConf);
        setPriceConfig(priceConf);
      } else if (route) {
        // Initialize with empty config for new template
        const segments = generateSegments(route);
        const newTimeConfig: Record<string, number> = {};
        const newPriceConfig: Record<string, number> = {};
        
        segments.forEach(segment => {
          newTimeConfig[segment] = 0;
          newPriceConfig[segment] = 0;
        });
        
        setTimeConfig(newTimeConfig);
        setPriceConfig(newPriceConfig);
      }
    }
  }, [watchedRouteId, routes, template]);

  // Generate segment names from route stops
  const generateSegments = (route: Route): string[] => {
    const allStops = [route.origin, ...route.stops, route.destination];
    const segments: string[] = [];
    
    for (let i = 0; i < allStops.length - 1; i++) {
      const origin = allStops[i].split(' - ')[0] || allStops[i];
      const destination = allStops[i + 1].split(' - ')[0] || allStops[i + 1];
      segments.push(`${origin} → ${destination}`);
    }
    
    return segments;
  };

  const updateTimeConfig = (segment: string, value: number) => {
    const newConfig = { ...timeConfig, [segment]: value };
    setTimeConfig(newConfig);
    setValue('timeConfiguration', newConfig);
  };

  const updatePriceConfig = (segment: string, value: number) => {
    const newConfig = { ...priceConfig, [segment]: value };
    setPriceConfig(newConfig);
    setValue('priceConfiguration', newConfig);
  };

  const onFormSubmit = (data: TemplateFormData) => {
    onSubmit({
      ...data,
      timeConfiguration: timeConfig,
      priceConfiguration: priceConfig,
    });
  };

  const segments = selectedRoute ? generateSegments(selectedRoute) : [];

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button variant="ghost" className="mr-4" onClick={onCancel}>
          <ArrowLeft className="w-4 h-4 mr-2" />
          Volver
        </Button>
        <PageTitle 
          title={template ? "Editar Plantilla" : "Nueva Plantilla"} 
          description="Configure tiempos y precios predefinidos para agilizar la creación de viajes" 
        />
      </div>

      <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
        {/* Basic Information */}
        <Card>
          <CardHeader>
            <CardTitle>Información Básica</CardTitle>
            <CardDescription>
              Nombre de la plantilla y ruta asociada
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="name">Nombre de la Plantilla</Label>
              <Input
                id="name"
                {...register('name')}
                placeholder="Ej: Acapulco-CDMX Express"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && (
                <p className="text-sm text-red-500 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="routeId">Ruta</Label>
              <Select 
                value={watchedRouteId?.toString() || ''} 
                onValueChange={(value) => setValue('routeId', parseInt(value))}
              >
                <SelectTrigger className={errors.routeId ? 'border-red-500' : ''}>
                  <SelectValue placeholder="Selecciona una ruta" />
                </SelectTrigger>
                <SelectContent>
                  {routes.map((route) => (
                    <SelectItem key={route.id} value={route.id.toString()}>
                      {route.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.routeId && (
                <p className="text-sm text-red-500 mt-1">{errors.routeId.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Time Configuration */}
        {selectedRoute && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="w-5 h-5" />
                Configuración de Tiempos
              </CardTitle>
              <CardDescription>
                Define el tiempo en minutos para cada segmento de la ruta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {segments.map((segment, index) => (
                  <div key={segment} className="flex items-center space-x-4">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{segment}</Label>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        placeholder="min"
                        value={timeConfig[segment] || ''}
                        onChange={(e) => updateTimeConfig(segment, parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-8">min</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Price Configuration */}
        {selectedRoute && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="w-5 h-5" />
                Configuración de Precios
              </CardTitle>
              <CardDescription>
                Define el precio para cada segmento de la ruta
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {segments.map((segment, index) => (
                  <div key={segment} className="flex items-center space-x-4">
                    <div className="flex-1">
                      <Label className="text-sm font-medium">{segment}</Label>
                    </div>
                    <div className="w-24">
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="0.00"
                        value={priceConfig[segment] || ''}
                        onChange={(e) => updatePriceConfig(segment, parseFloat(e.target.value) || 0)}
                      />
                    </div>
                    <span className="text-sm text-gray-500 w-8">$</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading || !selectedRoute}>
            {isLoading ? 'Guardando...' : (template ? 'Actualizar Plantilla' : 'Crear Plantilla')}
          </Button>
        </div>
      </form>
    </div>
  );
}