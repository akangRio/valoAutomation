# AI Developer Agents Guide (AGENTS.md)

Welcome, AI Coding Agent! This document is your operational manual for contributing to the **Valorant AI Content Automation** repository. It contains strict execution rules and behavioral guardrails you must follow to maintain architectural integrity, avoid refactoring churn, and ensure safe local executions.

---

## 🤖 1. Architectural Guardrails (Non-Negotiable)

Before you touch any files, install packages, or write code, you must understand the core architecture of this platform:

1. **Local-First, Cloud-Sparsely**: 
   - All intensive file management, processing, computer vision (OpenCV/Python), React video rendering (Remotion), and publishing run locally on the Windows host.
   - Do NOT propose cloud migrations (e.g. AWS, GCP GCE) for rendering or local capture monitor.
   - Cloud AI (Gemini 1.5 Flash) is reserved *strictly* for text-based narration/script generation, caption formatting metadata, and SEO copy generation.
2. **Event-Driven Coordination**: 
   - We use **Redis** and **BullMQ** for event distribution and task throttling. 
   - **PostgreSQL** coupled with **Prisma ORM** acts as the system persistent database.
   - Do NOT write custom socket-based inter-process communication (IPC) servers, custom database clients, or raw SQL.
3. **No Code Churn**: 
   - Do not refactor files that already meet performance and safety criteria. 
   - Prioritize adding self-contained test scripts and incremental coverage.

---

## 📂 2. Directory Navigation Map

You must store your implementations in their correct directories. Refer to the directory layout below:

| Directory | Intended Contents |
| :--- | :--- |
| `apps/` | Main execution applications and BullMQ workers (`api-gateway`, `capture-monitor`, `cv-slicer-worker`, `video-render-worker`, etc.) |
| `services/` | Auxiliary microservices or isolated script layers |
| `packages/` | Shared libraries and utility frameworks (e.g. `database`, `logger`) |
| `prompts/` | System prompts, LLM instructions, and markdown templates for Gemini calls |
| `scripts/` | Developer CLI tools, OAuth authenticators, and initialization bat files |
| `infrastructure/` | Local configuration templates, PM2 process configuration setups |
| `docs/` | Complete architectural, system, and database design specifications |
| `.github/` | CI/CD automation and code validation workflows |

---

## 📏 3. Standard Code Integration Flow

When you are assigned an engineering task (from [TASKS.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/TASKS.md)):

```
1. READ target specs in docs/ ──> 2. PREPARE localized unit tests
                                         │
4. WRITE code under apps/ or packages/ <─┘
     │
5. RUN validation & integration checks ──> 6. WRITE JSON-structured log verify
```

1. **Step 1: Read the Design**: Open and read the relevant `.md` file in `docs/` first. Do not guess API formats or data structures.
2. **Step 2: Add Environment Schemas**: Use Zod to validate environment variables. Fail early and loudly at process boot if variables are missing.
3. **Step 3: Keep Comments and Docstrings**: Retain all existing JSDocs, PEP 8 type hints, and comments in files you modify.
4. **Step 4: Use Structured JSON Logging**: Write logs to `stdout`/`stderr` strictly in JSON formatting. The orchestrator parses this structure to write logs back to the database.

---

## 🗃️ 4. References & Design Manuals
For precise details on implementing code, consult your specialized engineering manuals:
- **[PROJECT_CONSTITUTION.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/PROJECT_CONSTITUTION.md)**: Engineering ethics and behavioral constraints.
- **[API_CONTRACTS.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/API_CONTRACTS.md)**: Schema files, Gemini API properties, and word timestamp contracts.
- **[CODING_STANDARDS.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/CODING_STANDARDS.md)**: Logging layouts, error catching block styles, and testing packages.
- **[DATABASE.md](file:///home/student_03_c5def29c309c/valoAutomation/docs/DATABASE.md)**: PostgreSQL schemas, Prisma mappings, and index structures.
