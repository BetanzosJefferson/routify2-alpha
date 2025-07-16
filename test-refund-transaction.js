/**
 * Test script para verificar el nuevo comportamiento de transacciones de reembolso
 * Este script prueba que las transacciones de reembolso se crean correctamente
 * en lugar de eliminar las transacciones originales
 */

import { DatabaseStorage } from './server/db-storage.js';
import { sql } from 'drizzle-orm';

async function testRefundTransactionCreation() {
  const storage = new DatabaseStorage();
  
  console.log('🧪 INICIANDO TEST DE TRANSACCIONES DE REEMBOLSO');
  console.log('='.repeat(50));
  
  try {
    // 1. Buscar una transacción existente para probar
    const existingTransactions = await storage.getTransacciones({});
    console.log(`📊 Transacciones existentes: ${existingTransactions.length}`);
    
    if (existingTransactions.length === 0) {
      console.log('❌ No hay transacciones existentes para probar');
      return;
    }
    
    // Buscar una transacción sin corte para probar
    const testTransaction = existingTransactions.find(t => t.cutoff_id === null);
    
    if (!testTransaction) {
      console.log('❌ No hay transacciones sin corte para probar');
      return;
    }
    
    console.log(`🎯 Transacción de prueba seleccionada: ID ${testTransaction.id}`);
    console.log(`   Usuario: ${testTransaction.user_id}`);
    console.log(`   Detalles:`, JSON.stringify(testTransaction.details, null, 2));
    
    // 2. Crear transacción de reembolso
    const refundedBy = 1; // Usuario que realiza el reembolso
    console.log(`\n💰 Creando transacción de reembolso...`);
    
    const refundCreated = await storage.createRefundTransaction(testTransaction.id, refundedBy);
    
    if (refundCreated) {
      console.log('✅ Transacción de reembolso creada exitosamente');
      
      // 3. Verificar que la transacción de reembolso se creó correctamente
      const allTransactions = await storage.getTransacciones({});
      const refundTransaction = allTransactions.find(t => {
        const details = t.details as any;
        return details?.details?.transaccion_original_id === testTransaction.id;
      });
      
      if (refundTransaction) {
        console.log(`✅ Transacción de reembolso verificada: ID ${refundTransaction.id}`);
        console.log(`   Usuario (mismo que original): ${refundTransaction.user_id}`);
        console.log(`   Monto original: ${(testTransaction.details as any)?.details?.monto}`);
        console.log(`   Monto reembolso: ${(refundTransaction.details as any)?.details?.monto}`);
        console.log(`   Reembolsado por: ${(refundTransaction.details as any)?.details?.reembolsado_por}`);
        console.log(`   Fecha reembolso: ${(refundTransaction.details as any)?.details?.fecha_reembolso}`);
        
        // Verificar que el monto es negativo
        const originalAmount = (testTransaction.details as any)?.details?.monto || 0;
        const refundAmount = (refundTransaction.details as any)?.details?.monto || 0;
        
        if (refundAmount === -originalAmount) {
          console.log('✅ Monto negativo correcto');
        } else {
          console.log(`❌ Monto negativo incorrecto: esperado ${-originalAmount}, obtenido ${refundAmount}`);
        }
        
        // Verificar que el usuario es el mismo
        if (refundTransaction.user_id === testTransaction.user_id) {
          console.log('✅ Usuario mantenido correctamente');
        } else {
          console.log(`❌ Usuario incorrecto: esperado ${testTransaction.user_id}, obtenido ${refundTransaction.user_id}`);
        }
        
      } else {
        console.log('❌ No se encontró la transacción de reembolso creada');
      }
      
    } else {
      console.log('❌ Error al crear transacción de reembolso');
    }
    
  } catch (error) {
    console.error('❌ Error durante el test:', error);
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('🏁 TEST COMPLETADO');
}

// Ejecutar el test
testRefundTransactionCreation()
  .then(() => {
    console.log('Test finalizado');
    process.exit(0);
  })
  .catch(error => {
    console.error('Error en el test:', error);
    process.exit(1);
  });