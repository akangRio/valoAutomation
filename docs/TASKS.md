# Engineering Task Board: Enterprise Event-Driven Pipeline

This document defines the detailed, granular technical task board for implementing the **Valorant AI Content Automation** platform. Developed by the Senior Technical Product Manager, these tasks are structured to prioritize early progress, establish clear service boundaries, and reduce integration risks.

---

## Milestone 1: Core Message Broker & API Gateway

### Task 1.1: Configure Monorepo Scaffolding

- **Objective**: Establish the root monorepo project configurations, TypeScript compiler parameters, and workspace directory links.
- **Dependencies**: None.
- **Estimated Complexity**: Low.
- **Affected Services**: Monorepo workspace configurations.
- **Acceptance Criteria**:
  - Root `package.json` configures workspaces for `/apps/*` and `/packages/*`.
  - Parent `tsconfig.json` compiles cleanly without warnings.
  - Workspace `.gitignore` excludes `/storage/*` media folders and local runtime credentials.

---

### Task 1.2: Implement Prisma PostgreSQL Relational Schema

- **Objective**: Develop the Prisma database package, write relational schema definitions, and deploy migration tables.
- **Dependencies**: Task 1.1.
- **Estimated Complexity**: Medium.
- **Affected Services**: `packages/database`.
- **Acceptance Criteria**:
  - `schema.prisma` successfully defines `Job`, `Highlight`, `VideoMetadata`, `TTSAudioSync`, and `YouTubeUpload` schemas.
  - Executes `prisma migrate dev` cleanly, establishing relational tables and target indexing structures in local PostgreSQL.
  - Auto-generated Prisma client classes compile successfully.

---

### Task 1.3: Implement Express API Gateway and Controllers

- **Objective**: Construct the central Express API Gateway, configure controller routing, and implement Zod validation middleware.
- **Dependencies**: Task 1.2.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/api-gateway`, `packages/database`.
- **Acceptance Criteria**:
  - `POST /api/v1/jobs` parses inbound payloads, performs Zod schema verification checks, and creates pending records in PostgreSQL via Prisma.
  - `GET /api/v1/jobs/:id` successfully returns real-time status and error logs.
  - Includes centralized, JSON-compliant error-catching middleware returning formatted response logs.

---

### Task 1.4: Configure Redis and BullMQ Queue Integration

- **Objective**: Connect the API Gateway to local Redis brokers and develop standard task enqueuing interfaces.
- **Dependencies**: Task 1.3.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/api-gateway`.
- **Acceptance Criteria**:
  - Connects securely to Redis using validated environmental schema variables.
  - Ingestion controller enqueues `CVSlicerJobPayload` items into the `cv-slicer-queue` via BullMQ.
  - API Gateway registers queue monitor endpoints returning real-time payload stats.

---

## Milestone 2: Computer Vision Slicer Worker

### Task 2.1: Establish CV Slicer Worker and Python Virtual Env

- **Objective**: Establish the BullMQ worker structure and provision local Python virtual environments.
- **Dependencies**: Task 1.4.
- **Estimated Complexity**: Low.
- **Affected Services**: `apps/cv-slicer-worker`.
- **Acceptance Criteria**:
  - Worker instantiates, bound to `cv-slicer-queue` in Redis.
  - Python virtual environment is successfully provisioned under `/apps/cv-slicer-worker/venv`.
  - Dependencies (`opencv-python`, `numpy`) install cleanly.

---

### Task 2.2: Implement OpenCV Highlight Detection and Slicing

- **Objective**: Script OpenCV template-matching routines, identify highlight boundaries, and execute clip slicing via local FFmpeg.
- **Dependencies**: Task 2.1.
- **Estimated Complexity**: High.
- **Affected Services**: `apps/cv-slicer-worker`.
- **Acceptance Criteria**:
  - Python parser matches "Kill Skull" game graphics with high precision (confidence > 0.85).
  - Trims raw widescreen clips to 15-45s action frames using FFmpeg.
  - Extracts exactly 5 action keyframe JPEGs and saves them under `/storage/keyframes/`.
  - Writes results back to PostgreSQL via Prisma, and enqueues jobs to `cloud-ai-queue`.

---

## Milestone 3: Multimodal Cloud AI & TTS Sync

### Task 3.1: Implement Gemini Multimodal AI Worker

