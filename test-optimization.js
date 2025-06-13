const axios = require('axios');

async function testOptimization() {
  try {
    console.log('Testing optimization without authentication check...');
    
    // Test optimized endpoint
    const optimizedResponse = await axios.get('http://localhost:5000/api/admin-trips', {
      params: { optimizedResponse: true },
      validateStatus: () => true // Don't throw on 401
    });
    
    console.log('Optimized response status:', optimizedResponse.status);
    if (optimizedResponse.status === 200) {
      console.log('Optimized response data length:', JSON.stringify(optimizedResponse.data).length);
      console.log('Number of trips returned:', optimizedResponse.data.length);
      console.log('First trip keys:', Object.keys(optimizedResponse.data[0] || {}));
    } else {
      console.log('Optimized response error:', optimizedResponse.data);
    }
    
    // Test regular endpoint for comparison
    const regularResponse = await axios.get('http://localhost:5000/api/admin-trips', {
      params: { optimizedResponse: false },
      validateStatus: () => true
    });
    
    console.log('\nRegular response status:', regularResponse.status);
    if (regularResponse.status === 200) {
      console.log('Regular response data length:', JSON.stringify(regularResponse.data).length);
      console.log('Number of trips returned:', regularResponse.data.length);
      console.log('First trip keys:', Object.keys(regularResponse.data[0] || {}));
    } else {
      console.log('Regular response error:', regularResponse.data);
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testOptimization();