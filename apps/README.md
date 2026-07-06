# Applications Directory

This directory contains the core executing components of the **Valorant AI Content Automation** pipeline.

## Applications

- **`orchestrator/`**: Core daemon monitoring state transitions and scheduling tasks.
- **`capture-monitor/`**: watches folders and schedules new jobs in the database on raw video drops.
- **`cv-parser/`**: OpenCV tool matching frame skulls and slicing highlights.
- **`cloud-analyzer/`**: Connects keyframes to Gemini.
- **`tts-generator/`**: Generates voice MP3 and extracts precise timestamps.
- **`video-renderer/`**: Remotion vertical video composer.
- **`youtube-publisher/`**: Google OAuth uploader.
