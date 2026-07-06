# Services Specification: Valorant AI Content Automation

This document provides detailed specifications for each independent service in the **Valorant AI Content Automation** local monorepo.

---

## 1. Orchestrator Service (`/apps/orchestrator`)

The Core brain of the pipeline. It implements a sequential polling state-machine that transitions jobs through the pipeline via SQLite.

- **Type**: Background daemon (Node.js/TypeScript).
- **Trigger**: Starts on boot, runs continuously, polling the SQLite database every 10 seconds.
- **Responsibilities**:
  - Monitors the SQLite DB for jobs with statuses that require action.
  - Spawns local child processes (`cv-parser`, `video-renderer`) or executes internal modules (`cloud-analyzer`, `tts-generator`, `youtube-publisher`).
  - Manages timeouts (e.g., if rendering takes > 20 mins, mark as failed).
  - Handles process failures, catches exceptions, and logs them to the job's database row.
  - Controls concurrency (strictly concurrency = 1 for heavy tasks).
- **Environment Variables**:
  - `DB_PATH`: Absolute path to `state.db`.
  - `POLL_INTERVAL_MS`: Duration between DB checks (default: `10000`).
  - `MAX_JOB_RETRIES`: Number of retry attempts for failed jobs (default: `2`).

---

## 2. Capture Monitor (`/apps/capture-monitor`)

A lightweight filesystem observer that registers newly recorded video game-clips.

