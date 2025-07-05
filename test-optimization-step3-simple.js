// Test directo para verificar que getReservationsOptimized funcione
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './shared/schema.js';
import { DatabaseStorage } from './server/db-storage.js';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const db = drizzle(pool, { schema });
const storage = new DatabaseStorage();

async function testOptimizedMethod() {
  console.log('=== TESTING getReservationsOptimized DIRECTLY ===\n');
  
  try {
    console.log('1. Probando método ORIGINAL getReservations...');
    const startOriginal = Date.now();
    const originalReservations = await storage.getReservations('bamo-350045');
    const originalTime = Date.now() - startOriginal;
    console.log(`   ✓ Original: ${originalReservations.length} reservaciones en ${originalTime}ms`);
    
    console.log('\n2. Probando método OPTIMIZADO getReservationsOptimized...');
    const startOptimized = Date.now();
    const optimizedReservations = await storage.getReservationsOptimized('bamo-350045');
    const optimizedTime = Date.now() - startOptimized;
    console.log(`   ✓ Optimizado: ${optimizedReservations.length} reservaciones en ${optimizedTime}ms`);
    
    console.log('\n3. COMPARACIÓN:');
    console.log(`   • Método original: ${originalTime}ms`);
    console.log(`   • Método optimizado: ${optimizedTime}ms`);
    
    if (optimizedTime < originalTime) {
      const improvement = ((originalTime - optimizedTime) / originalTime * 100).toFixed(1);
      console.log(`   ✓ MEJORA: ${improvement}% más rápido`);
    } else {
      const regression = ((optimizedTime - originalTime) / originalTime * 100).toFixed(1);
      console.log(`   ⚠ REGRESIÓN: ${regression}% más lento`);
    }
    
    console.log('\n4. VERIFICANDO CONSISTENCIA:');
    console.log(`   • Original: ${originalReservations.length} reservaciones`);
    console.log(`   • Optimizado: ${optimizedReservations.length} reservaciones`);
    
    if (originalReservations.length === optimizedReservations.length) {
      console.log('   ✓ Misma cantidad de resultados');
    } else {
      console.log('   ✗ Diferente cantidad de resultados');
    }
    
  } catch (error) {
    console.error('\n❌ Error durante las pruebas:', error.message);
    console.error('Stack:', error.stack);
  } finally {
    await pool.end();
  }
}

testOptimizedMethod();