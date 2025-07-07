import React, { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Clock, DollarSign, MapPin } from "lucide-react";
import { PageTitle } from '@/components/ui/page-title';
import { RouteTemplate, Route } from '@shared/schema';

// Validation schema
const templateSchema = z.object({
  name: z.string().min(1, "El nombre es requerido"),
  routeId: z.number().min(1, "Debe seleccionar una ruta"),
});

type TemplateFormData = z.infer<typeof templateSchema>;

interface TemplateFormProps {
  template?: RouteTemplate | null;
  routes: Route[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
  isLoading?: boolean;
}

interface TimeConfig {
  hours: number;
  minutes: number;
}

interface PriceSegment {
  origin: string;
  destination: string;
  price: number;
}

export function TemplateForm({ template, routes, onSubmit, onCancel, isLoading }: TemplateFormProps) {
  const [selectedRoute, setSelectedRoute] = useState<Route | null>(null);
  const [timeConfig, setTimeConfig] = useState<Record<string, TimeConfig>>({});
  const [priceSegments, setPriceSegments] = useState<PriceSegment[]>([]);

  const { register, handleSubmit, setValue, watch, formState: { errors } } = useForm<TemplateFormData>({
    resolver: zodResolver(templateSchema),
    defaultValues: {
      name: template?.name || '',
      routeId: template?.routeId || 0,
    }
  });

  const watchedRouteId = watch('routeId');

  // Parse city name (remove terminal/location details)
  const parseCityName = (fullLocation: string): string => {
    return fullLocation.split(' - ')[0] || fullLocation;
  };

  // Check if two locations are in the same city
  const isSameCity = (location1: string, location2: string): boolean => {
    return parseCityName(location1) === parseCityName(location2);
  };

  // Generate route segments for pricing (grouped by cities like publish trip)
  const generatePriceSegments = (route: Route): PriceSegment[] => {
    const allSegments: PriceSegment[] = [];
    const locations = [route.origin, ...route.stops, route.destination];
    
    // Generate all possible combinations
    for (let i = 0; i < locations.length; i++) {
      for (let j = i + 1; j < locations.length; j++) {
        const segment = {
          origin: locations[i],
          destination: locations[j],
          price: 0
        };
        allSegments.push(segment);
      }
    }

    // Filter out segments within the same city
    const validSegments = allSegments.filter(segment => 
      !isSameCity(segment.origin, segment.destination)
    );

    // Group segments by city pairs (like in publish trip)
    const cityGroups: {[key: string]: PriceSegment[]} = {};
    const cityPairs: {origin: string, destination: string}[] = [];
    
    validSegments.forEach(segment => {
      const originCity = parseCityName(segment.origin);
      const destCity = parseCityName(segment.destination);
      const key = `${originCity}||${destCity}`;
      
      if (!cityGroups[key]) {
        cityGroups[key] = [];
        cityPairs.push({
          origin: originCity,
          destination: destCity
        });
      }
      
      cityGroups[key].push(segment);
    });

    // Return only one segment per city pair (for pricing configuration)
    return cityPairs.map(pair => ({
      origin: pair.origin,
      destination: pair.destination,
      price: 0
    }));
  };

  // Generate time configuration for consecutive segments
  const generateTimeSegments = (route: Route): Record<string, TimeConfig> => {
    const timeSegments: Record<string, TimeConfig> = {};
    const locations = [route.origin, ...route.stops, route.destination];
    
    // Generate segments between consecutive stops only
    for (let i = 0; i < locations.length - 1; i++) {
      const segmentKey = `${locations[i]} → ${locations[i + 1]}`;
      timeSegments[segmentKey] = { hours: 0, minutes: 30 }; // Default 30 minutes
    }
    
    return timeSegments;
  };

  // Calculate how many stop combinations are affected by a city price
  const calculateAffectedCombinations = (originCity: string, destCity: string): number => {
    if (!selectedRoute) return 0;
    
    const locations = [selectedRoute.origin, ...selectedRoute.stops, selectedRoute.destination];
    let count = 0;
    
    for (let i = 0; i < locations.length; i++) {
      for (let j = i + 1; j < locations.length; j++) {
        const segmentOriginCity = parseCityName(locations[i]);
        const segmentDestCity = parseCityName(locations[j]);
        
        if (segmentOriginCity === originCity && segmentDestCity === destCity) {
          count++;
        }
      }
    }
    
    return count;
  };

  // Update price for a city pair (affects all combinations in that city pair)
  const updatePriceSegment = (index: number, newPrice: number) => {
    const updatedSegments = [...priceSegments];
    updatedSegments[index].price = newPrice;
    setPriceSegments(updatedSegments);
  };

  // Update when route changes
  useEffect(() => {
    if (watchedRouteId && routes.length > 0) {
      const route = routes.find(r => r.id === watchedRouteId);
      if (route) {
        setSelectedRoute(route);
        
        // Load existing configuration if editing template
        if (template?.timeConfiguration && template?.priceConfiguration) {
          setTimeConfig(template.timeConfiguration as Record<string, TimeConfig>);
          setPriceSegments(template.priceConfiguration as PriceSegment[]);
        } else {
          // Initialize new configurations
          setTimeConfig(generateTimeSegments(route));
          setPriceSegments(generatePriceSegments(route));
        }
      }
    }
  }, [watchedRouteId, routes, template]);

  // Update time configuration
  const updateTimeConfig = (segmentKey: string, hours: number, minutes: number) => {
    setTimeConfig(prev => ({
      ...prev,
      [segmentKey]: { hours, minutes }
    }));
  };



  const onFormSubmit = (data: TemplateFormData) => {
    onSubmit({
      ...data,
      timeConfiguration: timeConfig,
      priceConfiguration: priceSegments,
    });
  };

  const formatLocationName = (location: string) => {
    const parts = location.split(' - ');
    return parts.length > 1 ? `${parts[0]} - ${parts[1]}` : location;
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center mb-6">
        <Button 
          variant="ghost" 
          onClick={onCancel}
          className="mr-4"
        >
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
                className="mt-1"
              />
              {errors.name && (
                <p className="text-sm text-red-600 mt-1">{errors.name.message}</p>
              )}
            </div>

            <div>
              <Label htmlFor="routeId">Ruta</Label>
              <Select onValueChange={(value) => setValue('routeId', parseInt(value))}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Seleccione una ruta" />
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
                <p className="text-sm text-red-600 mt-1">{errors.routeId.message}</p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Time Configuration */}
        {selectedRoute && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="w-5 h-5 mr-2" />
                Configuración de Tiempos
              </CardTitle>
              <CardDescription>
                Define el tiempo de viaje entre cada parada consecutiva
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(timeConfig).map(([segmentKey, time]) => (
                  <div key={segmentKey} className="flex items-center space-x-4 p-4 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <MapPin className="w-4 h-4 text-gray-500" />
                        <span className="font-medium">{segmentKey}</span>
                      </div>
                    </div>
                    <div className="flex items-center space-x-2">
                      <div>
                        <Label className="text-xs">Horas</Label>
                        <Input
                          type="number"
                          min="0"
                          max="23"
                          value={time.hours}
                          onChange={(e) => updateTimeConfig(segmentKey, parseInt(e.target.value) || 0, time.minutes)}
                          className="w-16 text-center"
                        />
                      </div>
                      <span className="text-gray-500">:</span>
                      <div>
                        <Label className="text-xs">Minutos</Label>
                        <Input
                          type="number"
                          min="0"
                          max="59"
                          value={time.minutes}
                          onChange={(e) => updateTimeConfig(segmentKey, time.hours, parseInt(e.target.value) || 0)}
                          className="w-16 text-center"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Price Configuration */}
        {selectedRoute && priceSegments.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <DollarSign className="w-5 h-5 mr-2" />
                Configuración de Precios
              </CardTitle>
              <CardDescription>
                Configure el precio entre ciudades principales. Este precio se aplicará automáticamente a todas las combinaciones de paradas entre las mismas ciudades.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="mb-4 p-4 bg-blue-50 rounded-lg">
                <h4 className="font-semibold text-blue-900 mb-2">Configuración por ciudades</h4>
                <p className="text-sm text-blue-700">
                  Configure el precio entre ciudades principales. Este precio se aplicará automáticamente a todas las combinaciones de paradas entre las mismas ciudades.
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="grid grid-cols-4 gap-4 text-sm font-medium text-gray-700 pb-2 border-b">
                  <div>Ciudad Origen</div>
                  <div>Ciudad Destino</div>
                  <div>Precio</div>
                  <div>Paradas Afectadas</div>
                </div>
                {priceSegments.map((segment, index) => {
                  // Calculate affected combinations count
                  const affectedCount = calculateAffectedCombinations(segment.origin, segment.destination);
                  
                  return (
                    <div key={index} className="grid grid-cols-4 gap-4 items-center">
                      <div className="text-sm font-medium">{segment.origin}</div>
                      <div className="text-sm font-medium">{segment.destination}</div>
                      <div className="flex items-center space-x-2">
                        <span className="text-gray-500">$</span>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={segment.price}
                          onChange={(e) => updatePriceSegment(index, parseFloat(e.target.value) || 0)}
                          className="w-24"
                        />
                      </div>
                      <div className="text-sm text-gray-600">
                        {affectedCount} combinaciones
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Form Actions */}
        <div className="flex justify-end space-x-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Guardando...' : template ? 'Actualizar Plantilla' : 'Crear Plantilla'}
          </Button>
        </div>
      </form>
    </div>
  );
}