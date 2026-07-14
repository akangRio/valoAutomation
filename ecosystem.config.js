module.exports = {
  apps: [
    {
      name: 'api-gateway',
      script: 'npx',
      args: 'ts-node src/index.ts',
      cwd: './apps/api-gateway',
      watch: false,
      env: {
        NODE_ENV: 'development',
      }
    },
    {
      name: 'cv-slicer-worker',
      script: 'npx',
      args: 'ts-node src/index.ts',
      cwd: './apps/cv-slicer-worker',
      watch: false,
      env: {
        NODE_ENV: 'development',
      }
    },
    {
      name: 'cloud-ai-worker',
      script: 'npx',
      args: 'ts-node src/index.ts',
      cwd: './apps/cloud-ai-worker',
      watch: false,
      env: {
        NODE_ENV: 'development',
      }
    },
    {
      name: 'tts-voice-worker',
      script: 'npx',
      args: 'ts-node src/index.ts',
      cwd: './apps/tts-voice-worker',
      watch: false,
      env: {
        NODE_ENV: 'development',
      }
    },
    {
      name: 'video-render-worker',
      script: 'npx',
      args: 'ts-node src/worker.ts',
      cwd: './apps/video-render-worker',
      watch: false,
      env: {
        NODE_ENV: 'development',
        RENDER_MOCK_MODE: 'true'
      }
    },
    {
      name: 'youtube-publisher-worker',
      script: 'npx',
      args: 'ts-node src/index.ts',
      cwd: './apps/youtube-publisher-worker',
      watch: false,
      env: {
        NODE_ENV: 'development',
        YOUTUBE_MOCK_MODE: 'true'
      }
    }
  ]
};
