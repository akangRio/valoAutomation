# Task Breakdown: Valorant AI Content Automation

This document outlines the granular engineering tasks required to build the **Valorant AI Content Automation** pipeline. Tasks are organized under their respective Milestones and designed to be completed in sequence.

---

## Milestone 1: The Observer (Ingestion & Database Core)

### Task 1.1: Initialize Monorepo and Workspace Structures
- **Objective**: Set up the project workspaces, base `package.json` configurations, TypeScript paths, and compile scripts.
- **Dependencies**: None.
- **Estimated Complexity**: Low.
- **Affected Services**: All (Monorepo scaffolding).
- **Acceptance Criteria**:
  - Root `package.json` successfully registers `apps/*` and `packages/*` workspaces.
  - Base `tsconfig.json` compiles without warnings.
  - Git repository exists with `.gitignore` excluding `storage/` and `venv/` directories.

---

### Task 1.2: Implement SQLite Schema and Client Configuration
- **Objective**: Create the shared database client package, establish table schemas, indexes, and write transactional migration hooks.
- **Dependencies**: Task 1.1.
- **Estimated Complexity**: Low.
- **Affected Services**: `packages/database`, `apps/orchestrator`.
- **Acceptance Criteria**:
  - Database helper correctly loads environment config schema.
  - Initializes a new `state.db` on launch if not present.
  - Runs SQLite in `WAL` journal mode with a `busy_timeout` of 5000ms.
  - Successfully registers `jobs` and `highlights` tables with corresponding indexes.

---

### Task 1.3: Implement Capture Monitor Service
- **Objective**: Watch the configured recordings directory, verify complete video file writes, and register new jobs in the database.
- **Dependencies**: Task 1.2.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/capture-monitor`, `packages/database`.
- **Acceptance Criteria**:
  - Launches background process watching the `/storage/captures/` folder using `chokidar`.
  - Implements a stability check (assures file size is static for 5 seconds before processing) to ensure OBS has completed writing.
  - Writes a new entry into `jobs` table with `status = 'CAPTURE_DETECTED'` and the absolute local path.
  - Unit tests mock filesystem additions and verify database insert events.

---

### Task 1.4: Implement Orchestrator Core Poller
- **Objective**: Implement the central state poller loop that picks up jobs sequentially and manages pipeline lifecycles.
- **Dependencies**: Task 1.3.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/orchestrator`, `packages/database`.
- **Acceptance Criteria**:
  - Runs a resilient 10-second polling interval.
  - Queries SQLite DB for `CAPTURE_DETECTED` jobs.
  - Implements strict concurrency control (processes exactly 1 active job at a time).
  - Automatically resets stale jobs stuck in active states upon orchestrator restart.

---

## Milestone 2: The Slicer (Local Computer Vision)

### Task 2.1: Set Up Python Virtual Environment and OpenCV Bindings
- **Objective**: Set up Python 3.10+ execution structure inside the monorepo, including a local virtual environment and package installation.
- **Dependencies**: Task 1.1.
- **Estimated Complexity**: Low.
- **Affected Services**: `apps/cv-parser`.
- **Acceptance Criteria**:
  - Python virtual environment is successfully provisioned inside `/apps/cv-parser/venv`.
  - Dependencies (`opencv-python`, `numpy`) install cleanly.
  - Python script can be executed locally from a shell.

---

### Task 2.2: Implement OpenCV Template-Matching Engine for Kill Skull Detection
- **Objective**: Analyze raw footage frames using template matching to detect Valorant "Kill Skull" overlays and record timestamps.
- **Dependencies**: Task 2.1.
- **Estimated Complexity**: High.
- **Affected Services**: `apps/cv-parser`.
- **Acceptance Criteria**:
  - Detects the red/gold "Kill Skull" overlay image template in test-video frames.
  - Leverages localized bounding regions (ROI) to avoid full-frame scanning and optimize frame-rates.
  - Records and logs exact highlight events (kill timestamp, match score timeline) to `stdout`.

---

