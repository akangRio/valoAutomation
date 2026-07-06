# 🎮 Valorant AI Content Automation: End-to-End Manual Testing Tutorial

Welcome to the manual testing guide! This tutorial walks you through setting up, booting, triggering, and verifying the entire automated event-driven video editing pipeline. From dropping a raw widescreen Valorant gameplay clip to rendering a vertical TikTok/YouTube Short with spring-animated captions, this document covers everything.

---

## 🏗️ 1. Pipeline Architecture Overview

The system is designed as a **local-first, event-driven microservices monorepo**. Each stage of the pipeline coordinates asynchronously via **BullMQ** (Redis) and persists its state machine transitions inside **PostgreSQL** (Prisma).

```mermaid
flowchart TD
    A["Raw Video Drop"] ──> B["POST /api/v1/jobs"]
    B ──> C[("PostgreSQL (Prisma)")]
    B ── Enqueues ──> D["cv-slicer-queue"]
    
    subgraph "Asynchronous Queue Workers"
        E["CV Slicer Worker"] ── Consumes ──> D
        E ── "Slices & keyframes JPEGs" ──> F["cloud-ai-queue"]
        
        G["Cloud AI Worker"] ── Consumes ──> F
        G ── "Gemini Writes Narration" ──> H["tts-voice-queue"]
        
        I["TTS Voice Worker"] ── Consumes ──> H
        I ── "Synthesizes Sync MP3s" ──> J["video-render-queue"]
        
        K["Video Render Worker"] ── Consumes ──> J
        K ── "Renders Portrait Short" ──> L["publishing-queue"]
    end
    
    E ── Writes ──> C
    G ── Writes ──> C
    I ── Writes ──> C
    K ── Writes ──> C
```

---

## 📦 2. Prerequisites & Environment Check

Before launching the workers, ensure your local environment contains the necessary databases and configurations.

### A. Run Database & Cache Services
Confirm that your local **PostgreSQL** and **Redis** services are online:
```bash
# Check Redis Service Status (should be running on 6379)
sudo systemctl status redis-server

# Check PostgreSQL Service Status (should be running on 5432)
sudo systemctl status postgresql
```

### B. Validate `.env` Configuration
In the root directory, open your `.env` file and verify it contains correct connection strings:
```bash
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/state_db?connection_limit=5&pool_timeout=10"
REDIS_URL="redis://127.0.0.1:6379"
```

### C. Run Database Migrations & Auto-Generation
Ensure your database tables exist and your Prisma client is synchronized with the schema:
```bash
# Run migrations to initialize PostgreSQL schemas
pnpm --filter @packages/database run prisma:migrate

# Generate client files
pnpm --filter @packages/database run build
```

---

## 🛠️ 3. Seed Mock Source Assets

To test the video editing compositor and CV slicer, we need a mock video. If you do not have a raw widescreen clip handy, we will seed mock assets so that you can verify the pipeline end-to-end in **mock simulation mode**.

Run these commands in your terminal to create the directory structures and mock media assets:
```bash
# Ensure storage subdirectories exist
mkdir -p storage/captures storage/highlights storage/voice storage/timestamps storage/output storage/keyframes

# Seed a mock widescreen clip
echo "mock-widescreen-video-bytes" > storage/captures/sample_gameplay.mp4

# Seed a mock vocal audio sync
echo "mock-audio-bytes" > storage/voice/sample_voiceover.mp3

# Seed a mock syllable timing array
cat <<EOT > storage/timestamps/sample_timestamps.json
[
  { "word": "VALORANT", "startMs": 100, "endMs": 600 },
  { "word": "FOUR", "startMs": 610, "endMs": 1000 },
  { "word": "KILL", "startMs": 1010, "endMs": 1400 },
  { "word": "CLUTCH", "startMs": 1410, "endMs": 2000 }
]
EOT
```

---

## 🚀 4. Boot Up the Monorepo Platform

Open **five separate terminal windows** (or use a terminal multiplexer like `tmux`) to run each microservice. Running them separately allows you to monitor their beautifully formatted, structured JSON logs in real-time.

### Terminal 1: Express API Gateway
```bash
export $(cat .env | grep -v '#' | xargs)
pnpm --filter @apps/api-gateway run dev
```
*Expected Log:* `{"timestamp":"...","level":"info","message":"API Gateway listening on port 3000"}`

### Terminal 2: Computer Vision Slicer Worker
Ensure your python virtual environment is initialized and run:
```bash
export $(cat .env | grep -v '#' | xargs)
pnpm --filter @apps/cv-slicer-worker run dev
```
*Expected Log:* `{"timestamp":"...","level":"info","message":"CV Slicer Worker bootstrap complete, listening to cv-slicer-queue"}`

### Terminal 3: Cloud AI Worker
Ensure your `GEMINI_API_KEY` is loaded in `.env` if you want real visual synthesis, or run in standard execution mode:
```bash
export $(cat .env | grep -v '#' | xargs)
pnpm --filter @apps/cloud-ai-worker run dev
```
*Expected Log:* `{"timestamp":"...","level":"info","message":"Cloud AI Worker bootstrap complete, listening to cloud-ai-queue"}`

