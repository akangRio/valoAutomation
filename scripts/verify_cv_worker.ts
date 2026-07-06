import { worker, shutdown } from '../apps/cv-slicer-worker/src/index';

async function runWorkerVerification() {
  console.log('🚀 Starting CV Slicer Worker integration verification...');

  try {
    // Check if worker is defined and has correct queue name
    if (!worker) {
      throw new Error('Test failed: Worker was not instantiated.');
    }

    const queueName = worker.name;
    console.log(`Worker name (Queue Bound): ${queueName}`);
    if (queueName !== 'cv-slicer-queue') {
      throw new Error(`Test failed: Worker is bound to queue '${queueName}', expected 'cv-slicer-queue'`);
    }

    // Verify worker is connected to Redis and responds to ping
    const client = await worker.client;
    const pingResult = await client.ping();
    console.log(`Redis connection ping result: ${pingResult}`);
    if (pingResult !== 'PONG') {
      throw new Error(`Test failed: Expected Redis ping 'PONG', got '${pingResult}'`);
    }

    console.log('✅ Worker successfully instantiated, bound to correct queue, and connected to Redis.');
    console.log('\n🎉 ALL CV SLICER WORKER SETUP TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error: any) {
    console.error('\n❌ CV Slicer Worker verification failed:', error.message);
    process.exitCode = 1;
  } finally {
    console.log('🔌 Shutting down worker gracefully...');
    try {
      await shutdown();
      console.log('🔌 Worker shut down cleanly.');
    } catch (shutdownError: any) {
      console.error('⚠️ Error during shutdown:', shutdownError.message);
    }
    process.exit(process.exitCode || 0);
  }
}

// Execute checks
runWorkerVerification();
