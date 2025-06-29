import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { format, addDays, eachDayOfInterval, parseISO, startOfDay, endOfDay, isEqual, isSameDay } from "date-fns";
import { es } from "date-fns/locale";
import { RouteWithSegments, SegmentPrice } from "@shared/schema";
 
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Convierte cualquier formato de fecha a un objeto Date en el inicio del día en hora local
 * preservando correctamente la zona horaria
 * @param date - Fecha en formato Date o string
 * @returns Objeto Date normalizado al inicio del día
 */
export function normalizeToStartOfDay(date: Date | string): Date {
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // Para strings de fecha, extraer componentes directamente
    let parts: string[];
    
    if (date.includes('T')) {
      // Formato ISO: extraer solo la parte de fecha
      parts = date.split('T')[0].split('-');
    } else {
      // Formato YYYY-MM-DD simple
      parts = date.split('-');
    }
    
    if (parts.length === 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1; // Meses en JS son 0-11
      const day = parseInt(parts[2], 10);
      
      // Crear fecha local simple
      dateObj = new Date(year, month, day, 12, 0, 0);
    } else {
      // Fallback para otros formatos
      const tempDate = new Date(date);
      dateObj = new Date(
        tempDate.getFullYear(),
        tempDate.getMonth(),
        tempDate.getDate(),
        12, 0, 0
      );
    }
  } else {
    // Para Date objects (fecha actual del sistema), usar zona horaria de México
    const mexicoDateString = new Date().toLocaleDateString("sv-SE", {timeZone: "America/Mexico_City"});
    const parts = mexicoDateString.split('-');
    
    const year = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Meses en JS son 0-11
    const day = parseInt(parts[2], 10);
    
    console.log(`[normalizeToStartOfDay] Fecha sistema en México: ${mexicoDateString}`);
    
    // Crear fecha con hora 12:00 para mantener consistencia
    dateObj = new Date(year, month, day, 12, 0, 0);
  }
  
  return dateObj;
}

/**
 * Convierte cualquier formato de fecha a un objeto Date al final del día en hora local
 * @param date - Fecha en formato Date o string
 * @returns Objeto Date normalizado al final del día
 */
export function normalizeToEndOfDay(date: Date | string): Date {
  return endOfDay(normalizeToStartOfDay(date));
}

/**
 * Compara si dos fechas representan el mismo día, independientemente de la hora
 * @param dateA - Primera fecha a comparar
 * @param dateB - Segunda fecha a comparar
 * @returns true si ambas fechas representan el mismo día
 */
export function isSameLocalDay(dateA: Date | string, dateB: Date | string): boolean {
  // Extract date components directly for comparison
  let dateStringA: string;
  let dateStringB: string;
  
  // Convert to YYYY-MM-DD format for comparison
  if (typeof dateA === 'string') {
    dateStringA = dateA.includes('T') ? dateA.split('T')[0] : dateA;
  } else {
    dateStringA = dateA.toISOString().split('T')[0];
  }
  
  if (typeof dateB === 'string') {
    dateStringB = dateB.includes('T') ? dateB.split('T')[0] : dateB;
  } else {
    dateStringB = dateB.toISOString().split('T')[0];
  }
  
  return dateStringA === dateStringB;
}

/**
 * Formatea una fecha para mostrarla al usuario
 * @param date - Fecha a formatear
 * @returns Fecha formateada como string
 */
