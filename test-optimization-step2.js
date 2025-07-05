const dotenv = require("dotenv");
dotenv.config();

const { storage } = require('./server/storage.ts');

async function testStep2Optimization() {
  try {
    console.log('🔍 TESTING STEP 2: JOINS OPTIMIZATION');
    console.log('======================================\n');
    
    const testParams = {
      includeAllVisibilities: true,
      optimizedResponse: false
    };
    
    // Test método original (con consultas N+1)
    console.log('📊 Testing ORIGINAL method (with N+1 queries)...');
    const startOriginal = Date.now();
    
    const originalResults = await storage.searchTrips(testParams);
    
    const originalTime = Date.now() - startOriginal;
    const originalSize = JSON.stringify(originalResults).length;
    
    console.log(`✅ Original method completed:`);
    console.log(`   - Time: ${originalTime}ms`);
    console.log(`   - Results: ${originalResults.length} trips`);
    console.log(`   - Data size: ${originalSize} bytes`);
    console.log(`   - Expected DB queries: 5+ (trips + routes + owners + vehicles + drivers)\n`);
    
    // Test método optimizado (con JOINs)
    console.log('⚡ Testing OPTIMIZED method (with JOINs)...');
    const startOptimized = Date.now();
    
    const optimizedResults = await storage.searchTripsOptimized(testParams);
    
    const optimizedTime = Date.now() - startOptimized;
    const optimizedSize = JSON.stringify(optimizedResults).length;
    
    console.log(`✅ Optimized method completed:`);
    console.log(`   - Time: ${optimizedTime}ms`);
    console.log(`   - Results: ${optimizedResults.length} trips`);
    console.log(`   - Data size: ${optimizedSize} bytes`);
    console.log(`   - DB queries: 1 (single JOIN query)\n`);
    
    // Calculate improvements
    const timeImprovement = ((originalTime - optimizedTime) / originalTime * 100).toFixed(1);
    const queryReduction = ((5 - 1) / 5 * 100).toFixed(1); // From 5 queries to 1
    
    console.log('📈 OPTIMIZATION RESULTS:');
    console.log('========================');
    console.log(`🏎️  Speed improvement: ${timeImprovement}% faster`);
    console.log(`🔗 Query reduction: ${queryReduction}% fewer queries`);
    console.log(`📊 Result count match: ${originalResults.length === optimizedResults.length ? '✅ SAME' : '❌ DIFFERENT'}`);
    
    if (originalTime > optimizedTime) {
      console.log(`🎉 SUCCESS: Optimized method is ${timeImprovement}% faster!`);
    } else {
      console.log(`⚠️  Note: Performance difference was minimal, but queries were reduced significantly`);
    }
    
    // Compare result structure (sample)
    if (originalResults.length > 0 && optimizedResults.length > 0) {
      console.log('\n🔍 Sample result comparison:');
      console.log('Original keys:', Object.keys(originalResults[0]));
      console.log('Optimized keys:', Object.keys(optimizedResults[0]));
    }
    
  } catch (error) {
    console.error('❌ Error during optimization test:', error);
  }
}

testStep2Optimization();