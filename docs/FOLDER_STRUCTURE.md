# Monorepo Workspace Directory Structure: Enterprise Edition

This document describes the organization of our TypeScript-based monorepo, detailing where independent BullMQ workers, packages, API servers, and configurations are stored.

---

## Complete Workspace Map

```
/ (workspace root)
│
├── .github/                       # GitHub workflow automated runners
│   └── workflows/
│       └── ci.yml                 # Run Vitest testing suites & Prisma schema validation
│
├── apps/                          # Core executing platforms
│   ├── api-gateway/               # Express.js HTTP Server managing Prisma & BullMQ triggers
│   │   ├── src/
│   │   │   ├── controllers/       # Controller routers
│   │   │   ├── middleware/        # Request schema validation (Zod)
│   │   │   └── app.ts             # Gateway Express bootstrap
│   │   └── package.json
│   │
│   ├── capture-monitor/           # Non-blocking filesystem observer
│   │   ├── src/
│   │   │   └── monitor.ts         # chokidar directory watcher
│   │   └── package.json
│   │
│   ├── cv-slicer-worker/          # BullMQ worker executing computer vision trimming
│   │   ├── src/
│   │   │   ├── worker.ts          # BullMQ processor
│   │   │   └── scripts/           # Python OpenCV files
│   │   └── package.json
│   │
│   ├── cloud-ai-worker/           # BullMQ worker integrating Cloud Vision & Gemini API
│   ├── tts-voice-worker/          # BullMQ worker synthesising commentary track
│   ├── video-render-worker/       # BullMQ worker executing Remotion compilations
│   │   ├── src/
│   │   │   ├── index.ts           # Remotion entrypoint
│   │   │   └── Composition.tsx    # React video structure
│   │   └── package.json
│   │
│   └── youtube-publisher-worker/  # BullMQ worker handling OAuth video uploads
│
├── packages/                      # Internal shared workspace packages
│   ├── database/                  # Prisma Client provider & migration schema files
│   │   ├── prisma/
│   │   │   ├── schema.prisma      # Unified database models
│   │   │   └── migrations/        # Safe SQL migration scripts
│   │   ├── src/
│   │   │   └── client.ts          # Shared Prisma instance
│   │   └── package.json
│   │
│   └── logger/                    # Standardized structured JSON logger module
│
├── prompts/                       # Multimodal Gemini instruction sheets
│   └── gemini-visual-v1.md
│
├── infrastructure/                # Deployment configurations
│   ├── local/                     # Local Redis/Postgres services bat setup configs
│   └── pm2/                       # PM2 process managers configuration file (ecosystem.config.js)
│
├── scripts/                       # Local helper scripts
│   ├── setup-windows.bat          # Install Node and local development services
│   └── auth-google.ts             # Command-line utility to generate local OAuth refresh tokens
│
├── storage/                       # Local media pipeline directory (Git-ignored)
│   ├── captures/                  # Destination for raw recordings
│   ├── highlights/                # Trimmed gameplay segments
│   ├── keyframes/                 # Extracted climax JPEGs for Gemini
│   ├── temp_audio/                # Synthesised MP3 tracks
│   └── output/                    # Compiled vertical MP4 clips
│
├── AGENTS.md                      # Operational guidelines and guardrails for AI coding agents
├── README.md                      # High-level monorepo index
├── package.json                   # Monorepo configuration managing yarn/pnpm/npm workspaces
└── tsconfig.json                  # Parent TypeScript configuration compilation guidelines
```

---

## Directory Guardrails

1. **The `/storage/` Rule**: Large video files must never be placed inside application packages. All clips must be processed using references pointing to the absolute path under the `/storage/` directory.
2. **The Shared `/packages/` Boundary**: Shared libraries (like `packages/database` housing Prisma) must never compile execution engines. They provide typesafe clients or logging decorators to be imported by the executing applications during build-time.
3. **No Direct Inter-App Imports**: Applications located under `apps/` must never reference or import code from another application directly. All cross-app relationships are coordinated via BullMQ messaging payloads or Express Gateway webhooks.
