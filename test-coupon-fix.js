const { DatabaseStorage } = require('./server/db-storage.ts');
const storage = new DatabaseStorage();

async function testCouponFix() {
  try {
    console.log('🔥 Probando fix de cupón...');
    
    // Aprobar la solicitud #21
    console.log('Aprobando solicitud #21 con cupón...');
    const result = await storage.updateReservationRequestStatus(21, 'aprobada', 3, 'Test cupón corregido');
    
    if (result) {
      console.log('✅ Solicitud aprobada exitosamente');
      
      // Verificar que se creó la reservación con el totalAmount correcto
      const latestReservation = await storage.db.select()
        .from(storage.schema.reservations)
        .where(storage.db.eq(storage.schema.reservations.createdBy, 4))
        .orderBy(storage.db.desc(storage.schema.reservations.createdAt))
        .limit(1);
      
      if (latestReservation && latestReservation.length > 0) {
        const reservation = latestReservation[0];
        console.log('📊 Reservación creada:');
        console.log(`  - ID: ${reservation.id}`);
        console.log(`  - Total Amount: $${reservation.totalAmount}`);
        console.log(`  - Original Amount: $${reservation.originalAmount}`);
        console.log(`  - Discount Amount: $${reservation.discountAmount}`);
        console.log(`  - Advance Amount: $${reservation.advanceAmount}`);
        console.log(`  - Coupon Code: ${reservation.couponCode}`);
        
        // Verificar que el cálculo es correcto
        const expectedFinalAmount = reservation.originalAmount - reservation.discountAmount;
        const isCorrect = reservation.totalAmount === expectedFinalAmount;
        
        console.log(`\n🧮 Verificación de cálculo:`);
        console.log(`  - Precio original: $${reservation.originalAmount}`);
        console.log(`  - Descuento: $${reservation.discountAmount}`);
        console.log(`  - Precio final esperado: $${expectedFinalAmount}`);
        console.log(`  - Precio final guardado: $${reservation.totalAmount}`);
        console.log(`  - ✅ Cálculo correcto: ${isCorrect ? 'SÍ' : 'NO'}`);
        
        if (isCorrect) {
          console.log('\n🎉 ¡FIX FUNCIONANDO CORRECTAMENTE!');
        } else {
          console.log('\n❌ Fix no funcionó correctamente');
        }
      } else {
        console.log('❌ No se encontró la reservación creada');
      }
    } else {
      console.log('❌ Error al aprobar la solicitud');
    }
    
  } catch (error) {
    console.error('❌ Error en la prueba:', error);
  }
}

testCouponFix();