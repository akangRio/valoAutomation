# Project Milestones: Valorant AI Content Automation

This document outlines the Product Management roadmap, breaking the project down into **five independently buildable and testable milestones**. Each milestone delivers a functional vertical slice (a "working system") that validates a portion of the automated pipeline.

---

## Milestone Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            MILESTONE PROGRESSION                            │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────────┤
│ Milestone 1  │ Milestone 2  │ Milestone 3  │ Milestone 4  │ Milestone 5     │
│ The Observer │ The Slicer   │ The          │ The Editor   │ The Broadcaster │
│ (Ingestion & │ (Local CV    │ Storyteller  │ (Remotion    │ (Uploader &     │
│ Database)    │ Highlight)   │ (Gemini/TTS) │ Compositing) │ Housekeeping)   │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────────┘
```

| Milestone | Title | Working System Output | Primary Value Validated |
| :--- | :--- | :--- | :--- |
| **M1** | [The Observer](#milestone-1-the-observer-ingestion--database-core) | Core Monorepo + Database + Watcher. | Validates zero-friction file monitoring and atomic state orchestration. |
| **M2** | [The Slicer](#milestone-2-the-slicer-local-computer-vision) | Local OpenCV Highlight Extractor. | Validates cost-free local clip slicing and action keyframe harvesting. |
| **M3** | [The Storyteller](#milestone-3-the-storyteller-ai--voice-sync) | Gemini API Scripting + TTS Audio Sync. | Validates multimodal creative generation and word-timestamp synchronization. |
| **M4** | [The Editor](#milestone-4-the-editor-programmatic-composition) | Remotion React-Video Compositor. | Validates 9:16 cropping, game-UI overlay, and animated caption rendering. |
| **M5** | [The Broadcaster](#milestone-5-the-broadcaster-publishing--housekeeping) | YouTube Publisher + Disk Housekeeper. | Validates secure OAuth upload scheduling and long-term local disk hygiene. |

---

## Milestone 1: The Observer (Ingestion & Database Core)
*Establish the local workspace, database coordinator, and filesystem watcher.*

- **Scope**: Setup of monorepo folder structure, SQLite schema configuration, `capture-monitor` background worker, and `orchestrator` state poller.
- **Working System**: A system that watches `/storage/captures/`, detects new files, verifies their writing completion, creates atomic rows in SQLite, and transitions them into the queue.
- **Value**: Verifies system coordination. Dropping a video into a folder is reliably recognized and logged under transaction-safe SQLite parameters.

---

## Milestone 2: The Slicer (Local Computer Vision)
*Add computer vision capabilities to automatically find gameplay highlights without manual trimming.*

- **Scope**: Integration of Python Virtual Environment, OpenCV frame analysis scripts, template-matching matrices for game-UI detection, and FFmpeg trim execution.
- **Working System**: A pipeline where dropping a full-length match capture yields a localized highlight clip (20-40s) and a set of 5 action keyframe images (JPEGs) without any manual editing.
- **Value**: Avoids sending gigabytes of video to the cloud. Heavy lifting is handled locally on the CPU/GPU with zero API cost.

---

## Milestone 3: The Storyteller (AI & Voice Sync)
*Integrate the pipeline with cloud intelligence and voiceover synthesizers.*

- **Scope**: Node.js `@google/genai` API connector, Zod validation schemas for structured outputs, and TTS API (Edge-TTS or ElevenLabs) with word boundary tokenization.
- **Working System**: A system that takes keyframes and metadata, executes the Gemini call to retrieve script/tags/titles, generates a matching voiceover MP3, and outputs word-aligned timestamps.
- **Value**: Proves multimodal gameplay understanding and creates perfect synchronization data for the upcoming subtitle engine.

---

## Milestone 4: The Editor (Programmatic Composition)
*Implement vertical composition, stylized overlays, dynamic audio mixing, and video rendering.*

- **Scope**: Remotion React project, 9:16 viewport cropping, dynamic overlay positioning, animated caption components, and FFmpeg multi-threaded compilation.
- **Working System**: A command-line render call that compiles raw game clips, voiceover tracks, and subtitle JSONs into a premium, vertical MP4 Short with animated captions and auto-ducked background music.
- **Value**: Automates professional-grade manual video editing, delivering the final visual product.

---

## Milestone 5: The Broadcaster (Publishing & Housekeeping)
*Connect to YouTube securely and schedule daily publishing while managing local storage resources.*

- **Scope**: YouTube OAuth Data API v3 uploader, local token rotating script, daily scheduler scheduler, and an automated local file cleanup system.
- **Working System**: The complete **Valorant AI Content Automation** suite. Play the game, save a clip, and see it processed, voiced, styled, rendered, and securely scheduled on your YouTube channel—followed by automated disk space reclamation.
- **Value**: Full zero-intervention workflow loop.
