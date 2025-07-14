import { generateReservationTicket60mmPDFWithDownload } from '../trips/reservation-ticket-thermal';
import { generateReservationId } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

export function useCommissionTicketGenerator() {
  const { toast } = useToast();

  const downloadTicket60mm = async (reservation: any, companyName: string) => {
    try {
      toast({
        title: "Generando ticket térmico...",
        description: "Generando boleto de 60mm, por favor espera...",
      });

      // Debug: Mostrar los datos de la reservación
      console.log('🔍 Datos de la reservación para ticket:', reservation);

      // Mapear los datos de la reservación al formato esperado por la función
      const reservationData = {
        id: reservation.id,
        passengerName: reservation.tripDetails?.passengerName || 'Pasajero',
        phone: reservation.tripDetails?.phone || '',
        email: reservation.tripDetails?.email || '',
        origin: reservation.specificOrigin || reservation.trip?.route?.origin || '',
        destination: reservation.specificDestination || reservation.trip?.route?.destination || '',
        departureDate: reservation.trip?.departureDate || '',
        departureTime: reservation.trip?.departureTime || '',
        arrivalTime: reservation.trip?.arrivalTime || '',
        totalAmount: reservation.totalAmount || 0,
        originalPrice: reservation.originalAmount || reservation.totalAmount || 0,
        couponDiscount: reservation.discountAmount || 0,
        advanceAmount: reservation.advanceAmount || 0,
        paymentMethod: reservation.paymentMethod || 'Efectivo', // Método de pago restante
        advancePaymentMethod: reservation.advancePaymentMethod || 'Efectivo', // Método de pago del anticipo
        numPassengers: reservation.tripDetails?.seats || 1,
        passengers: [{ 
          firstName: reservation.tripDetails?.passengerName?.split(' ')[0] || 'Pasajero', 
          lastName: reservation.tripDetails?.passengerName?.split(' ')[1] || '' 
        }],
        couponCode: reservation.couponCode || null,
      };

      // Generar el boleto usando la función especializada con descarga directa
      await generateReservationTicket60mmPDFWithDownload(reservationData, companyName);
      
      toast({
        title: "Boleto generado",
        description: `El boleto térmico de 60mm ha sido generado para la reservación #${generateReservationId(reservation.id)}`,
      });
      
    } catch (error) {
      console.error('Error al generar boleto 60mm:', error);
      toast({
        title: "Error",
        description: "No se pudo generar el boleto. Inténtalo de nuevo.",
        variant: "destructive",
      });
    }
  };

  return { downloadTicket60mm };
}