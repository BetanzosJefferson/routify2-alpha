// Script para probar la creación de transacciones y debugging
import { DatabaseStorage } from './server/db-storage.js';

const storage = new DatabaseStorage();

async function testTransactionCreation() {
  try {
    console.log('🔍 Probando creación de transacción...');
    
    // Datos de prueba simulando una solicitud de reservación
    const requestData = {
      email: "test@example.com",
      phone: "1234567890", 
      company_id: "bamo-350045",
      created_by: 4,
      trip_details: {
        recordId: "214_9",
        tripId: "214_9",
        seats: 1
      },
      passengers: [
        {
          firstName: "Test",
          lastName: "User"
        }
      ],
      total_amount: 400,
      advance_amount: 200,
      advance_payment_method: "efectivo",
      payment_method: "efectivo",
      payment_status: "pendiente"
    };
    
    const approvedBy = 3; // ID del usuario aprobador
    const reservationId = 999; // ID ficticio de reservación
    
    // Llamar a la función de creación de transacción
    await storage.createTransactionFromReservation(requestData, approvedBy, reservationId, null);
    
    console.log('✅ Transacción creada exitosamente');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testTransactionCreation();