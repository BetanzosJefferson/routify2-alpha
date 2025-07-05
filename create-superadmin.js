// Script para crear usuario SuperAdmin
// Uso: node create-superadmin.js

import { neon } from '@neondatabase/serverless';
import bcrypt from 'bcryptjs';

async function createSuperAdmin() {
  try {
    const DATABASE_URL = process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL;
    
    if (!DATABASE_URL) {
      throw new Error('DATABASE_URL no está configurada');
    }
    
    console.log('🔑 Creando usuario SuperAdmin...');
    const sql = neon(DATABASE_URL);
    
    // Datos del usuario
    const email = 'bahenawilliamjefferson@gmail.com';
    const password = '12345678';
    const role = 'superAdmin';
    
    // Encriptar contraseña
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    // Verificar si el usuario ya existe
    const existingUser = await sql`
      SELECT id, email FROM users WHERE email = ${email}
    `;
    
    if (existingUser.length > 0) {
      console.log('⚠️  Usuario ya existe, actualizando contraseña...');
      
      // Actualizar contraseña del usuario existente
      await sql`
        UPDATE users 
        SET password = ${hashedPassword}, role = ${role}
        WHERE email = ${email}
      `;
      
      console.log('✅ Usuario actualizado exitosamente');
      console.log(`📧 Email: ${email}`);
      console.log(`🔐 Contraseña: ${password}`);
      console.log(`👤 Rol: ${role}`);
    } else {
      console.log('👤 Creando nuevo usuario...');
      
      // Crear nuevo usuario
      const newUser = await sql`
        INSERT INTO users (
          first_name,
          last_name, 
          email,
          password,
          role
        ) VALUES (
          'Super',
          'Admin',
          ${email},
          ${hashedPassword},
          ${role}
        ) RETURNING id, email, role
      `;
      
      console.log('✅ Usuario SuperAdmin creado exitosamente');
      console.log(`📧 Email: ${email}`);
      console.log(`🔐 Contraseña: ${password}`);
      console.log(`👤 Rol: ${role}`);
      console.log(`🆔 ID: ${newUser[0].id}`);
    }
    
    // Verificar estructura de tabla users para diagnóstico
    const userColumns = await sql`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'users' 
      ORDER BY ordinal_position
    `;
    
    console.log('\n📋 Estructura de tabla users:');
    userColumns.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Verificar que el usuario fue creado correctamente
    const verifyUser = await sql`
      SELECT id, first_name, last_name, email, role, created_at
      FROM users 
      WHERE email = ${email}
    `;
    
    if (verifyUser.length > 0) {
      console.log('\n✅ Verificación exitosa - Usuario encontrado:');
      const user = verifyUser[0];
      console.log(`  - ID: ${user.id}`);
      console.log(`  - Nombre: ${user.first_name} ${user.last_name}`);
      console.log(`  - Email: ${user.email}`);
      console.log(`  - Rol: ${user.role}`);
      console.log(`  - Creado: ${user.created_at}`);
    }
    
    console.log('\n🎉 Proceso completado exitosamente');
    console.log('💡 Ahora puedes acceder al sistema con estas credenciales');
    
  } catch (error) {
    console.error('❌ Error creando usuario:', error.message);
    console.error('Stack:', error.stack);
    
    console.log('\n🔍 Diagnóstico:');
    
    try {
      const sql = neon(process.env.DATABASE_URL || process.env.PRODUCTION_DATABASE_URL);
      
      // Verificar si la tabla users existe
      const tableExists = await sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'users'
        ) as exists
      `;
      
      if (tableExists[0].exists) {
        console.log('✅ Tabla users existe');
        
        // Contar usuarios existentes
        const userCount = await sql`SELECT COUNT(*) as count FROM users`;
        console.log(`📊 Usuarios existentes: ${userCount[0].count}`);
      } else {
        console.log('❌ Tabla users no existe - ejecuta la migración primero');
      }
      
    } catch (diagError) {
      console.log('❌ Error en diagnóstico:', diagError.message);
    }
  }
}

// Ejecutar script
createSuperAdmin();