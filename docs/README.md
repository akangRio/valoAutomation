# Valorant AI Content Automation: Architecture & Design Documentation Index

Welcome to the central engineering documentation index for the **Valorant AI Content Automation** platform.

This documentation serves as the **Single Source of Truth** for the system's architecture, services, configurations, relational databases, and coding rules. It contains everything an AI coding agent or human software engineer needs to know to implement, test, and maintain this codebase.

---

## Documentation Index

Select any document below to inspect its system specification:

| Document | Purpose & Description |
| :--- | :--- |
| 🛡️ [PROJECT_CONSTITUTION.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/PROJECT_CONSTITUTION.md) | Absolute development principles, non-negotiables, and strict AI agent behavior guardrails. |
| 🎯 [VISION.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/VISION.md) | High-level product opportunity, core user journeys, success metrics, and content parameters. |
| 🏗️ [ARCHITECTURE.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/ARCHITECTURE.md) | Complete local-hybrid system topology, service boundaries, data flows, and BullMQ Redis queues. |
| 📅 [ROADMAP.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/ROADMAP.md) | A 5-phase step-by-step rollout plan for building, testing, and scaling the automation pipeline. |
| ⚙️ [SERVICES.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/SERVICES.md) | Comprehensive technical specification sheets (inputs, outputs, environment vars) for all Express servers and BullMQ workers. |
| 🛠️ [TECH_STACK.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/TECH_STACK.md) | Technical decisions, rationale, and runtime choices (TypeScript, Express, Prisma, PostgreSQL, Redis, BullMQ). |
| 📏 [CODING_STANDARDS.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/CODING_STANDARDS.md) | Rules for environment validation schemas (Zod), structured logging (JSON), Prisma transactions, and test suites. |
| 📂 [FOLDER_STRUCTURE.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/FOLDER_STRUCTURE.md) | Visual monorepo workspace file tree, highlighting apps, shared packages, and storage boundaries. |
| 📜 [API_CONTRACTS.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/API_CONTRACTS.md) | Structured JSON Schemas for REST API controllers, BullMQ job payloads, Gemini outputs, and TTS syncs. |
| 🗄️ [DATABASE.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/DATABASE.md) | Complete Prisma Schema (`schema.prisma`) file, PostgreSQL relations, indexes, and pool configurations. |
| 🏆 [MILESTONES.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/MILESTONES.md) | High-level engineering milestones, defining five buildable vertical slices of the pipeline. |
| 📋 [TASKS.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/TASKS.md) | Detailed, granular tasks for each milestone, detailing objectives, dependencies, complexity, and criteria. |

---

## Architectural Summary

This platform implements an **Event-Driven, Local-First, Cloud-Sparsely** architecture.
- **Local Workflows**: An Express API Gateway handles requests. Decoupled, asynchronous BullMQ workers backed by Redis handle file monitoring, computer vision parsing, audio compilation, and Remotion video rendering locally, saving results to PostgreSQL via Prisma.
- **Cloud Intelligence**: Multimodal AI (Cloud Vision & Gemini APIs) is utilized exclusively for strategic creative script generation and YouTube SEO metadata. This maximizes compilation quality while keeping server operating overhead near zero.

---

> [!IMPORTANT]
> **To AI Coding Agents:** This documentation is frozen. No architectural modifications, table updates, or folder restructuring should be executed without explicitly modifying these specifications first and acquiring human validation. Do not generate code that deviates from these specifications.
