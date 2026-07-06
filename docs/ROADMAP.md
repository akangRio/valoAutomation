# Project Roadmap: Valorant AI Content Automation

This document outlines the step-by-step phased rollout for the **Valorant AI Content Automation** pipeline. It is designed to prioritize early validation of core mechanics before building more complex features, ensuring a functional end-to-end system can be tested as early as possible.

---

## Phased Rollout Overview

We break down development into 6 core phases, targeting a fully automated, production-ready system in 6-8 weeks of development by AI coding agents.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                               DEVELOPMENT PHASES                            │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤
│ Phase 1      │ Phase 2      │ Phase 3      │ Phase 4      │ Phase 5 & 6     │
│ Core &       │ CV Highlight │ Cloud AI &   │ Remotion     │ Orchestration   │
│ Capture      │ Parsing      │ Voiceover    │ Rendering    │ & Automation    │
│ (Week 1)     │ (Week 2)     │ (Week 3)     │ (Week 4)     │ (Week 5-6)      │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────────┘
```

---

## Detailed Phases

### Phase 1: Core Foundation & Capture Monitor (Week 1)
**Goal**: Establish the local monorepo, database schema, and directory watcher.
- [ ] Initialize the Git repository and folder structures (as defined in `FOLDER_STRUCTURE.md`).
- [ ] Set up the local SQLite database schema and database client using Node.js and `better-sqlite3`.
- [ ] Implement `capture-monitor` using `chokidar` (Node.js) to watch the raw recordings folder and handle file creation/lock states.
- [ ] Write integration tests for directory scanning and DB job creation.
- **Milestone 1**: Dropping an MP4 file into the raw recordings directory automatically creates a row in the SQLite database with `CAPTURE_DETECTED` status.

### Phase 2: OpenCV Highlight Parser (Week 2)
**Goal**: Build the local highlight extraction script using Python and OpenCV.
- [ ] Set up the local Python virtual environment and dependencies (`opencv-python`, `numpy`).
- [ ] Implement UI template matching in Python to detect:
  - Game kills (kill icon/skull).
  - Multi-kills (consecutive kills within 10 seconds).
  - Round end banners (victory/defeat).
- [ ] Implement video trimming and slicing using `FFmpeg` or OpenCV to extract high-yield clips (15-45s) around detected highlights.
- [ ] Write keyframe extractor (capturing 5-10 JPEG images representing peak action frames).
- **Milestone 2**: Dropping a full-length match recording generates a trimmed `.mp4` highlight file and a folder of JPEG keyframes with timestamps in under 2 minutes.

### Phase 3: Cloud AI & Voiceover (Week 3)
**Goal**: Connect to Gemini and generate voiceover audio with synchronized word-timestamps.
- [ ] Implement `cloud-analyzer` Node.js service:
  - Initialize the `@google/genai` client.
  - Send keyframes and gameplay metadata (agent, map, score) with a specialized system prompt.
  - Validate Gemini's structured JSON output (title, script, descriptions) using `zod`.
- [ ] Implement `tts-generator` Node.js service:
  - Integrate with a lightweight TTS engine (e.g., ElevenLabs API or local Edge-TTS).
  - Generate the voiceover MP3.
  - Extract exact **word-level timestamps** from the TTS engine output.
- **Milestone 3**: An input highlight clip produces a structured JSON metadata block, a voiceover MP3 file, and a word-timestamp alignment JSON.

### Phase 4: Remotion Video Rendering (Week 4)
**Goal**: Build the vertical React-based Remotion video template and local renderer.
- [ ] Initialize the Remotion project in `/apps/video-renderer/`.
- [ ] Implement vertical cropping logic (9:16 aspect ratio), centering on the player crosshair.
- [ ] Implement dynamic gameplay UI overlays (kill feed, ability bar) scaled and placed in the margins.
- [ ] Implement high-impact, word-by-word animated subtitles using the TTS timestamp JSON.
- [ ] Implement audio mixing: original game audio (lowered/ducked) + voiceover MP3 + royalty-free background music.
- [ ] Automate rendering using Remotion CLI.
- **Milestone 4**: Calling the Remotion CLI with local assets yields a premium vertical Short video (`output.mp4`) with synchronized music, voice, and animated captions.

### Phase 5: SQLite Orchestrator & State Machine (Week 5)
**Goal**: Glue all individual services together into a single automated pipeline.
- [ ] Implement the core `orchestrator` service in Node.js.
- [ ] Build the polling loop that monitors the database for pending jobs.
- [ ] Wire up service execution (spawning child processes or API calls for each phase).
- [ ] Implement robust retry mechanisms, job timeouts, and database error logging.
- [ ] Implement an automated disk-cleanup routine that deletes raw video recordings and temporary assets older than 5 days.
- **Milestone 5**: A raw video dropped in `/captures/` automatically transitions through parsing, analysis, audio generation, and rendering, producing a finished `output.mp4` ready for upload.

### Phase 6: YouTube Publisher & Production Tuning (Week 6)
**Goal**: Safe publishing automation and continuous pipeline stability.
- [ ] Implement `youtube-publisher` using the official Google API Client.
- [ ] Build safe local OAuth2 token storage and auto-rotation scripts on Windows.
- [ ] Configure the schedule logic (e.g., daily uploads at 10:00 AM).
- [ ] Write system integration and liveness tests.
- [ ] Implement local monitoring scripts (optional: Discord Webhook notifications for pipeline success/failure).
- **Milestone 6**: End-to-end, zero-click automation. A Valorant clip captured on Windows is processed, rendered, and scheduled on the YouTube channel as a Short, with progress notifications delivered via Webhook.
