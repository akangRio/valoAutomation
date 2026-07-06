# Valorant AI Content Automation

A fully automated, local-first hybrid AI content pipeline that generates one highly polished YouTube Short per day from automatically captured Valorant gameplay on a local Windows PC.

---

## Project Overview

This repository houses the entire design and future implementation of the **Valorant AI Content Automation** monorepo. It operates on a cost-efficient **local-hybrid architecture**:
- **Local Compute**: OBS directory watching, OpenCV computer vision (for zero-cost highlight detection), Remotion (React-based vertical video cropping and styling), local SQLite state-machine queuing, and YouTube automated uploading.
- **Cloud Intelligence**: Gemini 1.5 Flash (via `@google/genai`) handles gameplay analysis of low-res keyframes, narration scriptwriting, and SEO metadata generation.

---

## 📖 Architecture & Design Documentation

Before writing any application code, the entire system has been meticulously designed. All specifications, standards, and database schemas are stored inside the `docs/` directory, serving as the **Single Source of Truth** for developers and AI coding agents.

### Start Here:
- 🗺️ **[Documentation Sitemap & Index](file:///home/student_03_c5def29c309c/valoAutomation/docs/README.md)** - Central entry point linking all technical designs.
- 🛡️ **[Project Constitution](file:///home/student_03_c5def29c309c/valoAutomation/docs/PROJECT_CONSTITUTION.md)** - Key principles, non-negotiables, and AI agent guardrails.
- 🏗️ **[System Architecture](file:///home/student_03_c5def29c309c/valoAutomation/docs/ARCHITECTURE.md)** - Technical topology, SQLite state transition model, and detailed data flows.
- 📂 **[Folder Structure Map](file:///home/student_03_c5def29c309c/valoAutomation/docs/FOLDER_STRUCTURE.md)** - Complete workspace file tree illustrating process boundaries.
- 📜 **[API & Data Contracts](file:///home/student_03_c5def29c309c/valoAutomation/docs/API_CONTRACTS.md)** - Event structures, Gemini response schemas, and Remotion compilation schemas.
- 🗄️ **[Database Specification](file:///home/student_03_c5def29c309c/valoAutomation/docs/DATABASE.md)** - Optimized SQLite table and schema definitions.
- 🏆 **[Project Milestones](file:///home/student_03_c5def29c309c/valoAutomation/docs/MILESTONES.md)** - 5 independently buildable, working system iterations.
- 📋 **[Engineering Task Board](file:///home/student_03_c5def29c309c/valoAutomation/docs/TASKS.md)** - Comprehensive task-level definitions (objectives, metrics, criteria).

---

## System Quick-Start Architecture

```
[OBS Capture] ──> [Capture Monitor] ──> [SQLite DB (state.db)]
                                                │
[Remotion Render] <── [TTS Sync] <── [Gemini AI] <── [OpenCV Parser]
       │
[YouTube Upload]
```

### Next Steps for Implementation Agents
1. Read the **[Project Constitution](file:///home/student_03_c5def29c309c/valoAutomation/docs/PROJECT_CONSTITUTION.md)** carefully.
2. Read the **[Roadmap](file:///home/student_03_c5def29c309c/valoAutomation/docs/ROADMAP.md)** to see the current active build phase.
3. Review the individual service specification sheets in **[Services Specification](file:///home/student_03_c5def29c309c/valoAutomation/docs/SERVICES.md)**.
4. Follow the **[Coding Standards](file:///home/student_03_c5def29c309c/valoAutomation/docs/CODING_STANDARDS.md)** (especially concerning Zod schemas, structured JSON logging, and Unit testing) for any code additions.
