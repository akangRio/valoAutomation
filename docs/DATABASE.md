# Database Specifications: Enterprise PostgreSQL & Prisma Model

This document outlines the PostgreSQL database structure, performance index selections, and the complete, production-ready **Prisma Schema** governing data migrations and relationships.

---

## 1. Database Engine Rationale

We utilize **PostgreSQL** as our transactional record system.

- **Relational Integrity**: Safely manages relationships between captured videos, extracted highlights, generated scripts, and upload audit logs.
- **Concurrency Support**: Native row-level locking handles rapid concurrent status updates coming from decoupled asynchronous BullMQ queue workers.
- **Analytical Strength**: Optimizes complex telemetry queries (e.g. video render speeds, failure ratios, channel performance tracking over time).

---

## 2. Prisma Database Model (`schema.prisma`)

Below is the complete, schema definition file. All services use this model via Prisma Client to query the database.

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum JobStatus {
  PENDING
  CV_PARSING
  CV_COMPLETED
  CLOUD_ANALYZING
  CLOUD_COMPLETED
  TTS_GENERATING
  TTS_COMPLETED
  VIDEO_RENDERING
  VIDEO_COMPLETED
  PUBLISHING
  COMPLETED
  FAILED
}

enum MusicTheme {
  HYPE
  CHILL
  LOFI
}

model Job {
  id                  String       @id @default(uuid())
  rawVideoPath        String
  status              JobStatus    @default(PENDING)
  currentStep         String       @default("INIT")
  highlightVideoPath  String?
  keyframesDir        String?
  renderedVideoPath   String?
  errorLog            String?      @db.Text
  retries             Int          @default(0)
  createdAt           DateTime     @default(now())
  updatedAt           DateTime     @updatedAt

  // Relations
  highlights          Highlight[]
  metadata            VideoMetadata?
  audioSync           TTSAudioSync?
  youtubeUpload       YouTubeUpload?

  @@index([status])
  @@index([createdAt])
}

model Highlight {
  id              String   @id @default(uuid())
  jobId           String
  timestampStart  Float
  timestampEnd    Float
  killCount       Int
  confidence      Float
  createdAt       DateTime @default(now())

  // Relations
  job             Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId])
}

model VideoMetadata {
  id              String     @id @default(uuid())
  jobId           String     @unique
  suggestedTitle  String
  description     String     @db.Text
  tags            String[]
  voiceoverScript String     @db.Text
  clutchOverlay   String
  captionColor    String
  musicTheme      MusicTheme @default(HYPE)
  createdAt       DateTime   @default(now())

  // Relations
  job             Job        @relation(fields: [jobId], references: [id], onDelete: Cascade)
}

model TTSAudioSync {
  id                 String   @id @default(uuid())
  jobId              String   @unique
  voiceoverAudioPath String
  timestampsJsonPath String   // Path to WordTimestamp[] JSON file
  createdAt          DateTime @default(now())

  // Relations
  job                Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)
}

model YouTubeUpload {
  id             String   @id @default(uuid())
  jobId          String   @unique
  youtubeVideoId String
  publishedAt    DateTime?
  scheduledFor   DateTime
  createdAt      DateTime @default(now())

  // Relations
  job            Job      @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([youtubeVideoId])
}
```

---

## 3. Performance Optimization & Indexes

To keep the Express API Gateway and BullMQ workers lightning-fast, we apply custom indexes on query filters (automatically compiled by Prisma via `@@index` annotations):

1. **`Job(status)` Index**:
   - **Justification**: Speeds up poller and admin metrics queries evaluating work-in-progress workloads.
2. **`Job(createdAt)` Index**:
   - **Justification**: Essential for cleaning procedures sorting old jobs to delete oversized raw media files.
3. **`Highlight(jobId)` Index**:
   - **Justification**: Speeds up relational joins when loading raw gameplay segment listings.
4. **`YouTubeUpload(youtubeVideoId)` Index**:
   - **Justification**: Speeds up tracking updates looking up status metrics via the official YouTube Video ID.

---

## 4. Connection Pooling Rationale

Since our BullMQ workers act as independent processes, each worker creates its own instance of the database client.

- **PostgreSQL Connection Pool**: Limit client connections using Prisma's connection pool configurations inside the `DATABASE_URL` query parameters:
  ```env
  DATABASE_URL="postgresql://postgres:password@localhost:5432/state_db?connection_limit=5&pool_timeout=10"
  ```
  This restricts connection scaling, preventing the database from running out of socket allocation descriptors during parallel job peaks.
