# Folder Structure: Valorant AI Content Automation

This document outlines the organization and directory layouts of the **Valorant AI Content Automation** monorepo workspace.

---

## Workspace Monorepo Layout

The repository is structured as a modular monorepo to separate independent services, shared packages, build configurations, and pipeline documentation.

```
/ (workspace root)
│
├── .github/                       # GitHub Actions CI/CD workflows
│
├── apps/                          # Independent executing applications
│   ├── capture-monitor/           # watches captures/ and inserts SQLite jobs (Node.js)
│   ├── cv-parser/                 # Python script to analyze highlights & extract keyframes
│   │   ├── src/
│   │   │   ├── parser.py          # OpenCV core detection script
│   │   │   └── templates/         # Kill skull/scoreboard overlay image templates for matching
│   │   ├── requirements.txt       # Python dependencies
│   │   └── venv/                  # Local Python virtual environment (ignored in git)
│   │
│   ├── cloud-analyzer/            # Node.js service connecting to Gemini
│   ├── tts-generator/             # Node.js service for voiceover & word timestamp sync
│   ├── video-renderer/            # React/Remotion vertical video template and compile CLI
│   │   ├── src/
│   │   │   ├── index.ts           # Remotion root registration
│   │   │   ├── Composition.tsx    # Core composition layout (9:16 layout)
│   │   │   └── Subtitles.tsx      # Word-by-word animated caption component
│   │   ├── public/                # Static assets (fonts, sound effects, background music)
│   │   └── package.json
│   │
│   ├── youtube-publisher/         # Node.js YouTube OAuth Data API v3 uploader
│   └── orchestrator/              # Master Node.js job orchestrator & DB poller
│
├── packages/                      # Shared libraries (internal imports)
│   ├── database/                  # SQLite clients and schema migration definitions
│   └── logger/                    # Shared structured JSON logger utility
│
├── docs/                          # Architecture & design specifications (Source of Truth)
│   ├── README.md
│   ├── ARCHITECTURE.md
│   ├── SERVICES.md
│   ├── TECH_STACK.md
│   ├── CODING_STANDARDS.md
│   └── ... (this file & other specs)
│
├── scripts/                       # Developer utility scripts
│   ├── setup.bat                  # Local Windows developer environmental configuration
│   ├── test-pipeline.sh           # Run a local dry-run end-to-end integration test
│   └── auth-youtube.js            # Run local CLI flow to obtain the refresh token
│
├── storage/                       # Local media storage directory (ignored in git)
│   ├── captures/                  # Incoming raw OBS/Shadowplay gameplay captures
│   ├── highlights/                # OpenCV parsed 15-45s clip segments
│   ├── keyframes/                 # Extracted highlight climax JPEG frames for Gemini
│   ├── temp_audio/                # Synthesized TTS MP3 files
│   └── output/                    # Final rendered vertical MP4 Shorts
│
├── .env.example                   # Baseline configuration templates (secrets must be left empty)
├── .gitignore                     # Enforces storage/ and venv/ exclusion
├── package.json                   # Root package.json managing workspace workspaces
└── tsconfig.json                  # Root TypeScript shared compilations
```

---

## Key Directories Explained

### 1. `/storage/`
- **Crucial**: This folder stores heavy media assets. It is completely ignored by Git to avoid repository bloating.
- Subdirectories:
  - `/storage/captures/`: The destination folder where the user's screen recorder (OBS) saves raw clips.
  - `/storage/highlights/`: Where trimmed video highlight segments are output by the CV parser.
  - `/storage/keyframes/`: Holds the lightweight JPEG frame extracts used to fuel Gemini multimodal prompts.
  - `/storage/output/`: The final, high-definition rendered MP4s waiting for YouTube publication.

### 2. `/packages/`
- Holds common code blocks that multiple Node.js applications use (e.g., standard SQL queries, standardized logger formatting, schema definitions).
- Kept in `/packages/` to adhere to DRY (Don't Repeat Yourself) principles without violating process boundaries, as these are imported as libraries during build-time.

### 3. `/scripts/`
- Contains execution files for human developers and local administrative tasks.
- `auth-youtube.js`: A CLI prompt utility that launches a local browser interface, handles Google OAuth login, retrieves the API refresh token, and dumps it into the local `.env` file securely.
