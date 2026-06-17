import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type IntroProps = {
  title: string;
  subtitle: string;
  accent: string;
};

export const introDefaultProps: IntroProps = {
  title: "The £20,000 ISA Trick",
  subtitle: "UK tax-free saving, explained in 30 seconds",
  accent: "#16a34a",
};

export const Intro: React.FC<IntroProps> = ({ title, subtitle, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const enter = spring({ frame, fps, config: { damping: 200 } });
  const titleY = interpolate(enter, [0, 1], [60, 0]);
  const titleOpacity = interpolate(frame, [0, 12], [0, 1], {
    extrapolateRight: "clamp",
  });
  const subOpacity = interpolate(frame, [12, 26], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0b0f1a",
        justifyContent: "center",
        alignItems: "center",
        padding: 96,
      }}
    >
      <div
        style={{
          height: 10,
          width: 140,
          backgroundColor: accent,
          borderRadius: 5,
          marginBottom: 48,
          transform: `scaleX(${enter})`,
        }}
      />
      <h1
        style={{
          color: "white",
          fontSize: 104,
          fontWeight: 800,
          textAlign: "center",
          lineHeight: 1.05,
          margin: 0,
          fontFamily: "sans-serif",
          transform: `translateY(${titleY}px)`,
          opacity: titleOpacity,
        }}
      >
        {title}
      </h1>
      <p
        style={{
          color: "#9aa4b2",
          fontSize: 42,
          textAlign: "center",
          marginTop: 36,
          fontFamily: "sans-serif",
          opacity: subOpacity,
        }}
      >
        {subtitle}
      </p>
    </AbsoluteFill>
  );
};
