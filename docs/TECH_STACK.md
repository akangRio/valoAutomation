# Technology Stack Selection & Rationale: Enterprise Edition

This document outlines the professional-grade software stack selected for the **Valorant AI Content Automation** platform, detailing technical decisions, architectural justifications, and local/cloud performance trade-offs.

---

## 1. Core Language & Frameworks

### TypeScript (v5+)
- **Use Case**: Language of choice across the entire monorepo workspace.
- **Justification**:
  - Eliminates integration errors among distinct services.
  - Ensures runtime robustness through compile-time type validation.
  - Composes well with modern IDE auto-completions, enhancing developer and AI agent velocity.

### Express.js (v4+)
- **Use Case**: REST API Gateway and management portal routing.
- **Justification**:
  - High performance, minimal overhead, and extremely mature middleware ecosystem.
  - Standardized endpoint management for job state polling, webhooks, and manual pipeline overrides.

---

## 2. Database & ORM Layer

### PostgreSQL (v16+)
- **Use Case**: Transactional persistent database and analytics engine.
- **Justification**:
  - High concurrency, full ACID compliance, and robust relational linking.
  - Unlike lightweight flat-file systems, PostgreSQL natively handles high-concurrency connections from decoupled workers and supports advanced analytical tracking (e.g. channel growth stats, workflow durations).

### Prisma ORM
- **Use Case**: Database model modeling, migration management, and type-safe query generation.
- **Justification**:
  - **Type-Safety**: Auto-generates exact TypeScript types based on `schema.prisma`.
  - **Prisma Client**: Zero-overhead database client with built-in connection pool management.
  - **Prisma Migrations**: Handles structural database updates deterministically and safely via SQL migrations.

---

## 3. Messaging & Task Orchestration

### Redis (v7+)
- **Use Case**: Asynchronous event broker, job store, and state manager.
- **Justification**:
  - In-memory speed capable of handling millions of low-latency read/write operations per second.
  - Perfectly matches BullMQ requirements for atomic state tracking and low-latency locking.

### BullMQ (v5+)
- **Use Case**: Queue Management, distributed event routing, task throttling, and automatic retries.
- **Justification**:
  - **Message Queues**: Decouples heavy rendering, analysis, and API operations into distinct, non-blocking pipeline steps.
  - **Backpressure**: Standardizes concurrency limits. By adjusting worker instance sizes (e.g. `concurrency: 1` for the Remotion renderer), we prevent GPU-thrashing during high-performance gaming sessions.
  - **Fault Tolerance**: Implements automatic, exponential backoff retries on task failures (e.g. API timeouts).

---

## 4. Video, Audio & Computer Vision

### Remotion (v4+)
- **Use Case**: Vertical video programmatic layout, multi-layered visual overlays, and caption animation.
- **Justification**:
  - Translates visual layout challenges from rigid FFmpeg commands to standard, expressive React/CSS styles.
  - Leverages WebGL/Canvas to compose professional, frame-accurate vertical video shorts.

### FFmpeg (Local Windows Binary)
- **Use Case**: Low-overhead media cropping, slice operations, and keyframe extractions.
- **Justification**:
  - Unmatched media encoding performance. Serves as the high-speed backend renderer for Remotion.

---

## 5. Cloud AI Services

### Cloud Vision AI & Gemini 1.5 Flash (Google Cloud AI)
- **Use Case**: Multimodal gameplay scene analysis, dynamic script composition, and SEO tags compilation.
- **Justification**:
  - Multimodal input (image frame arrays) allows Gemini to read game scores, weapons, and actions directly from visual contexts.
  - Structured Output schema validation ensures Gemini always returns exact JSON contracts matching our Zod validators, eliminating text parsing anomalies.
