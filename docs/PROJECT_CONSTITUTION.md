# Project Constitution: Valorant AI Content Automation

This document defines the core principles, development philosophies, and absolute "non-negotiables" for the **Valorant AI Content Automation** codebase. Every AI coding agent and human developer contributing to this repository MUST adhere to these rules without exception.

---

## 1. Core Principles

### I. Local-First, Cloud-Sparsely
- **Rule**: All heavy operations—gameplay recording, folder monitoring, computer vision parsing, audio generation (TTS), video compositing, rendering, queue management, and publisher scheduling—MUST run locally on the host Windows machine.
- **Rationale**: Keeps operating costs near zero and utilizes local GPU/CPU hardware.
- **Cloud Limitation**: Cloud AI (Gemini API) is reserved **exclusively** for high-level semantic gameplay analysis, creative narration/voiceover scriptwriting, and YouTube metadata generation (titles, descriptions, tags). Do not send raw 1080p game footage to the cloud.

### II. Absolute Modularity (Share Nothing Architecture)
- **Rule**: Every service (e.g., `capture-monitor`, `cv-parser`, `video-renderer`) must operate as an independent, isolated process. Services must never import code directly from other services.
- **Communication**: Services communicate solely via the local database queue (SQLite) or formal API contracts.
- **Rationale**: Enables developers and AI agents to work on, test, and upgrade individual services without side effects.

### III. Zero-Install Windows Simplicity
- **Rule**: The system must run on standard Windows 10/11 using only standard runtime environments (Node.js v20+ and Python 3.10+).
- **No Docker**: Do NOT require Docker, WSL2, Redis, or external database engines for local runtime.
- **Rationale**: Keeps local setup lightweight, developer-friendly, and compatible with kernel-level game anti-cheats (like Riot Vanguard) that often conflict with virtualization/hypervisors.

---

## 2. Guardrails for AI Coding Agents

AI agents are powerful but prone to drift, over-refactoring, and "hallucinating" architectural changes. The following rules are hard constraints on AI behavior in this project:

### I. No Code-Churn & Refactoring Loops
- **Constraint**: Do not refactor code that already works unless it violates a specific performance or security requirement.
- **Action**: Before modifying any existing file, read the comments, docstrings, and tests first. Preserve original logic and variable names.

### II. Maintain Documentation and Docstring Integrity
- **Constraint**: Every function must have explicit JSDoc (TypeScript) or Docstrings (Python) defining inputs, outputs, and side effects.
- **Action**: When modifying a file, preserve all existing docstrings and comments. If you change a function signature, you MUST update its documentation in the same commit.

### III. No Hardcoded Secrets or Credentials
- **Constraint**: NEVER hardcode API keys, OAuth client secrets, or local absolute paths.
- **Action**: Use standard `.env` files. Validate all environment variables at startup using schemas (e.g., `zod` in TypeScript, `pydantic` or `os.environ` validation in Python). If a secret is missing, crash gracefully with a clear instruction on how the user can set it.

### IV. Structured and Actionable Error Handling
- **Constraint**: Never catch errors silently (`try {} catch (e) {}` with empty block).
- **Action**: All errors must be caught, logged as structured JSON with service metadata, and—if executing inside a job pipeline—written back to the SQLite `error_log` for that job.

---

## 3. The "Single Source of Truth" Rules

1. **GitHub is the Source of Truth**: All source code, configs, templates, and migrations must be checked into git.
2. **SQLite is the State Source of Truth**: The local SQLite database (`/db/state.db`) is the sole coordinator of job states. No service should maintain in-memory state of other services' schedules.
3. **Docs Folder is the Design Source of Truth**: No architectural changes may be implemented without first updating the corresponding `.md` file in `/docs/`.

---

## 4. Anti-Patterns (What NOT to do)

- **❌ DO NOT** use raw FFmpeg command line concatenation for video layout and overlay generation. Use **Remotion** (React) for visual layouts, relying on FFmpeg purely as the rendering backend.
- **❌ DO NOT** write custom socket-based inter-process communication (IPC) servers. Use the SQLite-based polling state-machine queue defined in `ARCHITECTURE.md`.
- **❌ DO NOT** use Selenium or complex browser automation to upload to YouTube. Use the official **YouTube Data API v3** with secure local OAuth token rotation.
- **❌ DO NOT** upload raw video files to Gemini. Extract precise high-yield keyframes and short, low-bitrate highlight clips first.
