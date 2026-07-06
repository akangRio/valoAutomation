# Project Constitution: Valorant AI Content Automation (Enterprise Edition)

This document defines the core engineering principles, architectural governance, and development guidelines for the **Valorant AI Content Automation** platform. Every AI agent and human engineer contributing to this codebase must adhere to these policies.

---

## 1. Core Architectural Pillars

### I. Local-First, Cloud-Sparsely (Hybrid Model)

- **Principle**: High-throughput media operations—video ingestion, local frame capture, computer vision parsing, audio mixing, and high-quality video compilation (Remotion/FFmpeg)—MUST run locally on the high-performance Windows host to exploit local GPU/CPU hardware.
- **Cloud Limitation**: Cloud Vision AI and Multimodal LLMs (Gemini API) are utilized **strictly** for semantic visual scene analysis, voiceover narration scriptwriting, and YouTube metadata Generation. Do not upload raw uncompressed video files; process keyframes and high-yield cuts locally first.

### II. Event-Driven & Queue-Based Architecture (Decoupled Services)

- **Principle**: No synchronous inter-process blocking. All tasks are managed via structured queues utilizing **BullMQ** backed by **Redis**. Services are designed around the "Share Nothing" philosophy.
- **Communication**: Inter-service communication happens asynchronously via BullMQ jobs, with synchronous management and metrics queries serviced through lightweight **Express** HTTP APIs.

### III. Single Source of Truth

- **Principle**:
  - **State Source of Truth**: A local or remote **PostgreSQL** instance managed via **Prisma ORM** serves as the persistent system record.
  - **Message Source of Truth**: **Redis** coordinates the queue and event broker.
  - **Source Code & Design Truth**: The Git repository is the absolute source of truth. All design decisions must be locked in `/docs/` prior to implementation.

---

## 2. Guardrails for AI Coding Agents

AI developer agents are powerful but must operate within safe, predictable bounds:

### I. Strict Environment & Schema Validation

- **Constraint**: No process is allowed to bootstrap with unitialized configuration or missing secrets.
- **Action**: All environment variables MUST be validated at startup using **Zod** schema parsers. If a required credential (e.g., PostgreSQL URL, Redis configuration, Google API Keys) is invalid, the process must exit immediately with an explicit, structured error log.

### II. Code-Churn & Refactoring Prevention

- **Constraint**: Do not modify, refactor, or delete working modules unless explicitly instructed by the Lead Software Architect.
- **Action**: Focus on incremental feature implementation, adding comprehensive unit tests, and adhering strictly to established Prisma schemas and BullMQ contracts.

### III. Preserving JSDoc & Typesafe Signatures

- **Constraint**: Every function must remain strictly typesafe.
- **Action**: Retain and update all TypeScript interfaces, JSDocs, and inline comments. Do not downgrade strict types to `any`.

---

## 3. Anti-Patterns (What NOT to do)

- **❌ DO NOT** write raw SQL queries or custom database connection pools. Use **Prisma Client** exclusively.
- **❌ DO NOT** use custom polling routines (`setInterval`) for job coordination. Use **BullMQ Workers** and events.
- **❌ DO NOT** spin up multiple concurrent video rendering processes on a single GPU. Throttle rendering tasks strictly by setting `concurrency: 1` on the BullMQ render worker.
- **❌ DO NOT** bypass schema checks or hardcode credentials in any service.
