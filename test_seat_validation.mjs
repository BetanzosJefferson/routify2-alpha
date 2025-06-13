import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL);

async function testSeatValidation() {
  console.log('🔍 Testing validateSeatAvailability...\n');
  
  try {
    // Test 1: Validar segmento válido con asientos suficientes
    console.log('Test 1: Segmento válido (25_0) - 1 asiento solicitado');
    const trip = await sql`SELECT trip_data FROM trips WHERE id = 25`;
    const segment0 = trip[0].trip_data[0];
    console.log(`- Asientos disponibles en segmento 0: ${segment0.availableSeats}`);
    console.log(`- Solicitando: 1 asiento`);
    console.log(`- Resultado esperado: true (11 >= 1)\n`);
    
    // Test 2: Validar segmento válido con asientos insuficientes
    console.log('Test 2: Segmento válido (25_0) - 15 asientos solicitados');
    console.log(`- Asientos disponibles en segmento 0: ${segment0.availableSeats}`);
    console.log(`- Solicitando: 15 asientos`);
    console.log(`- Resultado esperado: false (11 < 15)\n`);
    
    // Test 3: Validar segmento inexistente
    console.log('Test 3: Segmento inexistente (25_5)');
    console.log(`- Índice solicitado: 5`);
    console.log(`- Segmentos disponibles: ${trip[0].trip_data.length}`);
    console.log(`- Resultado esperado: false (índice fuera de rango)\n`);
    
    // Test 4: Validar formato de tripId inválido
    console.log('Test 4: Formato tripId inválido (25-0)');
    console.log(`- Formato proporcionado: "25-0" (debería ser "25_0")`);
    console.log(`- Resultado esperado: false (formato inválido)\n`);
    
    // Test 5: Validar recordId inexistente
    console.log('Test 5: RecordId inexistente (999)');
    console.log(`- Record solicitado: 999`);
    console.log(`- Resultado esperado: false (registro no encontrado)\n`);
    
    console.log('✅ Preparación de tests completada');
    console.log('Los tests actuales solo muestran datos - la validación real se hará en el backend');
    
  } catch (error) {
    console.error('❌ Error en testing:', error);
  }
}

testSeatValidation();
