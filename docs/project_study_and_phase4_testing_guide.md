# 🎮 Project Progress Study & Local Testing Guide (Phase 4)

This comprehensive report studies the development progress of the **Valorant AI Content Automation** platform, details how to perform local verification for **Phase 4 (Programmatic Remotion Compositor)**, and outlines the step-by-step checklist to prepare the system for full **production/non-mock** operation (including Google Cloud, YouTube API, and local host runtimes).

---

## 📈 Part 1: Project Progress Study

The monorepo operates on a cost-effective, decentralized **local-first, event-driven architecture**. High-performance media tasks run on local hardware, while light metadata reasoning is outsourced to cloud AI.

Here is the current state of development across all milestones:

### 🗺️ Milestone Progress Board

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MILESTONE PROGRESSION                            │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤
│ Milestone 1  │ Milestone 2  │ Milestone 3  │ Milestone 4  │ Milestone 5     │
│ Core Message │ Computer     │ Multimodal   │ Programmatic │ Publisher       │
│ Broker & API │ Vision       │ Cloud AI &   │ Remotion     │ Worker & Disk   │
│ Gateway      │ Slicer       │ TTS Sync     │ Compositor   │ Housekeeper     │
│  [COMPLETE]  │  [COMPLETE]  │  [COMPLETE]  │  [COMPLETE]  │  [IN PROGRESS]  │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────────┘
```

### 📦 Completed System Architecture

1. **Milestone 1: Core Message Broker & API Gateway**
   - **Express API Gateway** (`apps/api-gateway`): Receives video captures, validates payloads via **Zod**, records metadata in PostgreSQL via **Prisma ORM**, and manages real-time status.
   - **Task Broker (BullMQ/Redis)**: Coordinates job handoffs asynchronously across five queues.
   - **PM2 Orchestration** (`ecosystem.config.js`): Configured to run all worker services in a unified local runtime background loop.

2. **Milestone 2: Computer Vision Slicer Worker**
   - **CV Slicer Worker** (`apps/cv-slicer-worker`): Runs a local Python virtual environment.
   - **OpenCV template matcher**: Recognizes the "Kill Skull" graphical HUD element on 1080p widescreen gameplay.
   - **FFmpeg subprocessor**: Trims raw clips to 15–45s climax segments and extracts exactly 5 highlight keyframe JPEGs.

3. **Milestone 3: Multimodal Cloud AI & TTS Sync**
   - **Cloud AI Worker** (`apps/cloud-ai-worker`): Sends highlight keyframes and metadata to the **Google Gemini 1.5 Flash API** using structured JSON schema constraints to write click-optimized titles, video descriptions, and a high-impact voice commentary script.
   - **TTS Voice Worker** (`apps/tts-voice-worker`): Invokes a Python subprocess calling **Microsoft Edge-TTS** (or ElevenLabs) to synthesize natural-sounding speech MP3s, capturing exact word-boundary timing offsets (timestamps).

4. **Milestone 4: Programmatic Remotion Compositor**
   - **Remotion Video Workspace** (`apps/video-render-worker`): Configured on a strict vertical 9:16 portrait viewport (1080x1920 at 60fps).
   - **Visual Crop Component** (`Composition.tsx`): Centers widescreen clips around the player's crosshair using custom scaling and blurring.
   - **Subtitle Component**: Plays frame-accurate, spring-physics-animated words with custom drop shadows that scale exactly when spoken.
   - **Audio Ducking Mixer**: Intelligently scales instrumental background music down to 8% volume during speech segments and up to 35% during vocal pauses.
   - **Worker Coordinator** (`worker.ts`): Listens on `video-render-queue` with a concurrency throttle of 1 to protect local GPU resources from thrashing.

---

## 🧪 Part 2: Phase 4 Local PC Testing Guide

This guide walks you through running the exact verification scripts and visual studio for **Phase 4 (Programmatic Remotion Compositor)** on your local PC.

### 1. Prerequisites (Database & Cache Services)
Ensure local PostgreSQL and Redis servers are running:
```bash
# Check Redis status (default port 6379)
sudo service redis-server status || sudo service redis-server start

# Check PostgreSQL status (default port 5432)
sudo service postgresql status || sudo service postgresql start
```

### 2. Prepare Databases and Build Clients
From the root workspace folder, run pnpm install, migrate your schema, and compile:
```bash
# Install dependencies
npx pnpm install

# Deploy database migrations to set up the relational tables
export $(cat .env | grep -v '#' | xargs)
npx pnpm --filter @packages/database run prisma:migrate

