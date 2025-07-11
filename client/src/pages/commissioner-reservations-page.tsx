import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Download, User, MapPin, Calendar, Clock } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { formatPrice, generateReservationId } from "@/lib/utils";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";
import QRCode from "qrcode";

export default function CommissionerReservationsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  
  // Consultar reservaciones del comisionista
  const { data: reservations, isLoading, error } = useQuery({
    queryKey: ['/api/commissioners', user?.id, 'reservations'],
    queryFn: async () => {
      if (!user?.id) return [];
      const response = await fetch(`/api/commissioners/${user.id}/reservations`);
      if (!response.ok) {
        throw new Error('Error al obtener reservaciones');
      }
      return response.json();
    },
    enabled: !!user?.id
  });

  // Función para generar boleto 60mm
  const downloadTicket60mm = async (reservation: any) => {
    try {
      toast({
        title: "Generando ticket térmico...",
        description: "Generando boleto de 60mm, por favor espera...",
      });

      const { jsPDF } = await import('jspdf');
      
      // Generar código QR para la reservación
      let qrCodeDataUrl;
      try {
        const verificationUrl = `${window.location.origin}/reservation-details?id=${reservation.id}`;
        qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { width: 100 });
      } catch (error) {
        console.error("Error al generar código QR:", error);
        qrCodeDataUrl = null;
      }
      
      // Crear documento PDF con dimensiones de ticket térmico (58mm x 160mm)
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [58, 160],
      });

      // Configuración de fuentes
      doc.setFont("courier", "normal");
      doc.setFontSize(10);

      // Margen superior
      let y = 10;

      // Encabezado
      doc.setFontSize(12);
      doc.setFont("courier", "bold");
      const companyName = user?.company || "TransRoute";
      const companyNameWidth = doc.getStringUnitWidth(companyName) * 12 / doc.internal.scaleFactor;
      const companyNameX = (58 - companyNameWidth) / 2;
      doc.text(companyName, companyNameX, y);
      
      y += 5;
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      doc.text("Boleto de reservación", 29, y, { align: "center" });
      
      // Línea separadora
      y += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(5, y, 53, y);
      
      // ID de la reservación
      y += 5;
      doc.setFontSize(10);
      doc.setFont("courier", "bold");
      doc.text(`RESERVACIÓN #${generateReservationId(reservation.id)}`, 29, y, { align: "center" });
      
      y += 4;
      doc.setFontSize(8);
      doc.text(format(new Date(reservation.createdAt), "dd/MM/yyyy HH:mm", { locale: es }), 29, y, { align: "center" });
      
      // Información del viaje
      if (reservation.trip) {
        y += 6;
        doc.setFontSize(9);
        doc.setFont("courier", "bold");
        doc.text("Ruta", 5, y);
        
        y += 4;
        doc.setFontSize(8);
        doc.setFont("courier", "normal");
        
        // Origen
        const origen = reservation.trip.origin || "";
        const origenCompleto = `Origen: ${origen}`;
        const maxWidth = 48;
        
        if (doc.getStringUnitWidth(origenCompleto) * 8 / doc.internal.scaleFactor > maxWidth) {
          doc.text("Origen:", 5, y);
          y += 3;
          const words = origen.split(' ');
          let line = '';
          for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > maxWidth) {
              doc.text(line, 5, y);
              line = words[i] + ' ';
              y += 3;
            } else {
              line = testLine;
            }
          }
          doc.text(line, 5, y);
          y += 4;
        } else {
          doc.text(origenCompleto, 5, y);
          y += 4;
        }
        
        // Destino
        const destino = reservation.trip.destination || "";
        const destinoCompleto = `Destino: ${destino}`;
        
        if (doc.getStringUnitWidth(destinoCompleto) * 8 / doc.internal.scaleFactor > maxWidth) {
          doc.text("Destino:", 5, y);
          y += 3;
          const words = destino.split(' ');
          let line = '';
          for (let i = 0; i < words.length; i++) {
            const testLine = line + words[i] + ' ';
            if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > maxWidth) {
              doc.text(line, 5, y);
              line = words[i] + ' ';
              y += 3;
            } else {
              line = testLine;
            }
          }
          doc.text(line, 5, y);
          y += 4;
        } else {
          doc.text(destinoCompleto, 5, y);
          y += 4;
        }
        
        // Fecha y hora del viaje
        y += 4;
        doc.text(`Fecha: ${reservation.trip.departureDate}`, 5, y);
        y += 4;
        doc.text(`Hora: ${reservation.trip.departureTime}`, 5, y);
      }

      // Información de pasajeros
      y += 6;
      doc.setFontSize(9);
      doc.setFont("courier", "bold");
      doc.text("Pasajeros", 5, y);
      
      y += 4;
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      
      if (reservation.passengers && reservation.passengers.length > 0) {
        reservation.passengers.forEach((passenger: any) => {
          const passengerName = `${passenger.firstName} ${passenger.lastName}`;
          doc.text(`• ${passengerName}`, 5, y);
          y += 3;
        });
      } else {
        doc.text("No especificado", 5, y);
        y += 3;
      }

      // Información de pago
      y += 6;
      doc.setFontSize(9);
      doc.setFont("courier", "bold");
      doc.text("Pago", 5, y);
      
      y += 4;
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      doc.text(`Total: ${formatPrice(reservation.totalAmount)}`, 5, y);
      y += 3;
      
      if (reservation.advancePayment > 0) {
        doc.text(`Anticipo: ${formatPrice(reservation.advancePayment)}`, 5, y);
        y += 3;
        doc.text(`Restante: ${formatPrice(reservation.remainingBalance)}`, 5, y);
        y += 3;
      }
      
      if (reservation.paymentMethod) {
        doc.text(`Método: ${reservation.paymentMethod}`, 5, y);
        y += 3;
      }

      // Contacto
      y += 6;
      doc.setFontSize(9);
      doc.setFont("courier", "bold");
      doc.text("Contacto", 5, y);
      
      y += 4;
      doc.setFontSize(8);
      doc.setFont("courier", "normal");
      
      if (reservation.phone) {
        doc.text(`Tel: ${reservation.phone}`, 5, y);
        y += 3;
      }
      
      if (reservation.email) {
        const emailText = doc.splitTextToSize(`Email: ${reservation.email}`, 48);
        doc.text(emailText, 5, y);
        y += emailText.length * 3;
      }

      // Código QR
      if (qrCodeDataUrl) {
        y += 8;
        const qrX = (58 - 25) / 2; // Centrar el QR (25mm de ancho)
        try {
          doc.addImage(qrCodeDataUrl, 'PNG', qrX, y, 25, 25);
          y += 27;
        } catch (error) {
          console.error("Error al añadir QR al PDF:", error);
          y += 5;
        }
      }

      // Pie de página
      y += 3;
      doc.setDrawColor(200, 200, 200);
      doc.line(5, y, 53, y);
      
      y += 4;
      doc.setFontSize(6);
      doc.text("Gracias por su preferencia", 29, y, { align: "center" });

      // Abrir el PDF en una nueva ventana usando about:blank (compatible con Android)
      const pdfWindow = window.open('', '_blank');
      if (pdfWindow) {
        pdfWindow.document.write(`
          <html>
            <head>
              <title>Reservación #${generateReservationId(reservation.id)} - 60mm</title>
              <style>
                body { margin: 0; }
                iframe { width: 100%; height: 100vh; border: none; }
              </style>
            </head>
            <body>
              <iframe src="${doc.output('datauristring')}" type="application/pdf"></iframe>
            </body>
          </html>
        `);
        pdfWindow.document.close();
      }
      
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 text-center">
        <p className="text-red-500">Error al cargar las reservaciones</p>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mis Reservaciones</h1>
        <Badge variant="outline">
          {reservations?.length || 0} reservaciones
        </Badge>
      </div>

      {!reservations || reservations.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">No tienes reservaciones creadas</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {reservations.map((reservation: any) => (
            <Card key={reservation.id} className="relative">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">
                    #{generateReservationId(reservation.id)}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant={reservation.status === 'confirmed' ? 'default' : 'secondary'}>
                      {reservation.status}
                    </Badge>
                    <Button
                      onClick={() => downloadTicket60mm(reservation)}
                      size="sm"
                      variant="outline"
                      className="gap-2"
                    >
                      <Download className="h-4 w-4" />
                      Boleto 60mm
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Información del viaje */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Ruta</span>
                    </div>
                    <div className="pl-6 space-y-1">
                      <p className="text-sm">
                        <strong>De:</strong> {reservation.trip?.origin || 'No especificado'}
                      </p>
                      <p className="text-sm">
                        <strong>A:</strong> {reservation.trip?.destination || 'No especificado'}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Fecha</span>
                    </div>
                    <div className="pl-6">
                      <p className="text-sm">{reservation.trip?.departureDate || 'No especificado'}</p>
                    </div>
                    
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Hora</span>
                    </div>
                    <div className="pl-6">
                      <p className="text-sm">{reservation.trip?.departureTime || 'No especificado'}</p>
                    </div>
                  </div>

                  {/* Información de pasajeros y pago */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2 text-sm">
                      <User className="h-4 w-4 text-gray-500" />
                      <span className="font-medium">Pasajeros ({reservation.passengers?.length || 0})</span>
                    </div>
                    <div className="pl-6 space-y-1">
                      {reservation.passengers?.map((passenger: any, index: number) => (
                        <p key={index} className="text-sm">
                          {passenger.firstName} {passenger.lastName}
                        </p>
                      ))}
                    </div>
                    
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex justify-between text-sm">
                        <span>Total:</span>
                        <span className="font-medium">{formatPrice(reservation.totalAmount)}</span>
                      </div>
                      {reservation.advancePayment > 0 && (
                        <>
                          <div className="flex justify-between text-sm">
                            <span>Anticipo:</span>
                            <span>{formatPrice(reservation.advancePayment)}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span>Restante:</span>
                            <span>{formatPrice(reservation.remainingBalance)}</span>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Información de contacto */}
                <div className="mt-4 pt-4 border-t">
                  <div className="flex flex-wrap gap-4 text-sm text-gray-600">
                    {reservation.phone && (
                      <span>📞 {reservation.phone}</span>
                    )}
                    {reservation.email && (
                      <span>✉️ {reservation.email}</span>
                    )}
                    <span>
                      📅 {format(new Date(reservation.createdAt), "dd/MM/yyyy HH:mm", { locale: es })}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}