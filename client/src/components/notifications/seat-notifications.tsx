import { useSeatNotifications } from "@/hooks/use-seat-notifications";

export function SeatNotifications() {
  // Inicializar las notificaciones WebSocket
  const { isConnected } = useSeatNotifications();

  // Este componente no renderiza nada, solo maneja las notificaciones
  if (isConnected) {
    console.log('[SeatNotifications] WebSocket conectado para notificaciones de asientos');
  }

  return null;
}