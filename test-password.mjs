import bcrypt from 'bcryptjs';

const hash = '$2b$10$yGjqx.i6VcXnOvYP7lSrFuYr/LPkV8jHJ3Gh1p0HTTa1Q.nzFgC.2';
const passwords = ['admin123', 'test123', '12345678', '123456', 'password', 'admin'];

console.log('🔍 PROBANDO CONTRASEÑAS CON EL HASH ACTUAL:');
console.log('==========================================');

passwords.forEach(pwd => {
  const result = bcrypt.compareSync(pwd, hash);
  console.log(`- ${pwd}: ${result ? '✅ CORRECTO' : '❌ Incorrecto'}`);
});

// Vamos a crear un nuevo hash para admin123
console.log('\n🔧 CREANDO NUEVO HASH PARA admin123:');
const newHash = bcrypt.hashSync('admin123', 10);
console.log('Nuevo hash:', newHash);
console.log('Verificación:', bcrypt.compareSync('admin123', newHash) ? '✅ CORRECTO' : '❌ Incorrecto');