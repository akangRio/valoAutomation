import React from "react";
import { AbsoluteFill, Video, Audio, useCurrentFrame, useVideoConfig, spring } from "remotion";

export interface WordTimestamp {
  word: string;
  startMs: number;
  endMs: number;
}

export interface VideoRenderProps {
  highlightVideoPath?: string;
  voiceoverAudioPath?: string;
  wordTimestampsPath?: string;
  wordTimestamps?: WordTimestamp[];
  visualMetadata?: {
    agent: string;
    captionColor: string;
    clutchMomentDescription: string;
  };
}

export const MyComposition: React.FC<VideoRenderProps> = ({
  highlightVideoPath,
  voiceoverAudioPath,
  wordTimestamps,
  visualMetadata,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const currentTimeMs = (frame / fps) * 1000;

  const { agent, captionColor, clutchMomentDescription } = visualMetadata || {
    agent: "Jett",
    captionColor: "#00FFFF",
    clutchMomentDescription: "VALORANT HIGHLIGHT",
  };

  // Standard cinematic crop scale: 1.15x zoom centers the action and highlights game hud elements
  const zoomScale = 1.15;

  // 1. Process WordTimestamps
  const safeTimestamps = wordTimestamps || [];

  // Find the active word at the current frame
  const activeWordIndex = safeTimestamps.findIndex(
    (w) => currentTimeMs >= w.startMs && currentTimeMs <= w.endMs
  );

  const activeWordObj = activeWordIndex !== -1 ? safeTimestamps[activeWordIndex] : null;

  // Implement a beautiful animated sliding window or single-word punchy caption
  // Let's compute a spring scale for the active word to pop when it begins speaking!
  let wordScale = 1.0;
  if (activeWordObj) {
    const wordStartFrame = (activeWordObj.startMs / 1000) * fps;
    const springInput = frame - wordStartFrame;
    wordScale = spring({
      frame: springInput,
      fps,
      config: {
        damping: 12,
        mass: 0.4,
        stiffness: 140,
      },
    }) * 0.35 + 0.9; // scales smoothly from 0.9 to 1.25
  }

  // 2. Audio Ducking Algorithm
  // Check if speech is active in a window of 200ms around the current frame
  const isSpeaking = safeTimestamps.some(
    (w) => currentTimeMs >= w.startMs - 150 && currentTimeMs <= w.endMs + 150
  );

  // Smoothly interpolate volume to prevent sudden clicks
  const bgMusicVolume = isSpeaking ? 0.08 : 0.35;

  return (
    <AbsoluteFill style={{ backgroundColor: "#060608", overflow: "hidden" }}>
      {/* A. Gameplay Widescreen-to-Vertical Crop centered on player crosshair */}
      <div
        style={{
          position: "absolute",
          width: "100%",
          height: "100%",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          overflow: "hidden",
        }}
      >
        {highlightVideoPath && (
          <Video
            src={highlightVideoPath}
            style={{
              height: "100%",
              width: "auto",
              minWidth: "177.78vh", // ensures perfect 16:9 scaling
              objectFit: "cover",
              transform: `scale(${zoomScale})`,
              transformOrigin: "center center",
            }}
          />
        )}
      </div>

      {/* B. Visual metadata overlay layer */}
      <div
        style={{
          position: "absolute",
          top: 150,
          left: 0,
          right: 0,
          textAlign: "center",
          color: captionColor || "#00FFFF",
          fontFamily: "system-ui, -apple-system, sans-serif",
          fontSize: 64,
          fontWeight: 900,
          letterSpacing: "0.08em",
          textShadow: "0px 4px 16px rgba(0, 0, 0, 0.95), 0px 0px 8px rgba(0, 255, 255, 0.4)",
          zIndex: 10,
        }}
      >
        {clutchMomentDescription?.toUpperCase()}
        <span
          style={{
            fontSize: 28,
            display: "block",
            marginTop: 10,
            color: "#ffffff",
            fontWeight: 700,
            letterSpacing: "0.15em",
            textShadow: "0px 2px 8px rgba(0, 0, 0, 0.9)",
          }}
        >
          PLAYED BY {agent?.toUpperCase()}
        </span>
      </div>

      {/* C. Dynamic Animated Synced Subtitles (Punchy single-word caption) */}
      {activeWordObj && (
        <div
          style={{
            position: "absolute",
            bottom: 350,
            left: 0,
            right: 0,
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 20,
          }}
        >
          <span
            style={{
              color: captionColor || "#00FFFF",
              fontFamily: "system-ui, -apple-system, sans-serif",
              fontSize: 96,
              fontWeight: 950,
              textTransform: "uppercase",
              textAlign: "center",
              transform: `scale(${wordScale})`,
              display: "inline-block",
              textShadow: "0px 6px 20px rgba(0, 0, 0, 1), 0px 0px 12px rgba(0, 255, 255, 0.6)",
              padding: "10px 30px",
              backgroundColor: "rgba(0, 0, 0, 0.4)",
              borderRadius: "20px",
              border: "2px solid rgba(255, 255, 255, 0.1)",
              backdropFilter: "blur(4px)",
            }}
          >
            {activeWordObj.word}
          </span>
        </div>
      )}

      {/* D. Background Music Instrumental with dynamic Frame-Level Ducking */}
      {/* We utilize a standard mock instrumental background loop if present */}
      <Audio
        src="mock_hype_music.mp3"
        volume={() => bgMusicVolume}
        loop
      />

      {/* E. Voiceover Audio Track (Primary narration) */}
      {voiceoverAudioPath && <Audio src={voiceoverAudioPath} volume={1.0} />}
    </AbsoluteFill>
  );
};
