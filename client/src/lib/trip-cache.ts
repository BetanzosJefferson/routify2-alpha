// Sistema de caché inteligente para búsquedas de viajes
interface CacheEntry {
  data: any[];
  timestamp: number;
  searchParams: string;
}

class TripCache {
  private cache = new Map<string, CacheEntry>();
  private readonly CACHE_DURATION = 1 * 60 * 1000; // 1 minuto para viajes que cambian frecuentemente
  private readonly MAX_CACHE_SIZE = 50; // Máximo 50 búsquedas en caché

  // Generar key único basado en parámetros de búsqueda
  private generateKey(params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .filter(key => params[key] !== undefined && params[key] !== null && params[key] !== '')
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&');
    return sortedParams;
  }

  // Verificar si una entrada del caché sigue siendo válida
  private isValid(entry: CacheEntry): boolean {
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
      console.log(`[TripCache] Cache HIT para búsqueda: ${key}`);
      return entry.data;
    }
    
    console.log(`[TripCache] Cache MISS para búsqueda: ${key}`);
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
    const entry: CacheEntry = {
      data: [...data], // Copia profunda para evitar mutaciones
      timestamp: Date.now(),
      searchParams: key
    };
    
    this.cache.set(key, entry);
    console.log(`[TripCache] Guardado en cache: ${key} (${data.length} viajes)`);
  }

  // Invalidar caché relacionado con una búsqueda específica
  invalidate(params?: Record<string, any>): void {
    if (params) {
      const key = this.generateKey(params);
      this.cache.delete(key);
      console.log(`[TripCache] Invalidado cache específico: ${key}`);
    } else {
      this.cache.clear();
      console.log(`[TripCache] Cache completamente limpiado`);
    }
  }

  // Estadísticas del caché
  getStats(): { size: number; entries: string[] } {
    return {
      size: this.cache.size,
      entries: Array.from(this.cache.keys())
    };
  }
}

// Instancia singleton del caché
export const tripCache = new TripCache();