import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/hooks/use-auth';
import { tripCache } from '@/lib/trip-cache';
import { useToast } from '@/hooks/use-toast';

interface SeatNotification {
  type: 'seat_availability_update';
  recordId: number;
  tripId: string;
  seatsReduced?: number;
  seatsReleased?: number;
  message: string;
}

export function useSeatNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const connect = () => {
    if (!user) return;

    const wsUrl = `ws://localhost:5000/ws`;
    wsRef.current = new WebSocket(wsUrl);

    wsRef.current.onopen = () => {
      console.log('[WebSocket] Conexión establecida para notificaciones de asientos');
      
      // Autenticar usuario
      wsRef.current?.send(JSON.stringify({
        type: 'auth',
        userId: user.id
      }));
    };

    wsRef.current.onmessage = (event) => {
      try {
        const notification: SeatNotification = JSON.parse(event.data);
        
        if (notification.type === 'seat_availability_update') {
          console.log('[WebSocket] Notificación de asientos recibida:', notification);
          
          // Invalidar caché del cliente
          tripCache.invalidateSeatsCache();
          
          // Invalidar queries relacionadas
          queryClient.invalidateQueries({ queryKey: ["/api/trips"] });
          queryClient.invalidateQueries({ queryKey: ["/api/trips-optimized"] });
          
          // Mostrar notificación visual opcional (solo para cambios significativos)
          if (notification.seatsReduced && notification.seatsReduced > 0) {
            toast({
              title: "Asientos actualizados",
              description: `${notification.seatsReduced} asientos ocupados en viaje ${notification.recordId}`,
              duration: 3000,
            });
          }
          
          console.log('[WebSocket] Caché invalidado y consultas actualizadas');
        }
      } catch (error) {
        console.error('[WebSocket] Error procesando notificación:', error);
      }
    };

    wsRef.current.onclose = () => {
      console.log('[WebSocket] Conexión cerrada, intentando reconectar...');
      
      // Reconectar después de 3 segundos
      reconnectTimeoutRef.current = setTimeout(() => {
        connect();
      }, 3000);
    };

    wsRef.current.onerror = (error) => {
      console.error('[WebSocket] Error en conexión:', error);
    };
  };

  const disconnect = () => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  };

  useEffect(() => {
    if (user) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [user]);

  return {
    isConnected: wsRef.current?.readyState === WebSocket.OPEN,
    reconnect: connect,
    disconnect
  };
}