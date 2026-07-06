# Valorant AI Content Automation Documentation

Welcome to the central design and engineering documentation index for the **Valorant AI Content Automation** system.

This documentation serves as the **Single Source of Truth** for the system's architecture, services, configurations, database, and coding rules. It contains everything an AI coding agent or human software engineer needs to know to implement, test, and maintain this codebase.

---

## Documentation Directory Index

Select any document below to inspect its system specification:

| Document | Purpose & Description |
| :--- | :--- |
| 🛡️ [PROJECT_CONSTITUTION.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/PROJECT_CONSTITUTION.md) | Absolute development principles, non-negotiables, and strict AI agent behavior guardrails. |
| 🎯 [VISION.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/VISION.md) | High-level product opportunity, core user journeys, success metrics, and content parameters. |
| 🏗️ [ARCHITECTURE.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/ARCHITECTURE.md) | Complete local-hybrid system topology, SQLite state-machine transitions, and sequential data flows. |
| 📅 [ROADMAP.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/ROADMAP.md) | A 6-phase step-by-step rollout plan for building, testing, and scaling the automation pipeline. |
| ⚙️ [SERVICES.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/SERVICES.md) | Comprehensive technical specification sheets (inputs, outputs, environment vars) for all 7 pipeline applications. |
| 🛠️ [TECH_STACK.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/TECH_STACK.md) | Technical decisions, rationale, and runtime choices (Node, Python, SQLite, Gemini 1.5, Remotion, FFmpeg). |
| 📏 [CODING_STANDARDS.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/CODING_STANDARDS.md) | Rules for environment validation schemas, structured logging (JSON), try-catch safety, and test suites. |
| 📂 [FOLDER_STRUCTURE.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/FOLDER_STRUCTURE.md) | Visual monorepo workspace file tree, highlighting local media storage layout boundaries. |
| 📜 [API_CONTRACTS.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/API_CONTRACTS.md) | Structured JSON Schemas for Gemini outputs, TTS alignments, and Remotion CLI props. |
| 🗄️ [DATABASE.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/DATABASE.md) | SQL tables, relational keys, indexes, and concurrency connection configurations optimized for SQLite. |
| 🏆 [MILESTONES.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/MILESTONES.md) | High-level engineering milestones, defining five buildable vertical slices of the pipeline. |
| 📋 [TASKS.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/TASKS.md) | Detailed, granular tasks for each milestone, detailing objectives, dependencies, complexity, and criteria. |

---

## Architecture Summary

This pipeline implements a **Local-First, Cloud-Sparsely** architecture. 
- All intensive video slicing, computer vision detection, voice synthesis, video rendering, database coordination, and scheduling run locally on the host Windows system.
- Multimodal cloud intelligence (Gemini 1.5 Flash API) is used exclusively for strategic, creative metadata writing and narrating script formulation. This ensures cost-efficiency (under **$0.05 per Short**) while producing high-production-value video uploads.

---

> [!IMPORTANT]
> **To AI Coding Agents:** This documentation is frozen. No architectural modifications, table updates, or folder restructuring should be executed without explicitly modifying these specifications first and acquiring human validation. Do not generate code that deviates from these specifications.
