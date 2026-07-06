import { app, server } from '../apps/api-gateway/src/index';
import { prisma } from '@packages/database';

async function runTests() {
  console.log('🚀 Starting Express API Gateway integration verification...');
  const baseUrl = 'http://127.0.0.1:3000';

  let testJobId = '';

  try {
    // -------------------------------------------------------------
    // Test 1: Invalid Payload Zod Validation
    // -------------------------------------------------------------
    console.log('\n📝 Test 1: POST /api/v1/jobs - Invalid Payload');
    const res1 = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });

    const data1 = (await res1.json()) as any;
    console.log(`Status: ${res1.status}`);
    console.log('Response:', JSON.stringify(data1, null, 2));

    if (res1.status !== 400 || data1.status !== 'error') {
      throw new Error('Test 1 failed: Expected status 400 and status "error"');
    }
    console.log('✅ Test 1 Passed: Zod schema validation correctly rejected empty payload.');

    // -------------------------------------------------------------
    // Test 2: Success Job Creation
    // -------------------------------------------------------------
    console.log('\n📝 Test 2: POST /api/v1/jobs - Valid Payload');
    const testVideoPath = 'C:/Videos/ValorantCaptures/clutch_bind_0706.mp4';
    const res2 = await fetch(`${baseUrl}/api/v1/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rawVideoPath: testVideoPath }),
    });

    const data2 = (await res2.json()) as any;
    console.log(`Status: ${res2.status}`);
    console.log('Response:', JSON.stringify(data2, null, 2));

    if (res2.status !== 202 || data2.status !== 'success' || !data2.data.jobId) {
      throw new Error('Test 2 failed: Expected status 202 and success data');
    }

    testJobId = data2.data.jobId;
    console.log('✅ Test 2 Passed: Job successfully created inside PostgreSQL.');

    // -------------------------------------------------------------
    // Test 3: Get Job Status
    // -------------------------------------------------------------
    console.log(`\n📝 Test 3: GET /api/v1/jobs/${testJobId} - Get Job Status`);
    const res3 = await fetch(`${baseUrl}/api/v1/jobs/${testJobId}`);
    const data3 = (await res3.json()) as any;
    console.log(`Status: ${res3.status}`);
    console.log('Response:', JSON.stringify(data3, null, 2));

    if (res3.status !== 200 || data3.status !== 'success' || data3.data.id !== testJobId) {
      throw new Error('Test 3 failed: Expected status 200 and matched Job ID');
    }
    console.log('✅ Test 3 Passed: Successfully retrieved real-time status matching API Contract.');

    // -------------------------------------------------------------
    // Test 4: Get Job Status - Not Found
    // -------------------------------------------------------------
    console.log('\n📝 Test 4: GET /api/v1/jobs/:id - Not Found');
    const fakeId = '00000000-0000-0000-0000-000000000000';
    const res4 = await fetch(`${baseUrl}/api/v1/jobs/${fakeId}`);
    const data4 = (await res4.json()) as any;
    console.log(`Status: ${res4.status}`);
    console.log('Response:', JSON.stringify(data4, null, 2));

    if (res4.status !== 404 || data4.status !== 'error') {
      throw new Error('Test 4 failed: Expected status 404 for non-existent job ID');
    }
    console.log('✅ Test 4 Passed: Returned 404 for non-existent job.');

    // -------------------------------------------------------------
    // Test 5: Undefined Route Check
    // -------------------------------------------------------------
    console.log('\n📝 Test 5: GET /api/v1/invalid-route');
    const res5 = await fetch(`${baseUrl}/api/v1/invalid-route`);
    const data5 = (await res5.json()) as any;
    console.log(`Status: ${res5.status}`);
    console.log('Response:', JSON.stringify(data5, null, 2));

    if (res5.status !== 404 || data5.status !== 'error') {
      throw new Error('Test 5 failed: Expected status 404 for undefined routes');
    }
    console.log('✅ Test 5 Passed: Catch-all undefined route handler functioning as expected.');

    console.log('\n🎉 ALL INTEGRATION TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error: any) {
    console.error('\n❌ Integration verification failed:', error.message);
    process.exitCode = 1;
  } finally {
    // 6. Clean shutdown
    server.close(() => {
      console.log('🛑 Server shut down.');
      prisma.$disconnect().then(() => {
        process.exit(process.exitCode || 0);
      });
    });
  }
}

// Ensure the server has a moment to start
setTimeout(runTests, 1000);
