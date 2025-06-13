const { DatabaseStorage } = require('./server/db-storage.ts');

async function testOptimizationDirect() {
  try {
    console.log('Testing optimization directly through storage layer...');
    
    const storage = new DatabaseStorage();
    
    // Test optimized mode
    console.log('\n=== TESTING OPTIMIZED MODE ===');
    const optimizedTrips = await storage.searchTrips({
      includeAllVisibilities: true,
      optimizedResponse: true
    });
    
    const optimizedSize = JSON.stringify(optimizedTrips).length;
    console.log(`Optimized mode: ${optimizedTrips.length} trips, ${optimizedSize} bytes`);
    console.log('Sample optimized trip keys:', optimizedTrips[0] ? Object.keys(optimizedTrips[0]) : 'No trips');
    console.log('Sample optimized trip ID:', optimizedTrips[0]?.id);
    
    // Test expanded mode
    console.log('\n=== TESTING EXPANDED MODE ===');
    const expandedTrips = await storage.searchTrips({
      includeAllVisibilities: true,
      optimizedResponse: false
    });
    
    const expandedSize = JSON.stringify(expandedTrips).length;
    console.log(`Expanded mode: ${expandedTrips.length} trips, ${expandedSize} bytes`);
    console.log('Sample expanded trip keys:', expandedTrips[0] ? Object.keys(expandedTrips[0]) : 'No trips');
    console.log('Sample expanded trip ID:', expandedTrips[0]?.id);
    
    // Calculate reduction
    const reduction = ((expandedSize - optimizedSize) / expandedSize * 100).toFixed(2);
    console.log(`\n=== OPTIMIZATION RESULTS ===`);
    console.log(`Size reduction: ${reduction}% (${expandedSize - optimizedSize} bytes saved)`);
    console.log(`Trip count reduction: ${expandedTrips.length - optimizedTrips.length} (${expandedTrips.length} → ${optimizedTrips.length})`);
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testOptimizationDirect();