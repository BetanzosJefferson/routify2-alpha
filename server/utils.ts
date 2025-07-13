/**
 * FUNCIONES GLOBALES PARA FECHAS LOCALES (BACKEND)
 * Utilizan el mismo código que funciona correctamente en el endpoint /api/admin-trips
 */

/**
 * FUNCIÓN GLOBAL PARA FECHAS LOCALES
 * Obtiene la fecha actual del sistema sin conversión UTC
 * Usa el mismo código que funciona correctamente en el backend
 * @returns Fecha actual en formato YYYY-MM-DD (local, sin UTC)
 */
export function getCurrentLocalDate(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * FUNCIÓN GLOBAL PARA FECHAS LOCALES
 * Convierte cualquier fecha a formato YYYY-MM-DD sin conversión UTC
 * @param date - Fecha en formato Date, string o undefined
 * @returns Fecha en formato YYYY-MM-DD (local, sin UTC)
 */
export function formatDateToLocal(date: Date | string | undefined): string {
  if (!date) return getCurrentLocalDate();
  
  let dateObj: Date;
  
  if (typeof date === 'string') {
    // Para strings, crear fecha local directamente
    const parts = date.split(/[-T]/);
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      dateObj = new Date(year, month, day);
    } else {
      dateObj = new Date(date);
    }
  } else {
    dateObj = date;
  }
  
  // Usar el mismo código que funciona en el backend
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * FUNCIÓN GLOBAL PARA FECHAS LOCALES
 * Convierte fecha a objeto Date normalizado sin problemas de zona horaria
 * @param date - Fecha en formato Date, string o undefined
 * @returns Objeto Date normalizado al inicio del día
 */
export function normalizeToStartOfDay(date: Date | string | undefined): Date {
  if (!date) {
    const today = getCurrentLocalDate();
    const parts = today.split('-');
    return new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, parseInt(parts[2]), 0, 0, 0);
  }
  
  let dateObj: Date;
  
  if (typeof date === 'string') {
    const parts = date.split(/[-T]/);
    if (parts.length >= 3) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10) - 1;
      const day = parseInt(parts[2], 10);
      dateObj = new Date(year, month, day, 0, 0, 0);
    } else {
      dateObj = new Date(date);
    }
  } else {
    dateObj = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0);
  }
  
  return dateObj;
}