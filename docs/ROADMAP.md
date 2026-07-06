# Project Roadmap: Enterprise Edition

This document details the development cycles and implementation phases for the **Valorant AI Content Automation** enterprise monorepo, transitioning from local-first scaffolding to a high-throughput, event-driven queue platform.

---

## Technical Rollout Strategy

Our engineering path is broken into 5 technical milestones, prioritizing the creation of our message brokers and databases before launching resource-heavy rendering workers.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                             ENGINEERING PHASES                              │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤
│ Phase 1      │ Phase 2      │ Phase 3      │ Phase 4      │ Phase 5         │
│ Core Broker  │ CV & Slicer  │ AI & Voice   │ Remotion     │ Publisher       │
│ & Database   │ Worker       │ Synthesis    │ Composition  │ & Automation    │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────────┘
```

---

## Detailed Roadmap Phases

### Phase 1: Core Broker, Database & API Gateway
- **Goal**: Provision development services, construct relational models via Prisma, and set up the Express API Gateway.
- **Tasks**:
  - Provision local PostgreSQL and Redis servers.
  - Compile the monorepo workspace configurations.
  - Formulate database models inside `packages/database/prisma/schema.prisma`.
  - Establish Express API controller routing for raw video ingestion and metrics monitoring.
  - Implement Zod schema validation checks for incoming HTTP requests.
- **Milestone 1 Deliverable**: An active Express API Gateway and local PostgreSQL database where a REST call registers jobs, sets their status to `PENDING` via Prisma, and successfully pushes payload items to Redis.

### Phase 2: CV Slicer Worker (Computer Vision)
- **Goal**: Integrate the local computer vision pipeline as a dedicated, non-blocking BullMQ worker.
- **Tasks**:
  - Build the `cv-slicer-worker` structure and connect it to Redis.
  - Port OpenCV templates (Kill Skull assets) and NumPy matrices.
  - Script Python sub-processes to scan frames, capture coordinate lists, and compile highlight boundaries.
  - Write trimming routines utilizing local FFmpeg.
- **Milestone 2 Deliverable**: A computer vision processor bound to `cv-slicer-queue` that trims raw videos, extracts keyframe JPEGs, saves assets under `/storage/`, and updates status in PostgreSQL using Prisma.

### Phase 3: Storyteller Worker (Gemini & TTS Synchronization)
- **Goal**: Develop creative and synthetic voice workers.
- **Tasks**:
  - Construct `cloud-ai-worker` using `@google/genai` to send keyframes to Gemini.
  - Enforce structured Gemini response contracts via prompt-schemas.
  - Construct `tts-voice-worker` using Microsoft Edge-TTS or ElevenLabs.
  - Extract word boundaries and sync timestamps from voice MP3 stream events.
- **Milestone 3 Deliverable**: Successful pipeline chaining. Completed computer vision runs automatically trigger Cloud AI scripts and generate matched TTS voiceovers with syllable timestamp files.

### Phase 4: Video Compositor Worker (Remotion Engine)
- **Goal**: Construct programmatic portrait video compositions with animated captions.
- **Tasks**:
  - Scaffolding the React-based Remotion rendering framework.
  - Implement portrait cropping centered on players' crosshairs.
  - Build dynamic caption overlay components reacting frame-by-frame to syllable timestamps.
  - Establish dynamic audio-mixing rules, lowering background music during vocal peaks.
  - Restrict worker concurrency strictly to `1` to prevent GPU locks.
- **Milestone 4 Deliverable**: The Remotion worker compiles vertical MP4 files automatically, yielding professional-grade Shorts from raw video segments.

### Phase 5: Publisher Worker & Deployment Tuning
- **Goal**: Automate YouTube upload profiles, token rotations, and disk cleanup procedures.
- **Tasks**:
  - Integrate `youtube-publisher-worker` using the official Google API Client.
  - Script command-line OAuth authorization helpers for secure token storage.
  - Configure daily scheduling logic based on database queue profiles.
  - Write file-system cleanup hooks to purge raw and temporary clips.
  - Run continuous, end-to-end integration tests over 72-hour loops.
- **Milestone 5 Deliverable**: Play a game, hit OBS hotkeys, and see your play parsed, analyzed, voiced, styled, rendered, scheduled to YouTube, and locally cleaned up with zero manual intervention.
