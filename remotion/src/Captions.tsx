import { AbsoluteFill, useCurrentFrame } from "remotion";

// One spoken word and the frame it should light up on. The script step emits
// these from word-level timings (e.g. ElevenLabs / Whisper alignment).
export type Word = {
  text: string;
  fromFrame: number;
};

export type CaptionsProps = {
  words: Word[];
  highlight: string;
};

// Background is intentionally transparent so this can be rendered to an
// alpha codec and overlaid on top of the AI-generated footage during stitch.
export const captionsDefaultProps: CaptionsProps = {
  highlight: "#22c55e",
  words: "Put up to twenty thousand pounds in an ISA each year"
    .split(" ")
    .map((text, i) => ({ text, fromFrame: i * 6 })),
};

export const Captions: React.FC<CaptionsProps> = ({ words, highlight }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill
      style={{
        justifyContent: "flex-end",
        alignItems: "center",
        paddingBottom: 360,
        paddingLeft: 64,
        paddingRight: 64,
      }}
    >
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "8px 18px",
          justifyContent: "center",
          maxWidth: 920,
        }}
      >
        {words.map((word, i) => {
          const active = frame >= word.fromFrame;
          return (
            <span
              key={i}
              style={{
                fontFamily: "sans-serif",
                fontWeight: 800,
                fontSize: 68,
                lineHeight: 1.1,
                color: active ? highlight : "rgba(255,255,255,0.35)",
                textShadow: "0 4px 24px rgba(0,0,0,0.65)",
              }}
            >
              {word.text}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};
