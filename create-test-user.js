import bcrypt from 'bcryptjs';
import { db } from './server/db-storage.js';
import * as schema from './shared/schema.js';

async function createTestUser() {
  try {
    const hashedPassword = await bcrypt.hash('test123', 10);
    
    await db.insert(schema.users).values({
      email: 'test@test.com',
      password: hashedPassword,
      firstName: 'Test',
      lastName: 'User',
      phone: '1234567890',
      role: 'admin',
      companyIds: ['bamo-350045']
    });
    
    console.log('Test user created successfully');
    console.log('Email: test@test.com');
    console.log('Password: test123');
    process.exit(0);
  } catch (error) {
    console.error('Error creating test user:', error);
    process.exit(1);
  }
}

createTestUser();