# Build database client and generate prisma definitions
npx pnpm --filter @packages/database run build
```

### 3. Run Automated Remotion Workspace Checks (Task 4.1 & 4.2)
This checks file layouts, portrait canvas definitions (1080x1920 at 60fps), and subtitle scaling components:
```bash
export $(cat .env | grep -v '#' | xargs)
./apps/video-render-worker/node_modules/.bin/ts-node --transpile-only -O '{"module": "commonjs", "moduleResolution": "node"}' scripts/verify_remotion_workspace.ts
```
> [!NOTE]
> Expected Output: `🎉 ALL TASK 4.1 REMOTION SCAFFOLDING TESTS PASSED SUCCESSFULLY! 🎉`

### 4. Run Automated Worker Coordination Checks (Task 4.3)
This creates a mock job, seeds mock visual and voice tracks on disk, enqueues a render task to BullMQ, starts the worker to compile the video (using `RENDER_MOCK_MODE` to verify execution structure), asserts parent state transitions to `VIDEO_COMPLETED`, and verifies subsequent enqueuing into `publishing-queue`:
```bash
export $(cat .env | grep -v '#' | xargs)
NODE_PATH=./apps/video-render-worker/node_modules ./apps/video-render-worker/node_modules/.bin/ts-node --transpile-only -O '{"module": "commonjs", "moduleResolution": "node"}' scripts/verify_video_render_worker.ts
```
> [!NOTE]
> Expected Output: `🎉 ALL TASK 4.3 REMOTION COORDINATION WORKER TESTS PASSED SUCCESSFULLY! 🎉`

### 5. Start the Interactive Remotion Studio (Visual Preview Playground)
To manually edit, preview, and play around with the 9:16 crop, spring-zoom subtitle animations, or audio mixer peaks in real-time, run the visual Remotion Studio:
```bash
npx pnpm --filter @apps/video-render-worker run dev
```
- Open `http://localhost:3000` in your web browser.
- Select `ValorantShort` to interact frame-by-frame with active overlays, crosshair zoom, and audio ducking tracks!

---

## 🛠️ Part 3: Production Readiness Checklist

To transition your system from a simulated sandbox ("mock mode") to a fully automated pipeline running on your PC with real video uploads, you must prepare the following accounts and environment configurations:

### 🎥 1. YouTube & Google Developer API Setup (For Milestone 5 Publishing)

The publishing worker uploads vertical Shorts using rotating OAuth2 credentials. Follow these steps to obtain your client credentials:

1. **Create Google Cloud Project**:
   - Visit the [Google Cloud Console](https://console.cloud.google.com/).
   - Click **Create Project** and name it (e.g., `Valorant AI Automation`).
2. **Enable YouTube Data API v3**:
   - Go to the API Library in your Cloud Console.
   - Search for **YouTube Data API v3** and click **Enable**.
3. **Configure OAuth Consent Screen**:
   - Go to **APIs & Services > OAuth consent screen**.
   - Select User Type: **External** and click Create.
   - Fill out App name, user support email, and developer contact info.
   - Add the scopes: `.../auth/youtube.upload` and `.../auth/youtube.readonly`.
   - **CRITICAL**: Add your uploading Google/YouTube account as a **Test User** (since the app will remain in "Testing" publishing status).
4. **Create OAuth 2.0 Credentials**:
   - Go to **APIs & Services > Credentials**.
   - Click **+ Create Credentials > OAuth client ID**.
   - Select Application type: **Desktop app**.
   - Name it (e.g., `Valo Uploader Local`) and click Create.
   - Download the client secrets JSON. Rename it to `client_secrets.json` and store it in `apps/youtube-publisher-worker/` or as instructed in your OAuth utility scripts.
5. **Get YouTube Refresh Token**:
   - Run your OAuth authenticator script (e.g., `scripts/auth-youtube.js`) to launch a local server.
   - Authenticate in the browser using your YouTube channel account.
   - Copy the acquired **Refresh Token** and save it securely in your `.env` or PostgreSQL store for token rotation.

---

### 🧠 2. Google Gemini API Key Setup (For Milestone 3 Visual Copywriting)

The cloud AI worker requires a Gemini API key to base64-encode your keyframes and generate narrative scripts.

1. **Acquire API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/).
   - Click **Get API Key** and create a key in your project.
2. **Update Environment**:
   - In your `.env` file in the root directory, replace the mock value with your actual key:
     ```bash
     GEMINI_API_KEY="AIzaSyYourActualGeminiAPIKeyHere"
     ```

---

### ⚙️ 3. Full Production `.env` Variable Schema

Ensure your `.env` file contains all necessary configuration keys, fully validated at runtime:

```bash
# PostgreSQL State Database Connection String
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/state_db?connection_limit=5&pool_timeout=10"

# Redis Queue Connection String
REDIS_URL="redis://127.0.0.1:6379"

# Google Gemini API Key
GEMINI_API_KEY="AIzaSyYourActualGeminiAPIKeyHere"

# Rendering Mode (Set to false in production to compile real vertical MP4s via GPU)
RENDER_MOCK_MODE=false

# YouTube API Credentials (or load directly from database config records)
YOUTUBE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
YOUTUBE_CLIENT_SECRET="GOCSPX-yourclientsecret"
YOUTUBE_REFRESH_TOKEN="1//0yourrefreshtoken..."
```

---

### 🖥️ 4. Local System Runtime Prerequisites

Because this is a **local-first hybrid system**, you must have the following system packages installed on your Windows host (or WSL2) to support heavy media encoding:

| Dependency | Required Version | Purpose |
| :--- | :--- | :--- |
| **Node.js** | v18.0.0+ | Serves API gateway, queues, and compiles Remotion React timelines. |
| **pnpm** | v9.0.0+ | Performs monorepo package workspace locking. |
| **Python** | v3.10+ | Powers template matching inside OpenCV and downloads Edge-TTS audio. |
| **FFmpeg** | v6.0+ | Decodes raw widescreen gameplay and re-encodes vertical Shorts. |
| **PostgreSQL** | v15.0+ | Preserves state transitions and logs across all 5 queues. |
| **Redis** | v6.0+ | Governs tasks scheduling and event delivery backpressure. |
| **OBS Studio / Capture** | Any | Automates local gameplay recording, dropping raw MP4s to `storage/captures/`. |