### Terminal 4: TTS Voice Worker
```bash
export $(cat .env | grep -v '#' | xargs)
pnpm --filter @apps/tts-voice-worker run dev
```
*Expected Log:* `{"timestamp":"...","level":"info","message":"TTS Voice Worker bootstrap complete, listening to tts-voice-queue"}`

### Terminal 5: Video Render Worker
```bash
export $(cat .env | grep -v '#' | xargs)
# Set mock mode to avoid heavy GPU rendering during quick verification, or omit it to run a full Remotion compilation!
export RENDER_MOCK_MODE=true 
pnpm --filter @apps/video-render-worker run start
```
*Expected Log:* `{"timestamp":"...","level":"info","message":"Video Render Worker bootstrap complete, listening to video-render-queue"}`

---

## 📈 5. Trigger the End-to-End Pipeline

With all workers listening, let's trigger a job and watch it flow through the pipeline!

### A. Dispatch the Post Request
In another terminal, run this `curl` command to drop the seeded mock video into the API Gateway:
```bash
curl -X POST http://localhost:3000/api/v1/jobs \
  -H "Content-Type: application/json" \
  -d '{
    "rawVideoPath": "storage/captures/sample_gameplay.mp4"
  }'
```
*Expected Response:*
```json
{
  "success": true,
  "jobId": "cb3cda2e-b0d9-44f3-a534-e984fd01af50",
  "status": "PENDING",
  "currentStep": "INIT"
}
```

### B. Watch the Event-Driven Flow
Observe your terminals in sequence. You will see the event trigger transitions automatically:
1. **CV Slicer** consumes the job, trims the video, saves mock climax JPEGs under `storage/keyframes/`, updates PostgreSQL status to `CV_COMPLETED`, and enqueues to `cloud-ai-queue`.
2. **Cloud AI** consumes the job, base64-encodes JPEGs, requests captions, suggested title, descriptions from Gemini, writes records, updates status to `CLOUD_COMPLETED`, and enqueues to `tts-voice-queue`.
3. **TTS Voice Worker** parses scripts, invokes Edge-TTS subprocess, saves localized vocal MP3s, maps precise syllable boundaries, updates status to `TTS_COMPLETED`, and enqueues to `video-render-queue`.
4. **Video Render Worker** compiles props, invokes the Remotion CLI (or simulates in mock mode), generates the portrait `.mp4` file, saves it under `storage/output/{jobId}.mp4`, and updates status to `VIDEO_COMPLETED`.

---

## 🔎 6. Verify and Monitor Database State Transitions

While the pipeline is running (or after it finishes), you can check the real-time status of your job using two methods:

### Method A: REST API Checking
Retrieve status and error logs for your specific job:
```bash
# Query the API Gateway using your Job ID
curl http://localhost:3000/api/v1/jobs/YOUR_JOB_ID_HERE
```

### Method B: Prisma Studio (Recommended)
Open a beautiful, interactive relational GUI to view your PostgreSQL tables and relationships:
```bash
# Run Prisma Studio in a new terminal
pnpm --filter @packages/database exec prisma studio
```
Navigate to `http://localhost:5555` in your browser to inspect real-time relational maps across `Job`, `Highlight`, `VideoMetadata`, and `TTSAudioSync` tables.

---

## 🖼️ 7. Locate and Preview Your Assets

### Physical Artifact Directory Structure
On successful compilation, you will find all your processed visual and vocal assets saved under `/storage/`:
- **Raw Captures**: `storage/captures/`
- **Slicing Keyframes**: `storage/keyframes/` (5 JPEGs)
- **Vocal MP3 Tracks**: `storage/voice/`
- **Timings JSON Mapping**: `storage/timestamps/`
- **Final portrait shorts**: `storage/output/{jobId}.mp4`

### Interactive Remotion Preview Studio
If you want to manually edit, customize, or preview your vertical Shorts composition with full hot-reload rendering, you can boot Remotion's visual playground:
```bash
pnpm --filter @apps/video-render-worker run dev
```
Open `http://localhost:3000` in your web browser. You can click on the `ValorantShort` timeline preview, inspect the spring-zoom captions, toggle HUD scales, and play vocal ducking intervals frame-by-frame!

---

## 🔧 8. Useful Housekeeping Commands

When you need to clean up and reset your dev system back to zero, use these CLI commands:

* **Flush Redis Queues**: `redis-cli flushall`
* **Prisine DB Wipe & Reset**: `pnpm --filter @packages/database exec prisma migrate reset --force`
* **Check Queue Stats**: 
  ```bash
  curl http://localhost:3000/api/v1/queues/status
  ```
  *(Returns current waiting/active jobs across all five queues: `cv-slicer-queue`, `cloud-ai-queue`, `tts-voice-queue`, `video-render-queue`, `publishing-queue`)*

---

### 🎉 Happy Manual Testing! Your pipeline is fully optimized and ready to rock. 🎉
