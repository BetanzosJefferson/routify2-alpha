/**
 * Utilidades para generación dinámica de segmentos desde plantillas
 * PASO 3: Crear función de generación dinámica
 */

import type { RouteTemplate, Route, Trip } from '@shared/schema';

export interface GeneratedSegment {
  price: number;
  origin: string;
  tripId: string;
  isMainTrip: boolean;
  arrivalTime: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  availableSeats: number;
}

/**
 * Genera segmentos dinámicamente desde una plantilla
 * Compatible con estructura actual del frontend
 */
export async function generateSegmentsFromTemplate(
  trip: Trip,
  template: RouteTemplate,
  route: Route
): Promise<GeneratedSegment[]> {
  
  if (!trip.templateId || !trip.departureDate || !trip.departureTime) {
    throw new Error('Trip missing required template fields');
  }

  const segments: GeneratedSegment[] = [];
  const timeConfig = template.timeConfiguration as Record<string, number>;
  const priceConfig = template.priceConfiguration as Array<{
    origin: string;
    destination: string; 
    price: number;
    enabled: boolean;
  }>;

  // Filtrar solo combinaciones habilitadas
  const enabledPrices = priceConfig.filter(config => config.enabled);
  
  // Crear base time para cálculos
  const baseDate = new Date(trip.departureDate + 'T00:00:00');
  const [timeStr, ampm] = trip.departureTime.split(' ');
  const [hours, minutes] = timeStr.split(':').map(Number);
  let departureHour = hours;
  
  if (ampm === 'PM' && hours !== 12) {
    departureHour += 12;
  } else if (ampm === 'AM' && hours === 12) {
    departureHour = 0;
  }

  baseDate.setHours(departureHour, minutes, 0, 0);

  // Generar segmentos para cada combinación habilitada
  let segmentIndex = 0;
  
  for (const priceEntry of enabledPrices) {
    // Encontrar posiciones de origen y destino en las paradas
    const allStops = [route.origin, ...route.stops, route.destination];
    const originIndex = allStops.findIndex(stop => 
      stop.toLowerCase().includes(priceEntry.origin.toLowerCase()) ||
      priceEntry.origin.toLowerCase().includes(stop.toLowerCase())
    );
    const destinationIndex = allStops.findIndex(stop => 
      stop.toLowerCase().includes(priceEntry.destination.toLowerCase()) ||
      priceEntry.destination.toLowerCase().includes(stop.toLowerCase())
    );

    if (originIndex === -1 || destinationIndex === -1) continue;

    // Calcular tiempo de salida (desde origen del segmento)
    let accumulatedMinutes = 0;
    for (let i = 0; i < originIndex; i++) {
      const timeKey = `${i}-${i + 1}`;
      accumulatedMinutes += timeConfig[timeKey] || 30; // default 30 min
    }

    const segmentDepartureTime = new Date(baseDate.getTime() + accumulatedMinutes * 60000);
    
    // Calcular tiempo de llegada (hasta destino del segmento)
    let totalTripMinutes = accumulatedMinutes;
    for (let i = originIndex; i < destinationIndex; i++) {
      const timeKey = `${i}-${i + 1}`;
      totalTripMinutes += timeConfig[timeKey] || 30; // default 30 min
    }

    const segmentArrivalTime = new Date(baseDate.getTime() + totalTripMinutes * 60000);

    // Calcular asientos disponibles desde seat_occupancy
    const occupiedSeats = (trip.seatOccupancy as Record<string, number[]>)?.[segmentIndex.toString()] || [];
    const availableSeats = trip.capacity - occupiedSeats.length;

    // Formatear horarios
    const formatTime = (date: Date): string => {
      let hours = date.getHours();
      const minutes = date.getMinutes();
      const ampm = hours >= 12 ? 'PM' : 'AM';
      
      if (hours > 12) hours -= 12;
      if (hours === 0) hours = 12;
      
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')} ${ampm}`;
    };

    // Determinar fecha del segmento (manejar cruces de medianoche)
    let segmentDate = trip.departureDate;
    if (segmentDepartureTime.getDate() !== baseDate.getDate()) {
      const newDate = new Date(segmentDepartureTime);
      segmentDate = newDate.toISOString().split('T')[0];
    }

    const segment: GeneratedSegment = {
      price: priceEntry.price,
      origin: priceEntry.origin,
      tripId: `${trip.id}_${segmentIndex}`,
      isMainTrip: segmentIndex === 0, // Primer segmento es el principal
      arrivalTime: formatTime(segmentArrivalTime),
      destination: priceEntry.destination,
      departureDate: segmentDate,
      departureTime: formatTime(segmentDepartureTime),
      availableSeats: availableSeats
    };

    segments.push(segment);
    segmentIndex++;
  }

  return segments;
}

/**
 * Convierte trip con tripData legacy a estructura nueva
 * Para compatibilidad durante migración
 */
export function convertLegacyTripData(trip: Trip): GeneratedSegment[] {
  if (!trip.tripData || !Array.isArray(trip.tripData)) {
    return [];
  }

  return (trip.tripData as any[]).map((segment, index) => ({
    price: segment.price || 0,
    origin: segment.origin || '',
    tripId: segment.tripId || `${trip.id}_${index}`,
    isMainTrip: segment.isMainTrip || false,
    arrivalTime: segment.arrivalTime || '',
    destination: segment.destination || '',
    departureDate: segment.departureDate || '',
    departureTime: segment.departureTime || '',
    availableSeats: segment.availableSeats || 0
  }));
}

/**
 * Determina si un viaje usa el sistema legacy o nuevo
 */
export function isLegacyTrip(trip: Trip): boolean {
  return !trip.templateId && !!trip.tripData;
}

/**
 * Función principal para obtener segmentos de cualquier tipo de viaje
 */
export async function getTripSegments(
  trip: Trip,
  template?: RouteTemplate,
  route?: Route
): Promise<GeneratedSegment[]> {
  
  // Si es viaje legacy, usar tripData existente
  if (isLegacyTrip(trip)) {
    return convertLegacyTripData(trip);
  }
  
  // Si es viaje nuevo, generar desde plantilla
  if (template && route) {
    return generateSegmentsFromTemplate(trip, template, route);
  }
  
  throw new Error('Cannot generate segments: missing template or route data');
}