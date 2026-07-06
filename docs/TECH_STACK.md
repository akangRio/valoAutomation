# Tech Stack Decisiveness: Valorant AI Content Automation

This document outlines and justifies the technologies selected for the **Valorant AI Content Automation** pipeline. Every tool is selected to maximize reliability on Windows, minimize cloud runtime costs, and be easily coded/maintained by AI agents.

---

## 1. Primary Runtimes

### Node.js (v20+ / TypeScript)
- **Use Case**: Orchestrator, Capture Monitor, Cloud AI Interface, TTS Sync, YouTube Publisher, and Video Renderer.
- **Justification**:
  - Remotion is native to React and Node.js. Running the orchestrator in Node.js avoids inter-process boundaries when preparing assets for video rendering.
  - TypeScript provides strong typing and schema-validation (Zod), which prevents AI agents from making integration or contract errors.
  - Node's standard file system, stream, and child-process modules are highly performant and stable on Windows.

### Python (v3.10+)
- **Use Case**: Computer Vision Highlight Parser.
- **Justification**:
  - Python is the undisputed industry standard for computer vision. OpenCV (`opencv-python`) and NumPy are robust, highly optimized C++ wrappers that can analyze video frames extremely fast.
  - Isolating the computer vision stage in a Python script keeps memory management self-contained. Once the script trims the clip and exits, all memory allocated by OpenCV is cleanly reclaimed by the OS, preventing memory leaks on the gaming PC.

---

## 2. Databases & Queues

### SQLite (via `better-sqlite3` in Node.js)
- **Use Case**: Core state database, job coordinator, and orchestration log.
- **Justification**:
  - No external service dependency. SQLite runs inside a single file (`state.db`) in the workspace folder. No installation, zero-configuration.
  - Supports transactional locks (`IMMEDIATE` transactions) which prevent state-race conditions.
  - High performance: Using WAL (Write-Ahead Logging) mode and `better-sqlite3` (synchronous native C++ bindings for Node.js) allows thousands of transactions per second on a standard SSD with negligible CPU overhead.

---

## 3. Video Composition & Rendering

### Remotion (React-based Programmatic Video Editing)
- **Use Case**: Cropping 16:9 to 9:16 vertical, rendering stylized animated subtitles, embedding gameplay UI assets, and mixing audio tracks.
- **Justification**:
  - Premium Aesthetics: Doing layouts in HTML/CSS/Canvas is infinitely easier and more beautiful than writing complex, rigid, multi-line FFmpeg terminal commands.
  - Remotion allows using normal CSS rules (flexbox, gradients, keyframe animations) to build video clips.
  - Highly robust frame-accurate video synthesis. Every frame is guaranteed to be rendered exactly as designed in React, outputting a flawless high-definition MP4.

### FFmpeg (Local Windows Binary)
- **Use Case**: Trim/slicing videos, extracting keyframes, and serving as the rendering engine for Remotion.
- **Justification**:
  - The industry-standard tool for video encoding. Light, fast, and highly reliable on Windows.

---

## 4. Artificial Intelligence (AI) Services

### Cloud AI: Gemini 1.5 Flash (via Google AI SDK `@google/genai`)
- **Use Case**: Creative narration, title/description drafting, and visual overlay content determination.
- **Justification**:
  - **Unmatched Price/Performance**: Gemini 1.5 Flash is incredibly cost-efficient, costing pennies per million tokens.
  - **Large Context & Multimodal**: Can read a series of gameplay keyframes (images) and accurately understand what map is being played, which weapon is used, and what happened in the highlight.
  - **Structured Outputs**: Gemini native support for JSON Schemas guarantees that the AI returns structured JSON that can be validated via Zod, eliminating output formatting errors.

### Local/Cloud TTS: Edge-TTS or ElevenLabs
- **Use Case**: Voiceover narration generation with word boundaries.
- **Justification**:
  - **Edge-TTS** (Default): A free, open-source Python library that streams voice audio directly from Microsoft Edge's translation services. It has high-quality natural voices and provides precise word offsets (timestamps) for zero cost.
  - **ElevenLabs** (Optional): High-end human-realistic voice synthesis. It has deep API support for returning character/word-level start and end times, perfect for professional-grade Short creation.

---

## 5. Automation & Utilities

- **Chokidar (NPM)**: Node.js library for reliable, platform-agnostic file watching (crucial for Windows directory changes).
- **Zod (NPM)**: TypeScript schema validation for environment variables and Gemini API responses.
- **Googleapis (NPM)**: The official SDK for secure, OAuth2-compliant YouTube Data API v3 uploads.
