const fetch = require('node-fetch');

const BASE_URL = 'http://localhost:5000';

// Test function to verify ticket office access to packages
async function testTicketOfficePackageAccess() {
  try {
    console.log('🧪 Testing ticket office package access...');
    
    // Try to get packages with ticket office credentials
    const response = await fetch(`${BASE_URL}/api/packages`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=test-session-taquilla'
      }
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 200) {
      console.log('✅ SUCCESS: Ticket office can access packages endpoint');
      const data = await response.json();
      console.log(`Found ${data.length} packages`);
      return true;
    } else if (response.status === 403) {
      console.log('❌ FAILED: Access denied for ticket office role');
      const error = await response.text();
      console.log('Error message:', error);
      return false;
    } else {
      console.log(`❓ UNEXPECTED: Status ${response.status}`);
      const error = await response.text();
      console.log('Response:', error);
      return false;
    }
  } catch (error) {
    console.error('Error testing access:', error);
    return false;
  }
}

// Test package creation
async function testPackageCreation() {
  try {
    console.log('\n🧪 Testing package creation...');
    
    const testPackage = {
      senderName: "Test Sender",
      senderLastName: "Test Last Name",
      senderPhone: "1234567890",
      recipientName: "Test Recipient", 
      recipientLastName: "Test Recipient Last",
      recipientPhone: "0987654321",
      description: "Test Package",
      price: 100,
      isPaid: false,
      paymentMethod: "efectivo",
      seatsQuantity: 0,
      usesSeats: false,
      tripDetails: {
        tripId: "39_0",
        origin: "Test Origin",
        destination: "Test Destination",
        departureDate: "2025-07-05",
        departureTime: "10:00 AM",
        arrivalTime: "03:00 PM"
      }
    };
    
    const response = await fetch(`${BASE_URL}/api/packages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': 'connect.sid=test-session-taquilla'
      },
      body: JSON.stringify(testPackage)
    });
    
    console.log(`Response status: ${response.status}`);
    
    if (response.status === 201) {
      console.log('✅ SUCCESS: Package created successfully');
      const data = await response.json();
      console.log(`Created package ID: ${data.id}`);
      return true;
    } else {
      console.log('❌ FAILED: Package creation failed');
      const error = await response.text();
      console.log('Error message:', error);
      return false;
    }
  } catch (error) {
    console.error('Error testing package creation:', error);
    return false;
  }
}

async function main() {
  console.log('TESTING TICKET OFFICE PACKAGE ACCESS');
  console.log('====================================\n');
  
  const accessTest = await testTicketOfficePackageAccess();
  const creationTest = await testPackageCreation();
  
  console.log('\n📋 SUMMARY:');
  console.log(`Package access: ${accessTest ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Package creation: ${creationTest ? '✅ PASS' : '❌ FAIL'}`);
  
  if (accessTest && creationTest) {
    console.log('\n🎉 All tests passed! Ticket office can access and create packages.');
  } else {
    console.log('\n⚠️  Some tests failed. Check the logs above for details.');
  }
}

main().catch(console.error);