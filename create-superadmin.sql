-- Script SQL para crear usuario SuperAdmin
-- Ejecutar directamente en Supabase SQL Editor o con psql

-- Verificar si el usuario ya existe
SELECT id, email, role FROM users WHERE email = 'bahenawilliamjefferson@gmail.com';

-- Si no existe, crear el usuario (ejecutar solo si la consulta anterior no devuelve resultados)
INSERT INTO users (
  first_name,
  last_name,
  email,
  password,
  role,
  created_at
) VALUES (
  'Super',
  'Admin', 
  'bahenawilliamjefferson@gmail.com',
  '$2a$10$rYvLyKhkkYhJjzY7c2kzg.YE7sZy1WzC8t8R1hRnHWHnhQk8.sRR.', -- Hash de "12345678"
  'superAdmin',
  NOW()
) ON CONFLICT (email) DO UPDATE SET
  password = EXCLUDED.password,
  role = EXCLUDED.role;

-- Verificar que el usuario fue creado
SELECT id, first_name, last_name, email, role, created_at 
FROM users 
WHERE email = 'bahenawilliamjefferson@gmail.com';

-- Mensaje de confirmación
SELECT 'Usuario SuperAdmin creado exitosamente' as mensaje,
       'Email: bahenawilliamjefferson@gmail.com' as email,
       'Contraseña: 12345678' as password,
       'Rol: superAdmin' as rol;