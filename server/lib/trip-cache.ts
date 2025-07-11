// Sistema de caché en memoria para el servidor
interface ServerCacheEntry {
  data: any[];
  timestamp: number;
  searchKey: string;
}

class ServerTripCache {
  private cache = new Map<string, ServerCacheEntry>();
  private readonly CACHE_DURATION = 20 * 1000; // 20 segundos para datos críticos como asientos
  private readonly MAX_CACHE_SIZE = 100; // Máximo 100 búsquedas en caché

  // Generar clave única para el caché
  private generateKey(params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return sortedParams;
  }

  // Verificar si una entrada del caché es válida
  private isValid(entry: ServerCacheEntry): boolean {
    return Date.now() - entry.timestamp < this.CACHE_DURATION;
  }

  // Limpiar entradas expiradas
  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp >= this.CACHE_DURATION) {
        this.cache.delete(key);
      }
    }
  }

  // Obtener datos del caché
  get(params: Record<string, any>): any[] | null {
    this.cleanExpired();
    
    const key = this.generateKey(params);
    const entry = this.cache.get(key);
    
    if (entry && this.isValid(entry)) {
      console.log(`[ServerTripCache] Cache HIT para: ${key}`);
      return entry.data;
    }
    
    console.log(`[ServerTripCache] Cache MISS para: ${key}`);
    return null;
  }

  // Guardar datos en el caché
  set(params: Record<string, any>, data: any[]): void {
    this.cleanExpired();
    
    // Si el caché está lleno, eliminar la entrada más antigua
    if (this.cache.size >= this.MAX_CACHE_SIZE) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
    
    const key = this.generateKey(params);
    const entry: ServerCacheEntry = {
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      timestamp: Date.now(),
      searchKey: key
    };
    
    this.cache.set(key, entry);
    console.log(`[ServerTripCache] Guardado en cache: ${key} (${data.length} resultados)`);
  }

  // Invalidar todo el caché cuando se crean/modifican viajes
  invalidateAll(): void {
    this.cache.clear();
    console.log(`[ServerTripCache] Cache completamente invalidado`);
  }

  // Invalidar caché relacionado con asientos disponibles
  invalidateSeatsRelatedCache(): void {
    const keysToDelete: string[] = [];
    
    for (const [key, entry] of this.cache.entries()) {
      // Si la entrada contiene datos de viajes con asientos, invalidarla
      if (entry.data && Array.isArray(entry.data) && entry.data.length > 0) {
        const hasAvailableSeats = entry.data.some(item => 
          item.availableSeats !== undefined || 
          (item.tripData && Array.isArray(item.tripData) && 
           item.tripData.some((segment: any) => segment.availableSeats !== undefined))
        );
        
        if (hasAvailableSeats) {
          keysToDelete.push(key);
        }
      }
    }
    
    keysToDelete.forEach(key => {
      this.cache.delete(key);
      console.log(`[ServerTripCache] Invalidado cache por cambio de asientos: ${key}`);
    });
  }

  // Estadísticas del caché
  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Instancia singleton del caché del servidor
export const serverTripCache = new ServerTripCache();