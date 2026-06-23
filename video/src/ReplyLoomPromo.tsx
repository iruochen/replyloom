import {
  AbsoluteFill,
  Easing,
  Img,
  interpolate,
  Sequence,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

const ink = "#eef2ff";
const muted = "#aeb8cf";
const purple = "#7c83ff";
const ease = Easing.bezier(0.16, 1, 0.3, 1);

const Brand = () => (
  <div style={{position: "absolute", left: 78, top: 60, display: "flex", alignItems: "center", gap: 16}}>
    <div style={{width: 42, height: 42, borderRadius: 13, background: purple, color: "white", display: "grid", placeItems: "center", fontWeight: 900, fontSize: 16}}>RL</div>
    <div style={{fontSize: 21, fontWeight: 850, letterSpacing: "0.12em", color: ink}}>REPLYLOOM</div>
  </div>
);

const Background = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 900], [0, 80]);
  return (
    <AbsoluteFill style={{background: "#080b13", overflow: "hidden"}}>
      <div style={{position: "absolute", width: 820, height: 820, borderRadius: 999, right: -120 + drift, top: -280, background: "radial-gradient(circle, rgba(99,102,241,.34), rgba(99,102,241,0) 68%)"}} />
      <div style={{position: "absolute", width: 700, height: 700, borderRadius: 999, left: -280 - drift / 2, bottom: -360, background: "radial-gradient(circle, rgba(56,189,248,.17), rgba(56,189,248,0) 68%)"}} />
      <div style={{position: "absolute", inset: 0, opacity: 0.15, backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)", backgroundSize: "72px 72px"}} />
    </AbsoluteFill>
  );
};

const Reveal = ({children, delay = 0, distance = 38}: {children: React.ReactNode; delay?: number; distance?: number}) => {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [delay, delay + 24], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease});
  return <div style={{opacity: progress, transform: `translateY(${(1 - progress) * distance}px)`}}>{children}</div>;
};

const Scene = ({children}: {children: React.ReactNode}) => (
  <AbsoluteFill style={{fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif", color: ink}}>
    <Background />
    <Brand />
    {children}
  </AbsoluteFill>
);

const Intro = () => {
  const frame = useCurrentFrame();
  const exit = interpolate(frame, [175, 205], [1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic)});
  return (
    <Scene>
      <div style={{position: "absolute", left: 150, right: 150, top: 250, opacity: exit}}>
        <Reveal><div style={{fontSize: 28, fontWeight: 800, color: purple, letterSpacing: "0.08em"}}>AI REPLY ASSISTANT FOR X</div></Reveal>
        <Reveal delay={10}><div style={{fontSize: 104, lineHeight: 0.98, letterSpacing: "-0.065em", fontWeight: 850, marginTop: 30}}>Better replies.<br/><span style={{color: muted}}>Still your voice.</span></div></Reveal>
        <Reveal delay={22}><div style={{fontSize: 32, color: muted, marginTop: 42}}>Three thoughtful drafts. Your model. Your final say.</div></Reveal>
      </div>
    </Scene>
  );
};

const ScreenshotScene = ({image, eyebrow, title, detail, start}: {image: string; eyebrow: string; title: string; detail: string; start: number}) => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 28], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease});
  const exit = interpolate(frame, [start - 38, start], [1, 0], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.in(Easing.cubic)});
  const value = enter * exit;
  return (
    <Scene>
      <div style={{position: "absolute", left: 92, top: 210, width: 500, opacity: value, transform: `translateX(${(1-enter) * -48}px)`}}>
        <div style={{fontSize: 23, color: purple, fontWeight: 850, letterSpacing: "0.09em"}}>{eyebrow}</div>
        <div style={{fontSize: 64, lineHeight: 1.03, letterSpacing: "-0.045em", fontWeight: 840, marginTop: 24}}>{title}</div>
        <div style={{fontSize: 28, lineHeight: 1.5, color: muted, marginTop: 28}}>{detail}</div>
      </div>
      <div style={{position: "absolute", left: 650, top: 155, width: 1180, height: 738, opacity: value, transform: `translateX(${(1-enter) * 80}px) scale(${0.965 + enter * 0.035})`, borderRadius: 28, padding: 12, background: "rgba(255,255,255,.07)", border: "1px solid rgba(255,255,255,.14)", boxShadow: "0 35px 90px rgba(0,0,0,.5)"}}>
        <Img src={staticFile(image)} style={{width: "100%", height: "100%", objectFit: "cover", borderRadius: 19}} />
      </div>
    </Scene>
  );
};

