import bcrypt from 'bcryptjs';
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

async function createPerformanceUser() {
  console.log('🔑 CREANDO USUARIO PARA PRUEBAS DE RENDIMIENTO');
  console.log('==============================================');
  
  try {
    // Hash de la contraseña
    const hashedPassword = await bcrypt.hash('test123', 10);
    console.log('✅ Contraseña hasheada');
    
    // Crear o actualizar usuario
    const result = await pool.query(`
      INSERT INTO users (email, password, first_name, last_name, role, company_id)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (email) DO UPDATE SET
        password = $2
      RETURNING id, email, first_name, last_name, role
    `, [
      'test-performance@test.com',
      hashedPassword,
      'Test',
      'Performance',
      'admin',
      'bamo-350045'
    ]);
    
    console.log('✅ Usuario creado/actualizado:', result.rows[0]);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await pool.end();
  }
}

createPerformanceUser();