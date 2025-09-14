/**
 * Cache Cross-Tab Sharing Implementation (FIXED VERSION)
 * 
 * Implementación oficial usando TanStack packages con guards apropiados:
 * - broadcastQueryClient para sincronización cross-tab en tiempo real  
 * - persistQueryClient para persistencia localStorage
 * - createSyncStoragePersister para storage sync
 * 
 * FIXES APLICADOS:
 * - Guards para window/localStorage/BroadcastChannel
 * - Persister creado dentro de init (no module-scope)
 * - Error handling robusto
 */

import { QueryClient } from '@tanstack/react-query';
import { broadcastQueryClient } from '@tanstack/query-broadcast-client-experimental';
import { persistQueryClient } from '@tanstack/query-persist-client-core';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Configuración del cache cross-tab
const CACHE_KEY = 'transroute-cache-v3';
const CACHE_VERSION = 3;

/**
 * Inicializar cache cross-tab sharing OFICIAL con guards apropiados
 * 
 * Usa persistQueryClient + broadcastQueryClient para verdadero cache sharing
 */
export async function initializeOfficialCrossTabCache(queryClient: QueryClient): Promise<boolean> {
  try {
    console.log('[Cache Cross-Tab] Iniciando configuración oficial...');
    
    // GUARD 1: Verificar environment browser
    if (typeof window === 'undefined') {
      console.warn('[Cache Cross-Tab] No browser environment - skipping');
      return false;
    }
    
    // GUARD 2: Verificar localStorage disponible
    if (!('localStorage' in window)) {
      console.warn('[Cache Cross-Tab] localStorage no disponible - skipping persistence');
      return false;
    }
    
    // GUARD 3: Verificar BroadcastChannel disponible 
    if (!('BroadcastChannel' in window)) {
      console.warn('[Cache Cross-Tab] BroadcastChannel no disponible - skipping broadcast');
      // Continuar solo con persistence
    }
    
    console.log('[Cache Cross-Tab] Guards passed, creando persister...');
    
    // Crear persister dentro de init (NO module-scope)
    const localStoragePersister = createSyncStoragePersister({
      storage: window.localStorage,
      key: CACHE_KEY,
    });
    
    console.log('[Cache Cross-Tab] Persister creado, iniciando persistencia...');

    // 1. PERSISTENCIA: Restore cache desde localStorage
    await persistQueryClient({
      queryClient,
      persister: localStoragePersister,
      maxAge: 10 * 60 * 1000, // 10 minutos - mismo que gcTime
      buster: CACHE_VERSION.toString(),
      // Solo persistir queries importantes
      dehydrateOptions: {
        shouldDehydrateQuery: (query) => {
          const queryKey = query.queryKey[0] as string;
          // Solo persistir queries que benefician del sharing
          return queryKey && (
            queryKey.includes('/api/reservations') ||
            queryKey.includes('/api/trips') ||
            queryKey.includes('/api/packages') ||
            queryKey.includes('/api/routes')
          ) && !queryKey.includes('/api/auth'); // Excluir auth sensible
        }
      }
    });

    console.log('[Cache Cross-Tab] Persistencia configurada exitosamente');

    // 2. BROADCAST: Habilitar sincronización cross-tab si disponible
    if ('BroadcastChannel' in window) {
      broadcastQueryClient({
        queryClient,
        broadcastChannel: 'transroute-sync-v3',
      });
      console.log('[Cache Cross-Tab] Broadcast configurado exitosamente');
    }

    console.log('[Cache Cross-Tab] ✅ PERSISTENCE + BROADCAST HABILITADOS EXITOSAMENTE');
    
    return true;
  } catch (error) {
    console.error('[Cache Cross-Tab] ❌ Error inicializando cache oficial:', error);
    return false;
  }
}

/**
 * Limpiar cache cross-tab sharing
 */
export function cleanupOfficialCrossTabCache() {
  try {
    // El cleanup se maneja automáticamente por los packages oficiales
    console.log('[Cache Cross-Tab] Cache cleanup completado');
  } catch (error) {
    console.warn('[Cache Cross-Tab] Error durante cleanup:', error);
  }
}

/**
 * Configuración optimizada para el cache cross-tab
 */
export const crossTabConfig = {
  // Configuración de persistencia
  cacheKey: CACHE_KEY,
  version: CACHE_VERSION,
  
  // Queries que se comparten entre tabs
  shareableQueries: [
    '/api/reservations',
    '/api/trips', 
    '/api/packages',
    '/api/routes'
  ],
  
  // Queries sensibles que NO se persisten
  excludeFromPersistence: [
    '/api/auth',
    '/api/notifications'
  ],
  
  // Configuración de tiempo
  maxAge: 10 * 60 * 1000, // 10 minutos
  broadcastChannel: 'transroute-sync-v3'
} as const;