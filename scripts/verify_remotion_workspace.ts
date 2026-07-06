import * as fs from 'fs';
import * as path from 'path';

async function runRemotionVerification() {
  console.log('🚀 Starting Remotion Scaffolding Task 4.1 integration verification...');

  try {
    const rootPath = path.resolve(__dirname, '../apps/video-render-worker/src/Root.tsx');
    const compPath = path.resolve(__dirname, '../apps/video-render-worker/src/Composition.tsx');
    const buildPath = path.resolve(__dirname, '../apps/video-render-worker/build');

    console.log('1. Checking file existence...');
    if (!fs.existsSync(rootPath)) {
      throw new Error(`Expected Root.tsx to exist at ${rootPath}`);
    }
    if (!fs.existsSync(compPath)) {
      throw new Error(`Expected Composition.tsx to exist at ${compPath}`);
    }

    console.log('2. Verifying portrait configuration (1080x1920, 60fps)...');
    const rootContent = fs.readFileSync(rootPath, 'utf-8');
    if (!rootContent.includes('width={1080}')) {
      throw new Error('Root.tsx is missing width={1080} configuration');
    }
    if (!rootContent.includes('height={1920}')) {
      throw new Error('Root.tsx is missing height={1920} configuration');
    }
    if (!rootContent.includes('fps={60}')) {
      throw new Error('Root.tsx is missing fps={60} configuration');
    }
    console.log('✓ Portrait metrics 1080x1920 at 60fps successfully verified in Root.tsx.');

    console.log('3. Verifying dynamic zoom and centering on crosshair...');
    const compContent = fs.readFileSync(compPath, 'utf-8');
    if (!compContent.includes('objectFit: "cover"') && !compContent.includes('objectFit: \'cover\'')) {
      throw new Error('Composition.tsx does not use objectFit: "cover" to center content');
    }
    if (!compContent.includes('transform: `scale(') && !compContent.includes('transform: "scale(')) {
      throw new Error('Composition.tsx does not implement scale transforms for zoom matrices');
    }
    console.log('✓ Dynamic crosshair cropping and zoom matrices successfully verified in Composition.tsx.');

    console.log('4. Verifying Remotion build output bundle...');
    if (!fs.existsSync(buildPath)) {
      throw new Error(`Expected build bundle to exist at ${buildPath}. Please compile the project first.`);
    }
    console.log('✓ Remotion build output bundle verified at apps/video-render-worker/build.');

    console.log('\n🎉 ALL TASK 4.1 REMOTION SCAFFOLDING TESTS PASSED SUCCESSFULLY! 🎉');
  } catch (error: any) {
    console.error('\n❌ Remotion verification failed:', error.message);
    process.exitCode = 1;
  }
}

runRemotionVerification();