- **Objective**: Develop the BullMQ worker that dispatches action keyframes and metadata to Gemini to write commentary scripts and titles.
- **Dependencies**: Task 2.2.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/cloud-ai-worker`.
- **Acceptance Criteria**:
  - Worker instantiates, bound to `cloud-ai-queue`.
  - Converts keyframe files to Base64 and executes Google Gemini API calls.
  - Enforces the strict JSON response schema outlined in `API_CONTRACTS.md` using Gemini's native schema constraints.
  - Saves generated scripts and SEO tags to PostgreSQL via Prisma, and enqueues jobs to `tts-voice-queue`.

---

### Task 3.2: Implement TTS Voice Synchronization Worker

- **Objective**: Synthesise commentary voice tracks and compile exact word boundary durations.
- **Dependencies**: Task 3.1.
- **Estimated Complexity**: High.
- **Affected Services**: `apps/tts-voice-worker`.
- **Acceptance Criteria**:
  - Worker instantiates, bound to `tts-voice-queue`.
  - Dispatches narrative text to Microsoft Edge-TTS or ElevenLabs, saving voice MP3s to local storage.
  - Extracts word-level durations (start/end millisecond arrays).
  - Saves timing configurations to a local JSON file under `/storage/` and writes metadata to PostgreSQL via Prisma.

---

## Milestone 4: Programmatic Remotion Compositor

### Task 4.1: Configure Remotion Workspace and 9:16 Crop Timelines

- **Objective**: Initialize the Remotion video editing project and develop vertical perspective crops.
- **Dependencies**: Task 1.1.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/video-render-worker`.
- **Acceptance Criteria**:
  - Remotion cleanly initializes inside `/apps/video-render-worker`.
  - Configures 9:16 portrait canvas metrics (1080x1920 at 60fps).
  - Implements dynamic zoom matrices centering on the player crosshair.

---

### Task 4.2: Implement Synced Subtitle Component and Audio Mixer

- **Objective**: Create animated subtitles that react frame-by-frame to timing JSONs, and mix audio tracks.
- **Dependencies**: Task 4.1, Task 3.2.
- **Estimated Complexity**: High.
- **Affected Services**: `apps/video-render-worker`.
- **Acceptance Criteria**:
  - Subtitle React component parses `WordTimestamp[]` structures.
  - Words scale and highlight-color exactly when spoken in the visual timeline preview.
  - Integrates background music, ducking audio levels during vocal peak segments.

---

### Task 4.3: Implement Remotion Render Worker Coordination

- **Objective**: Bind Remotion compiler commands to BullMQ execution events.
- **Dependencies**: Task 4.2.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/video-render-worker`.
- **Acceptance Criteria**:
  - Worker instantiates, bound to `video-render-queue` with `concurrency: 1` to protect local GPU resources.
  - Compiles portrait compositions to high-definition MP4 files via Remotion's CLI.
  - Saves compiled Shorts under `/storage/output/{jobId}.mp4`.
  - Updates PostgreSQL database status to `VIDEO_COMPLETED` via Prisma and enqueues jobs to `publishing-queue`.

---

## Milestone 5: Publisher Worker & Disk Housekeeper

### Task 5.1: Implement YouTube Publisher Worker

- **Objective**: Develop the YouTube publisher worker utilizing OAuth2 rotating credentials.
- **Dependencies**: Task 4.3.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/youtube-publisher-worker`.
- **Acceptance Criteria**:
  - Worker instantiates, bound to `publishing-queue`.
  - Loads YouTube client credentials and performs token rotation securely using stored refresh tokens.
  - Uploads compiled vertical Shorts with Gemini-generated titles, tags, and descriptions.
  - Schedules publication based on configuration profiles and marks job status as `COMPLETED`.

---

### Task 5.2: Implement Local File Housekeeper

- **Objective**: Programmatically sweep local file directories to preserve disk space.
- **Dependencies**: Task 5.1.
- **Estimated Complexity**: Low.
- **Affected Services**: `apps/api-gateway`, `apps/youtube-publisher-worker`.
- **Acceptance Criteria**:
  - Implements filesystem sweep routines.
  - Deletes raw captures and temporary clips for `COMPLETED` jobs older than a 5-day retention threshold.
  - Preserves database logs and metrics records in PostgreSQL.

---

### Task 5.3: Run End-to-End Platform Integration and Fault-Recovery checks

- **Objective**: Conduct continuous testing cycles, fault injection recoveries, and final liveness validations.
- **Dependencies**: All previous tasks.
- **Estimated Complexity**: High.
- **Affected Services**: All monorepo services.
- **Acceptance Criteria**:
  - End-to-end flow executes flawlessly: raw video drops trigger ingestion, database queue coordination, CV slicing, script composition, TTS vocal syncing, vertical rendering, and scheduled publishing on YouTube with zero human clicks.
  - Successfully handles workers crashes (e.g. killing the rendering worker mid-run results in the job status updating to `FAILED` with explicit error logs, while the BullMQ Redis queue handles failovers).
  - Completes a 72-hour automated test loop without memory leaks or process crashes.