export function formatDate(date: Date | string | null | undefined): string {
  // Si la fecha es null o undefined, devolver un valor por defecto
  if (date === null || date === undefined) {
    return 'N/A';
  }
  
  try {
    // Para depuración: imprimir la fecha antes de procesarla
    console.log(`[formatDate] Fecha original: ${date instanceof Date ? date.toISOString() : date}`);
    
    // Crear fecha manualmente para evitar problemas de zona horaria
    let dateObj: Date;
    
    if (typeof date === 'string') {
      if (date.includes('T')) {
        // Extraer los componentes de la fecha ISO directamente
        const datePart = date.split('T')[0];
        const [year, month, day] = datePart.split('-').map(Number);
        
        // Crear fecha local con el mismo día, mes y año
        dateObj = new Date(year, month - 1, day, 12, 0, 0);
      } else {
        // Formato simple YYYY-MM-DD
        const [year, month, day] = date.split('-').map(Number);
        dateObj = new Date(year, month - 1, day, 12, 0, 0);
      }
    } else if (date instanceof Date) {
      // Extraer componentes de la fecha
      const year = date.getFullYear();
      const month = date.getMonth();
      const day = date.getDate();
      // Crear nueva fecha local con los mismos componentes
      dateObj = new Date(year, month, day, 12, 0, 0);
    } else {
      throw new Error('Formato de fecha no válido');
    }
    
    console.log(`[formatDate] Fecha procesada: ${dateObj.toISOString()}`);
    
    const result = format(dateObj, 'dd/MM/yyyy', { locale: es });
    console.log(`[formatDate] Resultado: ${result}`);
    return result;
  } catch (error) {
    console.error(`[formatDate] Error al formatear fecha:`, error);
    return 'Fecha inválida';
  }
}

/**
 * Formatea una fecha en formato largo (ej: "30 de abril de 2025")
 * @param date - Fecha a formatear
 * @returns Fecha formateada como string
 */
export function formatDateLong(date: Date | string): string {
  // Para depuración: imprimir la fecha antes de procesarla
  console.log(`[formatDateLong] Fecha original: ${date instanceof Date ? date.toISOString() : date}`);
  
  const normalizedDate = normalizeToStartOfDay(date);
  
  // Para depuración: imprimir la fecha normalizada
  console.log(`[formatDateLong] Fecha normalizada: ${normalizedDate.toISOString()}`);
  
  const result = format(normalizedDate, "d 'de' MMMM 'de' yyyy", { locale: es });
  console.log(`[formatDateLong] Resultado: ${result}`);
  return result;
}

/**
 * Formatea una fecha para usarla en inputs HTML de tipo date (formato YYYY-MM-DD)
 * @param date - Fecha a formatear
 * @returns String en formato YYYY-MM-DD
 */
export function formatDateForInput(date: Date | string): string {
  // Si es un objeto Date, extraer componentes directamente para evitar 
  // problemas de zona horaria
  if (date instanceof Date) {
    // Usar los componentes locales de la fecha
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  } else {
    // Para strings que ya están en formato YYYY-MM-DD, devolverlas directamente
    if (typeof date === 'string' && date.match(/^\d{4}-\d{2}-\d{2}$/)) {
      return date;
    }
    // Para otros formatos, normalizar
    const normalizedDate = normalizeToStartOfDay(date);
    return dateToLocalISOString(normalizedDate);
  }
}

export function formatTime(time: string): string {
  return time;
}

export function formatPrice(price: number | null | undefined): string {
  if (price === null || price === undefined) {
    return '$0 MXN';
  }
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(price);
}

/**
 * Formatea un valor numérico como moneda
 * @param amount - Cantidad a formatear
 * @returns String formateado como moneda (ej: $1,234.56 MXN)
 */
export function formatCurrency(amount: number | null | undefined): string {
  if (amount === null || amount === undefined) {
    return '$0.00 MXN';
  }
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 2,
  }).format(amount);
}

export function generateTripsForDateRange(
  startDateStr: string, 
  endDateStr: string
): Date[] {
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  return eachDayOfInterval({
    start: startDate,
    end: endDate
  });
}

export function convertTo24Hour(
  hour: string, 
  minute: string, 
  ampm: string
): string {
  let hourNum = parseInt(hour, 10);
  
  if (ampm === "PM" && hourNum < 12) {
    hourNum += 12;
  } else if (ampm === "AM" && hourNum === 12) {
    hourNum = 0;
  }
  
  return `${hourNum.toString().padStart(2, '0')}:${minute.padStart(2, '0')}`;
}

