// Script para resetear contraseña de admin@transporte.com
// Uso: node reset-admin-password.js

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

async function resetAdminPassword() {
  try {
    const DATABASE_URL = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
    
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada');
    }
    
    console.log('🔑 Reseteando contraseña de admin@transporte.com...');
    const sql = neon(DATABASE_URL);
    
    const email = 'admin@transporte.com';
    const newPassword = '12345678'; // Nueva contraseña
    
    // Verificar si el usuario existe
    const existingUser = await sql`
      SELECT id, email, role, first_name, last_name 
      FROM users 
      WHERE email = ${email}
    `;
    
    if (existingUser.length === 0) {
      console.log('❌ Usuario admin@transporte.com no encontrado');
      console.log('Usuarios existentes:');
      
      const allUsers = await sql`
        SELECT id, email, role, first_name, last_name
        FROM users 
        ORDER BY id
      `;
      
      allUsers.forEach(user => {
        console.log(`  - ${user.email} (${user.role})`);
      });
      
      return;
    }
    
    // Encriptar nueva contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(newPassword, saltRounds);
    
    // Actualizar contraseña
    await sql`
      UPDATE users 
      SET password = ${hashedPassword}
      WHERE email = ${email}
    `;
    
    const user = existingUser[0];
    console.log('✅ Contraseña actualizada exitosamente');
    console.log(`👤 Usuario: ${user.first_name} ${user.last_name}`);
    console.log(`📧 Email: ${email}`);
    console.log(`🔐 Nueva contraseña: ${newPassword}`);
    console.log(`👑 Rol: ${user.role}`);
    
    // Verificar que la actualización fue exitosa
    const updatedUser = await sql`
      SELECT id, email, role, created_at
      FROM users 
      WHERE email = ${email}
    `;
    
    if (updatedUser.length > 0) {
      console.log('\n✅ Verificación exitosa - Usuario encontrado y actualizado');
    }
    
  } catch (error) {
    console.error('❌ Error reseteando contraseña:', error.message);
    console.error('Stack:', error.stack);
  }
}

// Ejecutar script
resetAdminPassword();