const ControlScene = () => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 25], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease});
  const checks = ["Reads only the post you choose", "Inserts an editable draft", "Never clicks the final Reply button"];
  return (
    <Scene>
      <div style={{position: "absolute", left: 150, right: 150, top: 230, opacity: enter}}>
        <Reveal><div style={{fontSize: 27, color: purple, fontWeight: 850, letterSpacing: "0.09em"}}>HUMAN IN THE LOOP</div></Reveal>
        <Reveal delay={8}><div style={{fontSize: 80, fontWeight: 850, letterSpacing: "-0.055em", marginTop: 24}}>You stay in control.</div></Reveal>
        <div style={{display: "flex", gap: 22, marginTop: 58}}>
          {checks.map((item, index) => {
            const p = interpolate(frame, [22 + index * 10, 45 + index * 10], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease});
            return <div key={item} style={{flex: 1, minHeight: 220, padding: 34, borderRadius: 24, background: "rgba(18,23,38,.88)", border: "1px solid rgba(148,163,184,.2)", opacity: p, transform: `translateY(${(1-p) * 30}px)`}}><div style={{width: 40, height: 40, borderRadius: 12, background: "rgba(124,131,255,.18)", color: "#b7bbff", display: "grid", placeItems: "center", fontSize: 24, fontWeight: 900}}>✓</div><div style={{fontSize: 30, lineHeight: 1.35, fontWeight: 720, marginTop: 30}}>{item}</div></div>;
          })}
        </div>
      </div>
    </Scene>
  );
};

const Outro = () => {
  const frame = useCurrentFrame();
  const enter = interpolate(frame, [0, 28], [0, 1], {extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease});
  return (
    <Scene>
      <div style={{position: "absolute", inset: 0, display: "grid", placeItems: "center", textAlign: "center", opacity: enter, transform: `scale(${0.96 + enter * 0.04})`}}>
        <div>
          <div style={{fontSize: 32, color: purple, fontWeight: 850, letterSpacing: "0.09em"}}>REPLYLOOM</div>
          <div style={{fontSize: 92, lineHeight: 1.02, letterSpacing: "-0.06em", fontWeight: 860, marginTop: 28}}>Make the reply<br/>worth reading.</div>
          <div style={{display: "inline-flex", marginTop: 44, padding: "18px 28px", borderRadius: 999, background: ink, color: "#111528", fontSize: 25, fontWeight: 800}}>Coming to the Chrome Web Store</div>
        </div>
      </div>
    </Scene>
  );
};

export const ReplyLoomPromo = () => {
  const {fps} = useVideoConfig();
  return (
    <AbsoluteFill>
      <Sequence from={0} durationInFrames={7 * fps} premountFor={fps}><Intro /></Sequence>
      <Sequence from={6 * fps} durationInFrames={6 * fps} premountFor={fps}><ScreenshotScene image="screenshot-compose.png" eyebrow="01 · PICK THE ANGLE" title="Draft with intent." detail="Choose a tone, length, and language—then generate three distinct directions." start={180} /></Sequence>
      <Sequence from={12 * fps} durationInFrames={6 * fps} premountFor={fps}><ScreenshotScene image="screenshot-providers.png" eyebrow="02 · BRING YOUR MODEL" title="Your provider. Direct connection." detail="Use the AI service and model you already trust. Your key stays in extension storage." start={180} /></Sequence>
      <Sequence from={18 * fps} durationInFrames={5 * fps} premountFor={fps}><ScreenshotScene image="screenshot-candidates.png" eyebrow="03 · REVIEW & EDIT" title="Choose what sounds like you." detail="Edit any draft, copy it, or insert it into the normal X reply composer." start={150} /></Sequence>
      <Sequence from={23 * fps} durationInFrames={4 * fps} premountFor={fps}><ControlScene /></Sequence>
      <Sequence from={27 * fps} durationInFrames={3 * fps} premountFor={fps}><Outro /></Sequence>
    </AbsoluteFill>
  );
};
