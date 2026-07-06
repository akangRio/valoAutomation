import React from "react";
import { AbsoluteFill, Video, Audio } from "remotion";

export interface VideoRenderProps {
  highlightVideoPath?: string;
  voiceoverAudioPath?: string;
  wordTimestampsPath?: string;
  visualMetadata?: {
    agent: string;
    captionColor: string;
    clutchMomentDescription: string;
  };
}

export const MyComposition: React.FC<VideoRenderProps> = ({
  highlightVideoPath,
  voiceoverAudioPath,
  wordTimestampsPath,
  visualMetadata,
}) => {
  const { agent, captionColor, clutchMomentDescription } = visualMetadata || {
    agent: "Jett",
    captionColor: "#00FFFF",
    clutchMomentDescription: "VALORANT HIGHLIGHT",
  };

  // Standard cinematic crop scale: 1.15x zoom centers the action and highlights game hud elements
  const zoomScale = 1.15;

  return (
    <AbsoluteFill style={{ backgroundColor: "#0a0a0c", overflow: "hidden" }}>
      {/* 1. Gameplay Widescreen-to-Vertical Crop centered on player crosshair */}
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
              minWidth: "177.78vh", // ensures perfect 16:9 scaling (16/9 * 100vh = 177.78vh)
              objectFit: "cover",
              transform: `scale(${zoomScale})`,
              transformOrigin: "center center",
            }}
          />
        )}
      </div>

      {/* Visual metadata overlay layer */}
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
          fontWeight: "black",
          letterSpacing: "0.05em",
          textShadow: "0px 4px 12px rgba(0, 0, 0, 0.9)",
          zIndex: 10,
        }}
      >
        {clutchMomentDescription?.toUpperCase()}
        <span style={{ fontSize: 32, display: "block", marginTop: 10, color: "#ffffff" }}>
          PLAYED BY {agent?.toUpperCase()}
        </span>
      </div>

      {/* 2. Voiceover Audio Track */}
      {voiceoverAudioPath && <Audio src={voiceoverAudioPath} />}
    </AbsoluteFill>
  );
};
