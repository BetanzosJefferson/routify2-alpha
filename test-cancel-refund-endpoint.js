/**
 * Script para probar el endpoint de cancelación con reembolso
 */

import { DatabaseStorage } from './server/db-storage.js';

async function testCancelRefundEndpoint() {
  const storage = new DatabaseStorage();
  
  console.log('🧪 PROBANDO ENDPOINT DE CANCELACIÓN CON REEMBOLSO');
  console.log('='.repeat(60));
  
  try {
    // 1. Buscar una reservación activa para probar
    const reservations = await storage.getReservations({}, null);
    console.log(`📊 Reservaciones encontradas: ${reservations.length}`);
    
    const activeReservation = reservations.find(r => r.status === 'confirmed');
    
    if (!activeReservation) {
      console.log('❌ No hay reservaciones activas para probar');
      return;
    }
    
    console.log(`🎯 Reservación de prueba: ID ${activeReservation.id}`);
    console.log(`   Estado: ${activeReservation.status}`);
    console.log(`   Compañía: ${activeReservation.companyId}`);
    
    // 2. Verificar transacciones asociadas
    const transactions = await storage.getTransaccionesByReservation(activeReservation.id);
    console.log(`💰 Transacciones asociadas: ${transactions.length}`);
    
    const refundableTransactions = transactions.filter(t => t.cutoff_id === null);
    console.log(`💳 Transacciones reembolsables: ${refundableTransactions.length}`);
    
    if (refundableTransactions.length === 0) {
      console.log('❌ No hay transacciones reembolsables para esta reservación');
      return;
    }
    
    refundableTransactions.forEach(t => {
      console.log(`   - Transacción ${t.id}: $${t.details?.details?.monto || 0} (Usuario: ${t.user_id})`);
    });
    
    // 3. Simular cancelación con reembolso
    const userId = 3; // Usuario que realiza la cancelación
    console.log(`\n🔄 Simulando cancelación con reembolso por usuario ${userId}...`);
    
    // Cancelar reservación
    const updatedReservation = await storage.updateReservation(activeReservation.id, {
      status: 'canceledAndRefund',
      updatedAt: new Date()
    });
    
    if (updatedReservation) {
      console.log(`✅ Reservación ${activeReservation.id} cancelada exitosamente`);
      
      // Crear transacciones de reembolso
      let refundedCount = 0;
      let totalRefundAmount = 0;
      
      for (const transaction of refundableTransactions) {
        const refundCreated = await storage.createRefundTransaction(transaction.id, userId);
        
        if (refundCreated) {
          refundedCount++;
          const amount = transaction.details?.details?.monto || 0;
          totalRefundAmount += amount;
          console.log(`✅ Transacción de reembolso creada para transacción ${transaction.id} ($${amount})`);
        } else {
          console.log(`❌ Error al crear transacción de reembolso para transacción ${transaction.id}`);
        }
      }
      
      console.log(`\n📊 RESUMEN:`);
      console.log(`   - Transacciones reembolsadas: ${refundedCount}/${refundableTransactions.length}`);
      console.log(`   - Monto total reembolsado: $${totalRefundAmount}`);
      console.log(`   - Estado de reservación: ${updatedReservation.status}`);
      
      // Verificar que las transacciones de reembolso se crearon
      const allTransactions = await storage.getTransacciones({});
      const createdRefunds = allTransactions.filter(t => {
        const details = t.details?.details;
        return details?.transaccion_original_id && refundableTransactions.some(rt => rt.id === details.transaccion_original_id);
      });
      
      console.log(`\n✅ Transacciones de reembolso verificadas: ${createdRefunds.length}`);
      
      createdRefunds.forEach(refund => {
        console.log(`   - Reembolso ID ${refund.id}: $${refund.details?.details?.monto} (Original: ${refund.details?.details?.transaccion_original_id})`);
      });
      
    } else {
      console.log('❌ Error al cancelar la reservación');
    }
    
  } catch (error) {
    console.error('❌ Error durante la prueba:', error);
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('🏁 PRUEBA COMPLETADA');
}

// Ejecutar la prueba
testCancelRefundEndpoint()
  .then(() => {
    console.log('Prueba finalizada');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error en la prueba:', error);
    process.exit(1);
  });