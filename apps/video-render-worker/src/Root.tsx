import "./index.css";
import { Composition } from "remotion";
import { MyComposition, VideoRenderProps } from "./Composition";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="ValorantShort"
        component={MyComposition}
        durationInFrames={1800} // Default to 30 seconds at 60fps
        fps={60}
        width={1080}
        height={1920}
        defaultProps={{
          highlightVideoPath: "mock_highlight_video.mp4",
          voiceoverAudioPath: "mock_voiceover.mp3",
          wordTimestampsPath: "mock_timestamps.json",
          visualMetadata: {
            agent: "Jett",
            captionColor: "#00FFFF",
            clutchMomentDescription: "UNREAL 4K DEFENSE",
          },
        } as VideoRenderProps}
      />
    </>
  );
};
