import fetch from 'node-fetch';

async function testLogin() {
  console.log('🔍 Testing login functionality...');
  
  // Test 1: Login with correct credentials
  console.log('\n1. Testing login with correct credentials...');
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'bahenawilliamjefferson@gmail.com',
        password: '123456'
      })
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    if (response.ok) {
      console.log('✅ Login successful');
    } else {
      console.log('❌ Login failed:', data.message);
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
  
  // Test 2: Login with wrong credentials
  console.log('\n2. Testing login with wrong credentials...');
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'bahenawilliamjefferson@gmail.com',
        password: 'wrongpassword'
      })
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
    
    if (response.status === 401) {
      console.log('✅ Error handling works correctly');
    } else {
      console.log('❌ Expected 401 error');
    }
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
  
  // Test 3: Test with malformed email
  console.log('\n3. Testing login with malformed email...');
  try {
    const response = await fetch('http://localhost:5000/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'invalid-email',
        password: '123456'
      })
    });
    
    const data = await response.json();
    console.log('Status:', response.status);
    console.log('Response:', data);
  } catch (error) {
    console.error('❌ Network error:', error.message);
  }
}

testLogin().catch(console.error);