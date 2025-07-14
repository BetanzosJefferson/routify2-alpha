import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { formatDate, formatPrice, generateReservationId } from "@/lib/utils";
import { formatTripTime } from "@/lib/trip-utils";

// Define la estructura de datos de la reservación
interface ReservationData {
  id: number;
  passengerName: string;
  phone: string;
  email: string;
  origin: string;
  destination: string;
  departureDate: string;
  departureTime: string;
  arrivalTime?: string;
  totalAmount: number;
  originalPrice: number;
  couponDiscount: number;
  advanceAmount: number;
  paymentMethod: string;
  advancePaymentMethod: string;
  numPassengers: number;
  passengers: { firstName: string; lastName: string }[];
  couponCode?: string | null;
}

// Función para generar el PDF con dimensiones de ticket térmico (60mm)
export async function generateReservationTicket60mmPDF(reservationData: ReservationData, companyName: string) {
  // Generar código QR para añadir al PDF
  let qrCodeDataUrl;
  try {
    const verificationUrl = `${window.location.origin}/reservation-details?id=${reservationData.id}`;
    qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { width: 120 });
  } catch (error) {
    console.error("Error al generar código QR:", error);
    qrCodeDataUrl = null;
  }

  // Crear un documento PDF con las dimensiones de un ticket térmico (60mm x 170mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [60, 170], // 60mm de ancho, 170mm de alto (formato más amplio para tickets térmicos)
  });

  // Configuración de fuentes
  doc.setFont("courier", "normal");
  doc.setFontSize(10);

  // Margen superior
  let y = 10;

  // Encabezado
  doc.setFontSize(12);
  doc.setFont("courier", "bold");
  const companyNameWidth = doc.getStringUnitWidth(companyName) * 12 / doc.internal.scaleFactor;
  const companyNameX = (60 - companyNameWidth) / 2;
  doc.text(companyName, companyNameX, y);
  
  y += 5;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  doc.text("Servicio de transporte", 30, y, { align: "center" });
  
  // Línea separadora
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(5, y, 55, y);
  
  // ID de la reservación
  y += 5;
  doc.setFontSize(10);
  doc.setFont("courier", "bold");
  doc.text(`RESERVA #${generateReservationId(reservationData.id)}`, 30, y, { align: "center" });
  
  y += 4;
  doc.setFontSize(8);
  doc.text(formatDate(reservationData.departureDate), 30, y, { align: "center" });
  
  // Información del pasajero
  y += 6;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Pasajero", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  doc.text(reservationData.passengerName, 5, y);
  
  y += 3;
  doc.text(`Tel: ${reservationData.phone}`, 5, y);
  
  if (reservationData.email) {
    y += 3;
    doc.text(`Email: ${reservationData.email}`, 5, y);
  }
  
  // Número de pasajeros
  y += 3;
  doc.text(`Pasajeros: ${reservationData.numPassengers}`, 5, y);
  
  // Ruta
  y += 6;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Ruta", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  
  // Origen
  const maxWidthOrigen = 50; // Ancho máximo en mm para el texto
  const origenCompleto = `Origen: ${reservationData.origin}`;
  
  if (doc.getStringUnitWidth(origenCompleto) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
    doc.text("Origen:", 5, y);
    y += 3;
    
    // Dividir el resto en múltiples líneas
    const words = reservationData.origin.split(' ');
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
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
  const destinoCompleto = `Destino: ${reservationData.destination}`;
  
  if (doc.getStringUnitWidth(destinoCompleto) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
    doc.text("Destino:", 5, y);
    y += 3;
    
    // Dividir el resto en múltiples líneas
    const words = reservationData.destination.split(' ');
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > maxWidthOrigen) {
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
  
  // Horarios
  y += 3;
  doc.text(`Salida: ${formatTripTime(reservationData.departureTime)}`, 5, y);
  
  if (reservationData.arrivalTime) {
    y += 3;
    doc.text(`Llegada: ${formatTripTime(reservationData.arrivalTime)}`, 5, y);
  }
  
  // Información de pago
  y += 6;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Información de pago", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  
  // Precio original
  if (reservationData.couponDiscount > 0) {
    doc.text(`Precio original: ${formatPrice(reservationData.originalPrice)}`, 5, y);
    y += 3;
    
    // Descuento
    doc.text(`Descuento: -${formatPrice(reservationData.couponDiscount)}`, 5, y);
    y += 3;
    
    // Cupón aplicado
    if (reservationData.couponCode) {
      doc.text(`Cupón: ${reservationData.couponCode}`, 5, y);
      y += 3;
    }
  }
  
  // Total
  doc.setFont("courier", "bold");
  doc.text(`Total: ${formatPrice(reservationData.totalAmount)}`, 5, y);
  y += 4;
  
  doc.setFont("courier", "normal");
  
  // Anticipo
  if (reservationData.advanceAmount > 0) {
    doc.text(`Anticipo: ${formatPrice(reservationData.advanceAmount)}`, 5, y);
    y += 3;
    doc.text(`Método: ${reservationData.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}`, 5, y);
    y += 3;
    
    // Restante
    const remaining = reservationData.totalAmount - reservationData.advanceAmount;
    if (remaining > 0) {
      doc.text(`Restante: ${formatPrice(remaining)}`, 5, y);
      y += 3;
      doc.text(`Método: ${reservationData.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}`, 5, y);
      y += 3;
    }
  } else {
    doc.text(`Pago: ${reservationData.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}`, 5, y);
    y += 3;
  }
  
  // Línea separadora
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(5, y, 55, y);
  
  // Código QR
  if (qrCodeDataUrl) {
    y += 5;
    const qrSize = 30; // QR más grande para 60mm
    const qrX = (60 - qrSize) / 2;
    doc.addImage(qrCodeDataUrl, 'PNG', qrX, y, qrSize, qrSize);
    y += qrSize + 5;
  }
  
  // Información final
  y += 3;
  doc.setFontSize(7);
  doc.setFont("courier", "normal");
  doc.text("Conserve este boleto", 30, y, { align: "center" });
  y += 3;
  doc.text("hasta finalizar el viaje", 30, y, { align: "center" });
  y += 4;
  doc.text(`TransRoute © ${new Date().getFullYear()}`, 30, y, { align: "center" });
  
  // Abrir el PDF en una nueva ventana usando about:blank (compatible con Android)
  const pdfWindow = window.open('', '_blank');
  if (pdfWindow) {
    pdfWindow.document.write(`
      <html>
        <head>
          <title>Reservación #${reservationData.id} - Térmico 60mm</title>
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
}

// Función para generar el PDF con descarga directa (optimizada para móviles)
export async function generateReservationTicket60mmPDFWithDownload(reservationData: ReservationData, companyName: string) {
  // Generar código QR para añadir al PDF
  let qrCodeDataUrl;
  try {
    const verificationUrl = `${window.location.origin}/reservation-details?id=${reservationData.id}`;
    qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, { width: 120 });
  } catch (error) {
    console.error("Error al generar código QR:", error);
    qrCodeDataUrl = null;
  }

  // Crear un documento PDF con las dimensiones de un ticket térmico (60mm x 170mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [60, 170], // 60mm de ancho, 170mm de alto (formato más amplio para tickets térmicos)
  });

  // Configuración de fuentes
  doc.setFont("courier", "normal");
  doc.setFontSize(10);

  // Margen superior
  let y = 10;

  // Encabezado
  doc.setFontSize(12);
  doc.setFont("courier", "bold");
  const companyNameWidth = doc.getStringUnitWidth(companyName) * 12 / doc.internal.scaleFactor;
  const companyNameX = (60 - companyNameWidth) / 2;
  doc.text(companyName, companyNameX, y);
  
  y += 5;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  doc.text("Servicio de transporte", 30, y, { align: "center" });
  
  // Línea separadora
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(5, y, 55, y);
  
  // ID de la reservación
  y += 5;
  doc.setFontSize(10);
  doc.setFont("courier", "bold");
  doc.text(`RESERVA #${generateReservationId(reservationData.id)}`, 30, y, { align: "center" });
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  doc.text(formatDate(reservationData.departureDate), 30, y, { align: "center" });
  
  // Información del pasajero
  y += 6;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Pasajero", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  
  // Nombre del pasajero
  const passengerName = reservationData.passengerName || "No especificado";
  if (doc.getStringUnitWidth(passengerName) * 8 / doc.internal.scaleFactor > 50) {
    const words = passengerName.split(' ');
    let line = '';
    for (let i = 0; i < words.length; i++) {
      const testLine = line + words[i] + ' ';
      if (doc.getStringUnitWidth(testLine) * 8 / doc.internal.scaleFactor > 50) {
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
    doc.text(passengerName, 5, y);
    y += 4;
  }
  
  // Teléfono
  if (reservationData.phone) {
    doc.text(`Tel: ${reservationData.phone}`, 5, y);
    y += 3;
  }
  
  // Línea separadora
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(5, y, 55, y);
  
  // Información del viaje
  y += 5;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Viaje", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  
  // Origen
  const origin = reservationData.origin || "No especificado";
  const originText = `De: ${origin}`;
  const originLines = doc.splitTextToSize(originText, 50);
  doc.text(originLines, 5, y);
  y += originLines.length * 3 + 1;
  
  // Destino
  const destination = reservationData.destination || "No especificado";
  const destinationText = `A: ${destination}`;
  const destinationLines = doc.splitTextToSize(destinationText, 50);
  doc.text(destinationLines, 5, y);
  y += destinationLines.length * 3 + 3;
  
  // Horarios
  if (reservationData.departureTime) {
    doc.text(`Salida: ${formatTripTime(reservationData.departureTime)}`, 5, y);
    y += 3;
  }
  
  if (reservationData.arrivalTime) {
    doc.text(`Llegada: ${formatTripTime(reservationData.arrivalTime)}`, 5, y);
  }
  
  // Información de pago
  y += 6;
  doc.setFontSize(9);
  doc.setFont("courier", "bold");
  doc.text("Información de pago", 5, y);
  
  y += 4;
  doc.setFontSize(8);
  doc.setFont("courier", "normal");
  
  // Precio original
  if (reservationData.couponDiscount > 0) {
    doc.text(`Precio original: ${formatPrice(reservationData.originalPrice)}`, 5, y);
    y += 3;
    
    // Descuento
    doc.text(`Descuento: -${formatPrice(reservationData.couponDiscount)}`, 5, y);
    y += 3;
    
    // Cupón aplicado
    if (reservationData.couponCode) {
      doc.text(`Cupón: ${reservationData.couponCode}`, 5, y);
      y += 3;
    }
  }
  
  // Total
  doc.setFont("courier", "bold");
  doc.text(`Total: ${formatPrice(reservationData.totalAmount)}`, 5, y);
  y += 4;
  
  doc.setFont("courier", "normal");
  
  // Anticipo
  if (reservationData.advanceAmount > 0) {
    doc.text(`Anticipo: ${formatPrice(reservationData.advanceAmount)}`, 5, y);
    y += 3;
    doc.text(`Método: ${reservationData.advancePaymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}`, 5, y);
    y += 3;
    
    // Restante
    const remaining = reservationData.totalAmount - reservationData.advanceAmount;
    if (remaining > 0) {
      doc.text(`Restante: ${formatPrice(remaining)}`, 5, y);
      y += 3;
      doc.text(`Método: ${reservationData.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}`, 5, y);
      y += 3;
    }
  } else {
    doc.text(`Pago: ${reservationData.paymentMethod === 'efectivo' ? 'Efectivo' : 'Transferencia'}`, 5, y);
    y += 3;
  }
  
  // Línea separadora
  y += 3;
  doc.setDrawColor(200, 200, 200);
  doc.line(5, y, 55, y);
  
  // Código QR
  if (qrCodeDataUrl) {
    y += 5;
    const qrSize = 30; // QR más grande para 60mm
    const qrX = (60 - qrSize) / 2;
    doc.addImage(qrCodeDataUrl, 'PNG', qrX, y, qrSize, qrSize);
    y += qrSize + 5;
  }
  
  // Información final
  y += 3;
  doc.setFontSize(7);
  doc.setFont("courier", "normal");
  doc.text("Conserve este boleto", 30, y, { align: "center" });
  y += 3;
  doc.text("hasta finalizar el viaje", 30, y, { align: "center" });
  y += 4;
  doc.text(`TransRoute © ${new Date().getFullYear()}`, 30, y, { align: "center" });
  
  // Descargar el PDF directamente
  const fileName = `Reservacion_${generateReservationId(reservationData.id)}_60mm.pdf`;
  doc.save(fileName);
}