### Task 2.3: Implement Highlight Trimming and Keyframe Extraction using FFmpeg
- **Objective**: Segment the raw video around recorded highlight events and export static high-action keyframe images.
- **Dependencies**: Task 2.2.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/cv-parser`.
- **Acceptance Criteria**:
  - Slices raw footage to extract a vertical-friendly highlight clip (15-45s segment).
  - Captures exactly 5 keyframe JPEGs representing peak action moments (e.g., final kill, scoreboard banner).
  - Saves all sliced output media cleanly under `/storage/highlights/` and `/storage/keyframes/`.

---

### Task 2.4: Integrate OpenCV Parser with Orchestrator Child Process Executor
- **Objective**: Wire up the orchestrator to execute the Python CV parser as a shell child process and log outcomes.
- **Dependencies**: Task 1.4, Task 2.3.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/orchestrator`, `apps/cv-parser`.
- **Acceptance Criteria**:
  - Orchestrator spawns the Python CV child process when picking up a `CAPTURE_DETECTED` job.
  - Transitions job state: `CAPTURE_DETECTED` -> `CV_PARSING` -> `CV_PARSED`.
  - Correctly populates the database fields for `highlight_video_path` and `keyframes_dir`.
  - Captures any script-level crash or timeout, moving the job to `FAILED` and logging the stack trace in the database.

---

## Milestone 3: The Storyteller (AI & Voice Sync)

### Task 3.1: Implement Gemini 1.5 Multimodal API Connector
- **Objective**: Develop the API interface connecting local keyframes and metadata to Gemini to formulate titles, tags, descriptions, and narration scripts.
- **Dependencies**: Task 1.4, Task 2.4.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/cloud-analyzer`, `apps/orchestrator`.
- **Acceptance Criteria**:
  - Successfully initializes `@google/genai` with validated `.env` API keys.
  - Converts keyframe JPEG files to Base64 and builds a multimodal payload.
  - Enforces the strict JSON response schema outlined in `API_CONTRACTS.md` using Gemini's native schema parameters.
  - Safely saves the stringified JSON metadata response back to the SQLite DB under `cloud_metadata_json`.

---

### Task 3.2: Implement TTS Synthesis Engine with Word-Timestamp Extraction
- **Objective**: Convert generated narration scripts into spoken audio files while exporting exact word-level timings.
- **Dependencies**: Task 3.1.
- **Estimated Complexity**: High.
- **Affected Services**: `apps/tts-generator`.
- **Acceptance Criteria**:
  - Integrates either Microsoft Edge-TTS or ElevenLabs.
  - Generates a high-quality voiceover MP3 saved to `/storage/temp_audio/`.
  - Extracts and formats word boundary offsets into the JSON timestamp structure defined in `API_CONTRACTS.md`.
  - Saves the audio path and word-aligned JSON array to the database.

---

### Task 3.3: Integrate Storyteller Modules into Orchestrator Flow
- **Objective**: Chain Gemini metadata generation and TTS audio sync into the orchestrator state transitions.
- **Dependencies**: Task 3.1, Task 3.2.
- **Estimated Complexity**: Low.
- **Affected Services**: `apps/orchestrator`.
- **Acceptance Criteria**:
  - Orchestrator picks up `CV_PARSED` jobs and runs the `cloud-analyzer` API pipeline (`status = 'CLOUD_ANALYZING'`).
  - Automatically routes the script output into the `tts-generator` module (`status = 'TTS_GENERATING'`).
  - Transitions jobs to `TTS_GENERATED` on complete audio and timing file generation.

---

## Milestone 4: The Editor (Programmatic Composition)

### Task 4.1: Initialize Remotion Project and Core 9:16 Video Layout
- **Objective**: Scaffolding the React-based Remotion video editing configuration and framing player perspectives.
- **Dependencies**: Task 1.1.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/video-renderer`.
- **Acceptance Criteria**:
  - Initializes Remotion cleanly in `/apps/video-renderer`.
  - Defines a 9:16 portrait composition template (e.g., 1080x1920 at 60fps).
  - Implements dynamic scaling/cropping to zoom into the player's crosshair (screen center).
  - Local browser preview (`npx remotion preview`) opens and displays test-video.

---

