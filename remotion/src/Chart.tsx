import {
  AbsoluteFill,
  interpolate,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

export type ChartProps = {
  label: string;
  value: number;
  prefix: string;
  accent: string;
};

export const chartDefaultProps: ChartProps = {
  label: "ISA allowance (2025/26)",
  value: 20000,
  prefix: "£",
  accent: "#16a34a",
};

export const Chart: React.FC<ChartProps> = ({
  label,
  value,
  prefix,
  accent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  const progress = spring({ frame, fps, config: { damping: 200 } });
  const shown = Math.round(value * progress);
  const barWidth = interpolate(progress, [0, 1], [0, 820]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#0b0f1a",
        justifyContent: "center",
        alignItems: "center",
        fontFamily: "sans-serif",
      }}
    >
      <p style={{ color: "#9aa4b2", fontSize: 44, margin: 0 }}>{label}</p>
      <div
        style={{
          color: "white",
          fontWeight: 800,
          fontSize: 150,
          margin: "20px 0 48px",
        }}
      >
        {prefix}
        {shown.toLocaleString("en-GB")}
      </div>
      <div
        style={{
          width: 820,
          height: 30,
          borderRadius: 15,
          backgroundColor: "rgba(255,255,255,0.12)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: barWidth,
            height: 30,
            borderRadius: 15,
            backgroundColor: accent,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};
