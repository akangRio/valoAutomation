# Services Specifications: Valorant AI Content Automation (Enterprise)

This document provides technical design specifications, API endpoints, environmental configurations, and BullMQ payload contracts for each modular service.

---

## 1. Express API Gateway (`/apps/api-gateway`)

The HTTP entry point and central coordinator of the platform.

- **Technology**: Node.js, TypeScript, Express, Prisma, BullMQ.
- **Responsibilities**:
  - Serves HTTP REST endpoints for job creation, metrics querying, and pipeline trigger management.
  - Manages database entries in PostgreSQL using Prisma.
  - Generates and enqueues task payloads into BullMQ.
- **HTTP Routing Table**:
  - `POST /api/v1/jobs`: Trigger a raw video ingestion. (Payload: `{ rawVideoPath: string }`).
  - `GET /api/v1/jobs/:id`: Fetch real-time job status and execution log metrics.
  - `POST /api/v1/jobs/:id/retry`: Resubmit a failed job into its active state queue.
  - `GET /api/v1/queues/status`: Monitor BullMQ active, delayed, and failed job counts.
- **Environment Schema (Zod)**:
  - `PORT`: Gateway network port (default: `3000`).
  - `DATABASE_URL`: PostgreSQL connection string.
  - `REDIS_URL`: Redis connection string (`redis://127.0.0.1:6379`).

---

## 2. Capture Monitor (`/apps/capture-monitor`)

A lightweight observer daemon that bridges the physical desktop folder to our API Gateway.

- **Technology**: Node.js, TypeScript, `chokidar`, `axios`.
- **Responsibilities**:
  - Watches local directory path for new video files (`.mp4`, `.mkv`).
  - Measures file size over 5-second increments to ensure file write completion.
  - Executes a `POST /api/v1/jobs` call to the API Gateway on detection.
- **Environment Schema (Zod)**:
  - `CAPTURES_DIR`: Path to the local OBS recordings folder.
  - `GATEWAY_URL`: Endpoint of the Express API Gateway (`http://localhost:3000/api/v1`).

---

## 3. CV Slicer Worker (`/apps/cv-slicer-worker`)

A BullMQ worker executing computer vision algorithms.

- **Technology**: Node.js, TypeScript, Python child process spawning, OpenCV, NumPy, FFmpeg.
- **Queue Bound**: `cv-slicer-queue`
- **Job Payload Contract**:
  ```typescript
  interface CVSlicerJobPayload {
    jobId: string;
    rawVideoPath: string;
  }
  ```
- **Execution Logic**:
  - Spawns a localized Python CV script to detect "Kill Skull" game graphics.
  - Trim/slice raw game footage into a 15-45s clip using FFmpeg.
  - Extract exactly 5 JPEG keyframes representing climax events.
  - Writes data to disk, updates the Prisma database, and enqueues a job into `cloud-ai-queue`.

---

## 4. Cloud AI Worker (`/apps/cloud-ai-worker`)

A BullMQ worker leveraging multimodal cloud models for play synthesis.

- **Technology**: Node.js, TypeScript, Google Cloud Vision, `@google/genai` (Gemini API), Prisma.
- **Queue Bound**: `cloud-ai-queue`
- **Job Payload Contract**:
  ```typescript
  interface CloudAIJobPayload {
    jobId: string;
    keyframesDir: string;
    metadata: {
      mapName?: string;
      rawKillsCount?: number;
    };
  }
  ```
- **Execution Logic**:
  - Encodes keyframe images to base64 and constructs a multimodal analysis prompt.
  - Sends requests to Gemini 1.5 Flash API with strict response schemas.
  - Saves the generated narration script and YouTube SEO metadata to PostgreSQL via Prisma.
  - Enqueues job to `tts-voice-queue`.

---

## 5. TTS Voice Worker (`/apps/tts-voice-worker`)

A BullMQ worker handling voice generation and dynamic boundary alignment.

- **Technology**: Node.js, TypeScript, Microsoft Edge-TTS or ElevenLabs, Prisma.
- **Queue Bound**: `tts-voice-queue`
- **Job Payload Contract**:
  ```typescript
  interface TTSVoiceJobPayload {
    jobId: string;
    scriptText: string;
  }
  ```
- **Execution Logic**:
  - Dispatches script to synthesized voice generator API.
  - Captures word boundary timing structures (exact millisecond duration of each spoken word).
  - Saves voiceover MP3 and subtitle timing JSON to PostgreSQL and local disk.
  - Enqueues job to `video-render-queue`.

---

## 6. Remotion Render Worker (`/apps/video-render-worker`)

A BullMQ worker compiling high-fidelity portrait videos.

- **Technology**: Node.js, TypeScript, React, Remotion, FFmpeg, Prisma.
- **Queue Bound**: `video-render-queue`
- **Concurrency Limit**: **`1`** (To protect GPU resources during gameplay).
- **Job Payload Contract**:
  ```typescript
  interface VideoRenderJobPayload {
    jobId: string;
    highlightVideoPath: string;
    voiceoverAudioPath: string;
    wordTimestampsPath: string;
    visualMetadata: {
      agent: string;
      captionColor: string;
      titleOverlay: string;
    };
  }
  ```
- **Execution Logic**:
  - Triggers Remotion CLI render engine.
  - Compiles React timelines (game cropping, animated captions, HUD overlays, audio mixing) into a vertical MP4.
  - Updates PostgreSQL database state to `RENDER_COMPLETED` via Prisma and enqueues job to `publishing-queue`.

---

## 7. YouTube Publisher Worker (`/apps/youtube-publisher-worker`)

A BullMQ worker completing the automation cycle.

- **Technology**: Node.js, TypeScript, Googleapis SDK, Prisma.
- **Queue Bound**: `publishing-queue`
- **Job Payload Contract**:
  ```typescript
  interface PublishingJobPayload {
    jobId: string;
    renderedVideoPath: string;
    publishTime: string;
  }
  ```
- **Execution Logic**:
  - Signs into Google APIs via local rotating OAuth2 refresh tokens.
  - Uploads chunked MP4 video as a vertical YouTube Short.
  - Schedules Short publishing based on the database queue profiles.
  - Sets job status to `COMPLETED` in PostgreSQL, then triggers database file-cleanup events.
