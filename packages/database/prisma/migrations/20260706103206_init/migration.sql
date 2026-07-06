-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'CV_PARSING', 'CV_COMPLETED', 'CLOUD_ANALYZING', 'CLOUD_COMPLETED', 'TTS_GENERATING', 'TTS_COMPLETED', 'VIDEO_RENDERING', 'VIDEO_COMPLETED', 'PUBLISHING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "MusicTheme" AS ENUM ('HYPE', 'CHILL', 'LOFI');

-- CreateTable
CREATE TABLE "Job" (
    "id" TEXT NOT NULL,
    "rawVideoPath" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "currentStep" TEXT NOT NULL DEFAULT 'INIT',
    "highlightVideoPath" TEXT,
    "keyframesDir" TEXT,
    "renderedVideoPath" TEXT,
    "errorLog" TEXT,
    "retries" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Highlight" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "timestampStart" DOUBLE PRECISION NOT NULL,
    "timestampEnd" DOUBLE PRECISION NOT NULL,
    "killCount" INTEGER NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Highlight_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VideoMetadata" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "suggestedTitle" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "tags" TEXT[],
    "voiceoverScript" TEXT NOT NULL,
    "clutchOverlay" TEXT NOT NULL,
    "captionColor" TEXT NOT NULL,
    "musicTheme" "MusicTheme" NOT NULL DEFAULT 'HYPE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VideoMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TTSAudioSync" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "voiceoverAudioPath" TEXT NOT NULL,
    "timestampsJsonPath" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TTSAudioSync_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "YouTubeUpload" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "youtubeVideoId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "scheduledFor" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "YouTubeUpload_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_idx" ON "Job"("status");

-- CreateIndex
CREATE INDEX "Job_createdAt_idx" ON "Job"("createdAt");

-- CreateIndex
CREATE INDEX "Highlight_jobId_idx" ON "Highlight"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "VideoMetadata_jobId_key" ON "VideoMetadata"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "TTSAudioSync_jobId_key" ON "TTSAudioSync"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "YouTubeUpload_jobId_key" ON "YouTubeUpload"("jobId");

-- CreateIndex
CREATE INDEX "YouTubeUpload_youtubeVideoId_idx" ON "YouTubeUpload"("youtubeVideoId");

-- AddForeignKey
ALTER TABLE "Highlight" ADD CONSTRAINT "Highlight_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VideoMetadata" ADD CONSTRAINT "VideoMetadata_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TTSAudioSync" ADD CONSTRAINT "TTSAudioSync_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "YouTubeUpload" ADD CONSTRAINT "YouTubeUpload_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "Job"("id") ON DELETE CASCADE ON UPDATE CASCADE;
