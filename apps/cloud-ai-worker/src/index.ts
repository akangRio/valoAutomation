import { Worker, Job, Queue, ConnectionOptions } from 'bullmq';
import { prisma } from '@packages/database';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';
import { GoogleGenAI, Type } from '@google/genai';

// 1. Validate environment variables early and loudly at process boot
const envSchema = z.object({
  DATABASE_URL: z.string().url('Invalid or missing DATABASE_URL'),
  REDIS_URL: z.string().url('Invalid or missing REDIS_URL'),
  GEMINI_API_KEY: z.string().default('mock_key'),
});

const parsedEnv = envSchema.safeParse(process.env);
if (!parsedEnv.success) {
  console.error(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'fatal',
      service: 'cloud-ai-worker',
      message: 'Environment validation failed',
      errors: parsedEnv.error.format(),
    }),
  );
  process.exit(1);
}

const env = parsedEnv.data;
const parsedUrl = new URL(env.REDIS_URL);

// Connection options parsed from REDIS_URL to avoid TypeScript ioredis version mismatch
const connectionOptions: ConnectionOptions = {
  host: parsedUrl.hostname || '127.0.0.1',
  port: parsedUrl.port ? parseInt(parsedUrl.port, 10) : 6379,
  username: parsedUrl.username || undefined,
  password: parsedUrl.password || undefined,
};

// Initialize the tts-voice-queue to enqueue the next pipeline step
const ttsVoiceQueue = new Queue('tts-voice-queue', {
  connection: connectionOptions,
});

// Initialize Gemini Client if live key is available
const isMockMode = env.GEMINI_API_KEY === 'mock_key' || env.GEMINI_API_KEY.startsWith('mock');
let aiClient: GoogleGenAI | null = null;
if (!isMockMode) {
  aiClient = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
}

