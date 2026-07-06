# Project Milestones: Enterprise Event-Driven Pipeline

This document defines the high-level roadmap and milestones for the **Valorant AI Content Automation** platform. Developed by the Senior Technical Product Manager, this roadmap is structured into **five independently buildable and testable milestones** designed to reduce integration risk and maximize early progress.

---

## Technical Milestone Roadmap

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MILESTONE PROGRESSION                            │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤
│ Milestone 1  │ Milestone 2  │ Milestone 3  │ Milestone 4  │ Milestone 5     │
│ Core Message │ Computer     │ Multimodal   │ Programmatic │ Publisher       │
│ Broker & API │ Vision       │ Cloud AI &   │ Remotion     │ Worker & Disk   │
│ Gateway      │ Slicer       │ TTS Sync     │ Compositor   │ Housekeeper     │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────────┘
```

| Milestone | Deliverable System                                                                     | Integration Risk Mitigated                                              | Working System Validation                                                              |
| :-------- | :------------------------------------------------------------------------------------- | :---------------------------------------------------------------------- | :------------------------------------------------------------------------------------- |
| **M1**    | [Core Message Broker & API Gateway](#milestone-1-core-message-broker--api-gateway)     | Connection pooling, state schema integrity, and Redis backpressure.     | Dropping file calls creates db states via Prisma and registers active tasks in BullMQ. |
| **M2**    | [Computer Vision Slicer Worker](#milestone-2-computer-vision-slicer-worker)            | C++ OpenCV resource leaks and local FFmpeg processor crashes.           | Slicer worker processes queue tasks, trims videos, and saves keyframe folders.         |
| **M3**    | [Multimodal Cloud AI & TTS Sync](#milestone-3-multimodal-cloud-ai--tts-sync)           | Gemini schema formatting failures and audio timing alignment drifts.    | Cloud AI and TTS workers synthesize narration, audio, and syllable timings.            |
| **M4**    | [Programmatic Remotion Compositor](#milestone-4-programmatic-remotion-compositor)      | GPU out-of-memory and word-boundary video synchronization.              | Compositor worker renders 9:16 MP4 Shorts with dynamic, animated subtitles.            |
| **M5**    | [Publisher Worker & Disk Housekeeper](#milestone-5-publisher-worker--disk-housekeeper) | Google OAuth refresh token timeout and system storage space exhaustion. | Complete pipeline loop. Captures publish to YouTube and local storage purges.          |

---

## Milestone 1: Core Message Broker & API Gateway

_Establish the central Express API Gateway, Prisma PostgreSQL database client, and BullMQ Redis queues._

- **Scope**: Setting up the monorepo workspace configurations, drafting database schemas inside `schema.prisma`, migrating to PostgreSQL, implementing the Express REST API, and initializing Redis BullMQ queues.
- **Working System**: A functional API and database backend. Submitting a `POST /api/v1/jobs` HTTP request creates a `PENDING` job record in PostgreSQL via Prisma, and enqueues a task payload in the `cv-slicer-queue` managed by Redis.
- **Integration Risk Mitigated**: Guarantees database state-machine safety and message Broker connectivity before implementing complex media workers.

---

## Milestone 2: Computer Vision Slicer Worker

_Implement the local computer vision engine as an asynchronous queue worker._

- **Scope**: Setting up the Python virtual environment and dependencies inside the worker, porting OpenCV templates, and executing FFmpeg trim boundaries.
- **Working System**: A standalone worker bound to `cv-slicer-queue`. Consuming job payloads, it triggers local OpenCV matching, slices a 15-45s highlight video, and saves 5 climax keyframe JPEGs.
- **Integration Risk Mitigated**: Validates memory recycling of heavy C++ OpenCV wrappers, keeping the process footprint low and avoiding local leaks on Windows.

---

## Milestone 3: Multimodal Cloud AI & TTS Sync

_Integrate Cloud AI visual synthesis and vocal synchronization._

- **Scope**: Integrating Google Gemini API with Zod-enforced response schemas, and synthesizing voice MP3s with exact syllable timestamps.
- **Working System**: Coupled workers bound to `cloud-ai-queue` and `tts-voice-queue`. They read visual keyframes, write creative commentary scripts, generate natural TTS audio, and save syllable-timing maps.
- **Integration Risk Mitigated**: Mitigates prompt hallucination and JSON schema anomalies by forcing structured outputs, and resolves audio synchronization drift.

---

## Milestone 4: Programmatic Remotion Compositor

_Implement programmatic 9:16 portrait video editing and subtitle synchronization._

- **Scope**: Scaffolding the React Remotion project, implementing vertical cropping, overlaying player stats HUD widgets, and rendering animated captions.
- **Working System**: A worker bound to `video-render-queue` with `concurrency: 1`. It compiles React video components into vertical MP4s, synchronizing music, voice, and text overlays frame-by-frame.
- **Integration Risk Mitigated**: Mitigates Windows GPU thrashing by enforcing a strict concurrency threshold of 1 on heavy compilation tasks.

---

## Milestone 5: Publisher Worker & Disk Housekeeper

_Automate YouTube uploads, credential rotations, and local disk space maintenance._

- **Scope**: Integrating the YouTube Data API with secure OAuth refresh token storage, and writing file-system garbage collector routines.
- **Working System**: The complete, end-to-end automation suite. Playing a game and saving a clip triggers automatic parsing, copywriting, voice synthesis, video rendering, YouTube scheduling, and disk-purging sweeps.
- **Integration Risk Mitigated**: Resolves YouTube quota limits and OAuth2 token timeouts, and prevents local hard drive exhaustion.