- **Type**: Background daemon (Node.js/TypeScript).
- **Trigger**: Runs continuously, watching a local Windows directory using `chokidar`.
- **Responsibilities**:
  - Detects when a new `.mp4` or `.mkv` file is created in the configured captures folder.
  - Waits until the file is fully written and unlocked (verifies file size doesn't change over a 5-second interval).
  - Inserts a new row into the SQLite database with `CAPTURE_DETECTED` status and the absolute path of the video.
- **Environment Variables**:
  - `DB_PATH`: Path to `state.db`.
  - `CAPTURES_DIR`: Path to OBS/Shadowplay clips directory (e.g., `C:/Videos/ValorantCaptures`).
  - `STABILITY_CHECK_MS`: Time to wait to verify file is written (default: `5000`).

---

## 3. Computer Vision Parser (`/apps/cv-parser`)

The local highlight detector. Avoids sending long videos to the cloud by executing zero-cost OpenCV parsing locally.

- **Type**: CLI script (Python 3.10+).
- **Trigger**: Spawned as a child process by the Orchestrator.
- **Inputs**:
  - Raw video path.
- **Outputs**:
  - Path of sliced highlight clip.
  - Array of extracted keyframe images (JPEG).
  - Metadata text (Map name, Score, Kills detected).
- **Responsibilities**:
  - Opens the video file frame-by-frame.
  - Uses OpenCV Template Matching to detect the **Kill Skull Icon** overlay at the bottom-center of the screen.
  - Detects consecutive kills (multi-kills) based on timestamps.
  - Identifies the maximum-action segment (e.g., a 4-kill clutch sequence).
  - Trim/slice the video using local FFmpeg to a vertical-friendly duration (typically 20-40 seconds).
  - Extract exactly 5 keyframes (e.g., at round-win announcement, final kill skull display, score transition) to assist Gemini analysis.
- **Environment Variables**:
  - `CV_CONFIDENCE_THRESHOLD`: Matching precision index (default: `0.85`).
  - `OUTPUT_DIR`: Path to save highlight clips and keyframes.

---

## 4. Cloud Analyzer (`/apps/cloud-analyzer`)

Connects to Google Cloud/Gemini to perform high-level gameplay understanding and creative copy generation.

- **Type**: Node.js/TypeScript module.
- **Trigger**: Executed by the Orchestrator.
- **Inputs**:
  - Sliced highlight video path.
  - List of extracted keyframe image paths.
  - Gameplay metadata from the CV Parser.
- **Outputs**:
  - Structured JSON: Voiceover script, YouTube title, tags, description, overlay text captions, and theme styling recommendations.
- **Responsibilities**:
  - Packages the keyframes, metadata, and specialized prompt into a single request.
  - Sends the request to **Gemini 1.5 Flash API** using the `@google/genai` library.
  - Leverages structured output schemas to force Gemini to return exactly the required JSON contract.
- **Environment Variables**:
  - `GEMINI_API_KEY`: API key for Gemini.
  - `GEMINI_MODEL`: Model name (default: `gemini-1.5-flash`).

---

## 5. TTS Generator (`/apps/tts-generator`)

Generates the commentary audio track and extracts word-timestamp alignments.

- **Type**: Node.js/TypeScript module.
- **Trigger**: Executed by the Orchestrator.
- **Inputs**:
  - Voiceover script text.
- **Outputs**:
  - Voiceover MP3 path.
  - Word timestamps JSON array (each word mapped to its start/end milliseconds).
- **Responsibilities**:
  - Connects to ElevenLabs API or runs local `edge-tts`.
  - Sends the Gemini script and returns the synthesized MP3 audio.
  - Extracts word alignment timestamps (e.g., ElevenLabs supports `websocket` and REST-based alignment endpoints; `edge-tts` provides local tokenized word offsets).
  - Saves the audio file to `/temp_audio/` and timestamps to the database.
- **Environment Variables**:
  - `TTS_PROVIDER`: `elevenlabs` or `edge-tts` (default: `edge-tts` for cost-free run).
  - `ELEVEN_LABS_API_KEY`: ElevenLabs key (if provider is elevenlabs).
  - `TTS_VOICE_ID`: Target voice model.

---

## 6. Video Renderer (`/apps/video-renderer`)

Programmatically composites and compiles the final 9:16 vertical MP4 video using Remotion and React.

- **Type**: React/TypeScript WebGL composition, compiled via Remotion CLI.
- **Trigger**: Spawned as a child process by the Orchestrator.
- **Inputs**:
  - Highlight video path.
  - Voiceover MP3 path.
  - Word timestamps JSON.
  - Visual metadata (Agent, scoreboard).
- **Outputs**:
  - Premium vertical MP4 (`/output/{job_id}.mp4`).
- **Responsibilities**:
  - Crops the input 16:9 gameplay to 9:16 vertical.
  - Tracks player crosshair (default: screen center, or dynamic offset).
  - Captures and overlays scaled-up gameplay UI assets (kill feed, round score).
  - Renders highly stylized, animated, word-by-word subtitles matching the voiceover audio track.
  - Merges original video audio + TTS MP3 + background royalty-free track, applying auto-ducking to the music when voice or game audio spikes.
  - Renders the frame stack to high-quality MP4 using Remotion's multi-core CPU/GPU rendering engine.
- **Environment Variables**:
  - `REMOTION_CONCURRENCY`: Number of CPU cores to assign for rendering (default: `4`).
  - `RENDER_QUALITY`: FFmpeg quality index.

---

## 7. YouTube Publisher (`/apps/youtube-publisher`)

Safely publishes the finished video to YouTube.

- **Type**: Node.js/TypeScript module.
- **Trigger**: Executed by the Orchestrator.
- **Inputs**:
  - Rendered video path (`.mp4`).
  - YouTube Metadata JSON (Title, Description, Tags).
- **Outputs**:
  - Scheduled YouTube Video ID.
- **Responsibilities**:
  - Standardizes the video file upload chunking.
  - Uses the official `googleapis` NPM client.
  - Signs in securely using a stored local refresh token.
  - Uploads the video, setting the title (including `#Shorts`), description, tags, category, and privacy status.
  - Schedules the release time based on the daily queue config (e.g., 10:00 AM local time).
- **Environment Variables**:
  - `YT_CLIENT_ID`: OAuth client ID.
  - `YT_CLIENT_SECRET`: OAuth client secret.
  - `YT_REFRESH_TOKEN`: Secured local refresh token.
  - `YT_PUBLISH_HOUR`: Hour of day to schedule (0-23, default: `10`).