// 2. Initialize worker
const worker = new Worker(
  'cloud-ai-queue',
  async (job: Job) => {
    const { jobId, keyframesDir, metadata } = job.data;

    console.log(
      JSON.stringify({
        timestamp: new Date().toISOString(),
        level: 'info',
        service: 'cloud-ai-worker',
        message: `Processing cloud AI analysis for job ${jobId || job.id}`,
        jobId: jobId || job.id,
      }),
    );

    if (!jobId || !keyframesDir) {
      throw new Error('Invalid job payload: jobId and keyframesDir are required');
    }

    try {
      // Step 1: Update parent Job status to CLOUD_ANALYZING, currentStep: CLOUD_ANALYZING
      await prisma.job.update({
        where: { id: jobId },
        data: {
          status: 'CLOUD_ANALYZING',
          currentStep: 'CLOUD_ANALYZING',
        },
      });

      // Step 2: Retrieve keyframes from disk
      if (!fs.existsSync(keyframesDir)) {
        throw new Error(`Keyframes directory does not exist at ${keyframesDir}`);
      }

      const files = fs.readdirSync(keyframesDir);
      const keyframeFiles = files
        .filter((file) => /\.(jpg|jpeg|png)$/i.test(file))
        .sort() // Ensure alphabetical chronological ordering
        .map((file) => path.join(keyframesDir, file));

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'cloud-ai-worker',
          message: `Found ${keyframeFiles.length} keyframe files for analysis`,
          jobId,
          files: keyframeFiles,
        }),
      );

      let resultJson: {
        suggestedTitle: string;
        description: string;
        tags: string[];
        voiceoverScript: string;
        visualDirection: {
          clutchDescription: string;
          captionColor: string;
        };
      };

      if (isMockMode) {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'cloud-ai-worker',
            message: 'Running in MOCK mode. Bypassing live Gemini API call.',
            jobId,
          }),
        );

        // Generate fully deterministic and realistic mock response matching the target schema
        const killsCount = metadata?.killsCount || 4;
        const mapName = metadata?.mapName || 'Bind';
        
        resultJson = {
          suggestedTitle: `Insane ${killsCount}K Clutch in ${mapName}! #Shorts`,
          description: `Unreal gameplay highlight from ${mapName}! Watching this player get an absolute ${killsCount}K clutch! Like and subscribe for more Valorant shorts! #valorant #shorts #clutch #gaming`,
          tags: ['Valorant', 'Clutch', mapName, `${killsCount}K`, 'Shorts', 'Gaming'],
          voiceoverScript: `Unreal visual awareness! The player swings onto the site on ${mapName}, locking onto the first target with pixel-perfect accuracy. That is one down! Instantly re-clears Hookah and drops the second! Now they are hunting for the third. They spot the head, spray, and it is a triple! But wait, there is one more left. They tap the head... UNREAL ${killsCount}K DEFENSE! That is why they are Radiant!`,
          visualDirection: {
            clutchDescription: `UNREAL ${killsCount}K DEFENSE`,
            captionColor: '#00FFFF', // Cyan highlighter
          },
        };
      } else {
        console.log(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'info',
            service: 'cloud-ai-worker',
            message: 'Calling live Gemini 1.5 Flash API with multimodal keyframes...',
            jobId,
          }),
        );

        // Convert keyframes to base64 parts
        const imageParts = keyframeFiles.map((kfPath) => {
          const content = fs.readFileSync(kfPath);
          return {
            inlineData: {
              mimeType: 'image/jpeg',
              data: content.toString('base64'),
            },
          };
        });

        // Load visual storyteller system instructions from disk
        const promptPath = path.resolve(__dirname, '../../../prompts/gemini-visual-v1.md');
        let systemInstruction = 'You are a professional esports commentator and TikTok/YouTube Shorts content specialist.';
        if (fs.existsSync(promptPath)) {
          systemInstruction = fs.readFileSync(promptPath, 'utf-8');
        }

        const promptText = `Analyze these ${keyframeFiles.length} sequential screenshots from a high-intensity Valorant clutch moment. 
Context: Job ID ${jobId}, Map: ${metadata?.mapName || 'Unknown'}, Detected Kills: ${metadata?.killsCount || 'Multi'}.
Generate the high-impact commentary script and SEO tags. Always return output strictly matching the response schema structure.`;

        const contents = [
          {
            role: 'user',
            parts: [
              { text: promptText },
              ...imageParts,
            ],
          },
        ];

        const responseSchema: any = {
          type: Type.OBJECT,
          properties: {
            suggestedTitle: {
              type: Type.STRING,
              description: 'Highly engaging, SEO optimized Title containing #Shorts',
            },
            description: {
              type: Type.STRING,
              description: 'Rich description containing relevant hashtags',
            },
            tags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            voiceoverScript: {
              type: Type.STRING,
              description: 'High-impact narrative voice commentary under 130 words',
            },
            visualDirection: {
              type: Type.OBJECT,
              properties: {
                clutchDescription: {
                  type: Type.STRING,
                  description: 'Floating overlay caption (e.g., UNREAL 4K DEFENSE)',
                },
                captionColor: {
                  type: Type.STRING,
                  description: 'Hex color code for subtitle highlights (e.g., #FFD700)',
                },
              },
              required: ['clutchDescription', 'captionColor'],
            },
          },
          required: ['suggestedTitle', 'description', 'tags', 'voiceoverScript', 'visualDirection'],
        };

        const response = await aiClient!.models.generateContent({
          model: 'gemini-1.5-flash',
          contents,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema,
          },
        });

        const responseText = response.text;
        if (!responseText) {
          throw new Error('Received empty response text from Gemini API');
        }

        resultJson = JSON.parse(responseText.trim());
      }

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'cloud-ai-worker',
          message: 'Successfully generated gameplay script and visual direction metadata',
          jobId,
          result: resultJson,
        }),
      );

      // Step 3: Write relational records to PostgreSQL DB via Prisma Transaction
      await prisma.$transaction(async (tx) => {
        // Create or update VideoMetadata
        await tx.videoMetadata.create({
          data: {
            jobId,
            suggestedTitle: resultJson.suggestedTitle,
            description: resultJson.description,
            tags: resultJson.tags,
            voiceoverScript: resultJson.voiceoverScript,
            clutchOverlay: resultJson.visualDirection.clutchDescription,
            captionColor: resultJson.visualDirection.captionColor,
            musicTheme: 'HYPE',
          },
        });

        // Update parent Job status
        await tx.job.update({
          where: { id: jobId },
          data: {
            status: 'CLOUD_COMPLETED',
            currentStep: 'CLOUD_COMPLETED',
          },
        });
      });

      // Step 4: Enqueue the next event into tts-voice-queue matching TTSVoiceJobPayload
      await ttsVoiceQueue.add('tts-generate', {
        jobId,
        scriptText: resultJson.voiceoverScript,
      });

      console.log(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'info',
          service: 'cloud-ai-worker',
          message: `Cloud AI analysis completed and next job enqueued to tts-voice-queue for jobId ${jobId}`,
          jobId,
        }),
      );

    } catch (error: any) {
      console.error(
        JSON.stringify({
          timestamp: new Date().toISOString(),
          level: 'error',
          service: 'cloud-ai-worker',
          message: `Worker job execution failed: ${error.message}`,
          jobId: jobId || job.id,
          error: {
            message: error.message,
            stack: error.stack,
          },
        }),
      );

      // Save error details back to database Job record for visibility
      try {
        await prisma.job.update({
          where: { id: jobId || job.id },
          data: {
            status: 'FAILED',
            currentStep: 'CLOUD_ANALYZING',
            errorLog: error.message || String(error),
          },
        });
      } catch (dbError: any) {
        console.error(
          JSON.stringify({
            timestamp: new Date().toISOString(),
            level: 'error',
            service: 'cloud-ai-worker',
            message: `Failed to record error log in database: ${dbError.message}`,
            jobId: jobId || job.id,
          }),
        );
      }

      throw error;
    }
  },
  {
    connection: connectionOptions,
    concurrency: 1, // Restrict cloud APIs to protect quota throttling
  },
);

console.log(
  JSON.stringify({
    timestamp: new Date().toISOString(),
    level: 'info',
    service: 'cloud-ai-worker',
    message: 'Cloud AI Worker bootstrap complete, listening to cloud-ai-queue',
  }),
);

// Graceful shutdown handler
export const shutdown = async () => {
  console.log(
    JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      service: 'cloud-ai-worker',
      message: 'Shutting down Cloud AI Worker...',
    }),
  );
  await worker.close();
  await ttsVoiceQueue.close();
  await prisma.$disconnect();
};

export { worker };
