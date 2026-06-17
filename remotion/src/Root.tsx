import "./index.css";
import { Composition } from "remotion";
import { MyComposition } from "./Composition";
import { Intro, introDefaultProps } from "./Intro";
import { Captions, captionsDefaultProps } from "./Captions";
import { Chart, chartDefaultProps } from "./Chart";

// Faceless-channel output format: vertical, 30fps (TikTok / Reels / Shorts).
const VERTICAL = { width: 1080, height: 1920, fps: 30 } as const;

export const RemotionRoot: React.FC = () => {
  return (
    <>
      {/* Original scaffold composition (landscape, empty canvas). */}
      <Composition
        id="MyComp"
        component={MyComposition}
        durationInFrames={60}
        fps={30}
        width={1280}
        height={720}
      />

      {/* Branded title card prepended to a short. */}
      <Composition
        id="Intro"
        component={Intro}
        durationInFrames={90}
        defaultProps={introDefaultProps}
        {...VERTICAL}
      />

      {/* Burn-in captions. Render to an alpha codec and overlay on footage. */}
      <Composition
        id="Captions"
        component={Captions}
        durationInFrames={120}
        defaultProps={captionsDefaultProps}
        {...VERTICAL}
      />

      {/* Animated data point (e.g. a tax threshold counting up). */}
      <Composition
        id="Chart"
        component={Chart}
        durationInFrames={90}
        defaultProps={chartDefaultProps}
        {...VERTICAL}
      />
    </>
  );
};
