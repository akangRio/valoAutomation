# Valorant AI Content Automation (Enterprise)

A professional-grade, event-driven, hybrid AI content pipeline that automatically generates one highly polished YouTube Short per day from captured Valorant gameplay.

---

## Technical Architecture

The platform operates on a cost-effective, decentralized **local-hybrid architecture** built to handle heavy media operations locally while leveraging cloud AI for metadata reasoning:
- **Local Ingestion & Hosting**: An **Express.js** API Gateway processes video registrations, storing structured records in a local or remote **PostgreSQL** instance via **Prisma ORM**.
- **Asynchronous Task Queuing**: **Redis** and **BullMQ** coordinate loose-coupled background worker services (CV parsing, Gemini AI calling, TTS synching, Remotion rendering, YouTube uploading).
- **Programmatic Video Compositing**: **Remotion** (React/TypeScript) center-crops widescreen videos into 9:16 vertical clips, overlaying active game HUD panels, dynamic royalty-free audio tracks, and synchronized animated captions frame-by-frame.
- **Cloud Multimodal AI**: **Google Cloud Vision & Gemini APIs** evaluate static visual keyframe selections to formulate commentary scripts, click-optimized titles, and SEO descriptions.

---

## 📖 System Engineering Documentation

Before writing any application code, the entire system has been meticulously designed. All specifications, standards, database schemas, and migration strategies are stored inside the `docs/` directory, serving as the **Single Source of Truth** for developers and AI coding agents.

### Core Resources:
- 🗺️ **[Documentation Sitemap & Index](file:///home/student_03_c5def29c309c/valoAutomation/docs/README.md)** - Central sitemap linking all system blueprints.
- 🛡️ **[Project Constitution](file:///home/student_03_c5def29c309c/valoAutomation/docs/PROJECT_CONSTITUTION.md)** - Architecture pillars, non-negotiables, and AI agent guardrails.
- 🏗️ **[System Architecture](file:///home/student_03_c5def29c309c/valoAutomation/docs/ARCHITECTURE.md)** - Event-driven topology, service boundaries, and BullMQ queue models.
- 📂 **[Folder Structure Map](file:///home/student_03_c5def29c309c/valoAutomation/docs/FOLDER_STRUCTURE.md)** - Monorepo workspace directories layout.
- 📜 **[API & Event Contracts](file:///home/student_03_c5def29c309c/valoAutomation/docs/API_CONTRACTS.md)** - Express REST controllers schemas, BullMQ payloads, and timing files.
- 🗄️ **[Database & Prisma Specification](file:///home/student_03_c5def29c309c/valoAutomation/docs/DATABASE.md)** - Complete relational models in `schema.prisma`.
- 🏆 **[Project Milestones](file:///home/student_03_c5def29c309c/valoAutomation/docs/MILESTONES.md)** - Progressive development iterations.
- 📋 **[Engineering Task Board](file:///home/student_03_c5def29c309c/valoAutomation/docs/TASKS.md)** - Detailed, task-level specifications and acceptance criteria.

---

## System Workflow Pipeline

```
[OBS Clip Saved] ──> [Capture Monitor]
                            │
                     (POST /api/v1/jobs)
                            ▼
                    [Express Gateway] ──(Prisma)──> [PostgreSQL]
                            │
                    (BullMQ Enqueue)
                            ▼
                    [cv-slicer-queue] ──────> [CV Slicer Worker] (OpenCV/FFmpeg)
                            │
                    [cloud-ai-queue] ───────> [Cloud AI Worker] (Gemini API)
                            │
                    [tts-voice-queue] ──────> [TTS Voice Worker] (Audio & Synced JSON)
                            │
                    [video-render-queue] ───> [Remotion Worker] (vertical MP4 compile)
                            │
                    [publishing-queue] ─────> [YouTube Publisher Worker] (OAuth upload)
```

### Guidance for AI Developer Agents
1. Review the **[AGENTS.md](file:///home/student_03_c5def29c309c/valoAutomation/AGENTS.md)** guidelines located in the root of the project.
2. Ensure you adhere to **[Coding Standards](file:///home/student_03_c5def29c309c/valoAutomation/docs/CODING_STANDARDS.md)** (especially concerning Zod configurations, strict types, Prisma queries, and structured JSON logging).
3. Do not proceed to write implementation code before aligning with the milestone task list in **[Engineering Task Board](file:///home/student_03_c5def29c309c/valoAutomation/docs/TASKS.md)**.