export function convertTo12Hour(time24: string): { 
  hour: string; 
  minute: string; 
  ampm: string; 
} {
  const [hour24, minute] = time24.split(':');
  let hour = parseInt(hour24, 10);
  let ampm = "AM";
  
  if (hour >= 12) {
    ampm = "PM";
    if (hour > 12) {
      hour -= 12;
    }
  } else if (hour === 0) {
    hour = 12;
  }
  
  return {
    hour: hour.toString(),
    minute,
    ampm
  };
}

export function generateSegmentsFromRoute(route: RouteWithSegments): SegmentPrice[] {
  const segments: SegmentPrice[] = [];
  
  // Crear array con todas las ubicaciones en orden: origen, paradas, destino
  const allLocations = [route.origin, ...route.stops, route.destination];
  
  // Generar todas las combinaciones posibles de origen-destino
  for (let i = 0; i < allLocations.length; i++) {
    for (let j = i + 1; j < allLocations.length; j++) {
      segments.push({
        origin: allLocations[i],
        destination: allLocations[j],
        price: 0
      });
    }
  }
  
  return segments;
}

export function generateReservationId(id: number): string {
  return `RES${id}`;
}

export function isSameCity(location1: string, location2: string): boolean {
  // Extract city name (assuming format "City - Location")
  const city1 = location1.split(' - ')[0].trim();
  const city2 = location2.split(' - ')[0].trim();
  
  return city1 === city2;
}

// Función para extraer el nombre de la ciudad de una ubicación completa
export function getCityName(location: string): string {
  try {
    if (!location) return "";
    // Formato esperado: "Ciudad, Estado - Ubicación"
    return location.split(' - ')[0].trim();
  } catch (error) {
    console.error(`Error extrayendo ciudad de ${location}:`, error);
    return location || "";
  }
}

// Función para agrupar segmentos por ciudades
export function groupSegmentsByCity(segments: any[]): { 
  cityGroups: {[key: string]: any[]}, 
  cityPairs: {origin: string, destination: string}[] 
} {
  const cityGroups: {[key: string]: any[]} = {};
  const cityPairs: {origin: string, destination: string}[] = [];
  
  // Primera pasada: agrupar segmentos por pares de ciudades
  segments.forEach(segment => {
    const originCity = getCityName(segment.origin);
    const destCity = getCityName(segment.destination);
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
  
  return { cityGroups, cityPairs };
}

/**
 * Convierte un objeto Date a una cadena ISO para ser usada en inputs tipo date YYYY-MM-DD
 * Este método está diseñado para evitar los problemas de zona horaria
 * @param date - Fecha a convertir 
 * @returns Cadena en formato ISO YYYY-MM-DD
 */
export function dateToLocalISOString(date: Date): string {
  // Extraer componentes de fecha en hora local
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0'); // los meses son 0-indexados
  const day = String(date.getDate()).padStart(2, '0');
  
  // Retornar en formato YYYY-MM-DD
  return `${year}-${month}-${day}`;
}

/**
 * Formatea una fecha para su uso en filtros de API de manera segura con zonas horarias
 * @param date - Fecha a formatear
 * @returns Cadena de fecha en formato ISO para uso en consultas
 */
export function formatDateForApiQuery(date: Date | string): string {
  // Si es un objeto Date, extraer componentes directamente para evitar 
  // problemas de zona horaria
  if (date instanceof Date) {
    // Usar los componentes locales de la fecha
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    console.log(`[formatDateForApiQuery] Fecha por componentes: ${year}-${month}-${day}`);
    return `${year}-${month}-${day}`;
  } else {
    // Para strings, normalizar primero
    const normalizedDate = normalizeToStartOfDay(date);
    return dateToLocalISOString(normalizedDate);
  }
}

/**
 * Crea un objeto Date a partir de una cadena YYYY-MM-DD respetando la zona horaria local
 * @param dateString - Cadena de fecha en formato YYYY-MM-DD
 * @returns Objeto Date 
 */
export function createLocalDateFromString(dateString: string): Date {
  if (!dateString) return new Date();
  
  const [year, month, day] = dateString.split('-').map(Number);
  // Crear fecha a mediodía para evitar problemas con cambios de día por zona horaria
  return new Date(year, month - 1, day, 12, 0, 0);
}