### Task 4.2: Implement Dynamic Subtitle Component
- **Objective**: Create a word-by-word React caption layout that updates active styles dynamically based on TTS timestamps.
- **Dependencies**: Task 4.1, Task 3.2.
- **Estimated Complexity**: High.
- **Affected Services**: `apps/video-renderer`.
- **Acceptance Criteria**:
  - Subtitle component parses the `WordTimestamp[]` structure.
  - Renders spoken text word-by-word, highlight-coloring active words (e.g., yellow) and applying subtle animations (e.g., pop/bounce scale).
  - Text animations sync perfectly with TTS MP3 voice execution inside the Remotion preview timeline.

---

### Task 4.3: Implement HUD Graphics Overlays & Audio Ducking Mixer
- **Objective**: Scale up key game graphics (killfeed, round banner) and mix background music, ducking audio when spoken voices spike.
- **Dependencies**: Task 4.2.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/video-renderer`.
- **Acceptance Criteria**:
  - Places HUD element replicas at the top/bottom margins of the vertical canvas.
  - Embeds background royalty-free audio tracks.
  - Implements dynamic volume mixing: decreases (ducks) background music volume during ranges when the voiceover is active (determined by timestamp ranges).

---

### Task 4.4: Integrate Video Renderer with Orchestrator Flow
- **Objective**: Enable the orchestrator to execute Remotion compilation as a local shell command and monitor render streams.
- **Dependencies**: Task 3.3, Task 4.3.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/orchestrator`, `apps/video-renderer`.
- **Acceptance Criteria**:
  - Orchestrator triggers `npx remotion render` as a child process when a job reaches `TTS_GENERATED`.
  - Feeds required state values to Remotion via CLI `--props` JSON arguments.
  - Saves the compiled portrait video to `/storage/output/{job_id}.mp4`.
  - Transitions job status from `VIDEO_RENDERING` to `VIDEO_RENDERED` upon successful compilation.

---

## Milestone 5: The Broadcaster (Publishing & Housekeeping)

### Task 5.1: Implement YouTube OAuth Authentication and Uploader
- **Objective**: Establish the OAuth2 authentication routine and upload rendered shorts securely with Gemini metadata.
- **Dependencies**: Task 1.4, Task 4.4.
- **Estimated Complexity**: Medium.
- **Affected Services**: `apps/youtube-publisher`.
- **Acceptance Criteria**:
  - Script securely loads credentials and retrieves access tokens via locally-saved rotating refresh tokens.
  - Leverages the official Google API Client to upload videos.
  - Configures uploaded Shorts with Gemini-generated metadata (SEO tags, descriptions, titles).
  - Schedules publishing time daily based on user configurations.
  - Populates the database `youtube_video_id` on success and transitions the job to `COMPLETED`.

---

### Task 5.2: Implement Local Media Housekeeper
- **Objective**: Manage local PC disk storage health by purging oversized, raw videos and temp assets once processed.
- **Dependencies**: Task 5.1.
- **Estimated Complexity**: Low.
- **Affected Services**: `apps/orchestrator`.
- **Acceptance Criteria**:
  - Implements disk scans on a weekly/daily cadence or immediately upon job completion.
  - Safely deletes raw video assets from `/storage/captures/` and trimmed highlights from `/storage/highlights/` for jobs marked `COMPLETED` that are older than a 5-day retention threshold.
  - Retains history entries in the database to prevent duplicate file uploads.

---

### Task 5.3: Perform End-to-End Pipeline Validation and Error Recovery Testing
- **Objective**: Execute continuous operational checks, failure recoveries, and liveness validations.
- **Dependencies**: All previous tasks.
- **Estimated Complexity**: High.
- **Affected Services**: All services.
- **Acceptance Criteria**:
  - Successfully handles end-to-end processing: dropping an OBS raw clip into `/captures/` triggers full CV parsing, Gemini metadata formulation, TTS sync, Remotion rendering, and scheduling to YouTube with zero human clicks.
  - Validates error recoveries (e.g., API server outage during `cloud_analyzing` increments retry counts; consecutive failures trigger graceful halts and log error traces to SQLite `error_log`).
  - Successfully performs a continuous 3-day liveness simulation with test-footage without leaks or performance degradation.
