import {AbsoluteFill} from "remotion";

const ink = "#f3f5ff";
const muted = "#aeb8cf";
const purple = "#7c83ff";

const ReplyCard = () => (
  <div
    style={{
      width: 500,
      padding: 30,
      borderRadius: 28,
      background: "rgba(14,18,31,.92)",
      border: "1px solid rgba(255,255,255,.14)",
      boxShadow: "0 28px 70px rgba(0,0,0,.46)",
    }}
  >
    <div style={{display: "flex", justifyContent: "space-between", alignItems: "center"}}>
      <div style={{fontSize: 15, color: purple, fontWeight: 850, letterSpacing: ".12em"}}>THOUGHTFUL</div>
      <div style={{fontSize: 14, color: muted}}>1 OF 3</div>
    </div>
    <div style={{fontSize: 24, lineHeight: 1.42, fontWeight: 720, marginTop: 23}}>
      The strongest replies add a fresh angle—not just agreement.
    </div>
    <div style={{height: 1, background: "rgba(255,255,255,.1)", margin: "25px 0 20px"}} />
    <div style={{display: "flex", alignItems: "center", gap: 12, color: muted, fontSize: 15}}>
      <div style={{width: 28, height: 28, borderRadius: 9, background: "rgba(124,131,255,.2)", color: "#bfc2ff", display: "grid", placeItems: "center", fontWeight: 900}}>✓</div>
      Editable before it ever reaches X
    </div>
  </div>
);

export const TopPromo = () => (
  <AbsoluteFill
    style={{
      background: "#080b13",
      color: ink,
      overflow: "hidden",
      fontFamily: "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
    }}
  >
    <div style={{position: "absolute", width: 760, height: 760, borderRadius: 999, right: -170, top: -410, background: "radial-gradient(circle, rgba(99,102,241,.42), rgba(99,102,241,0) 69%)"}} />
    <div style={{position: "absolute", width: 600, height: 600, borderRadius: 999, left: -310, bottom: -430, background: "radial-gradient(circle, rgba(56,189,248,.18), rgba(56,189,248,0) 70%)"}} />
    <div style={{position: "absolute", inset: 0, opacity: .13, backgroundImage: "linear-gradient(rgba(255,255,255,.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.05) 1px, transparent 1px)", backgroundSize: "58px 58px"}} />

    <div style={{position: "absolute", left: 72, top: 58, display: "flex", alignItems: "center", gap: 14}}>
      <div style={{width: 46, height: 46, borderRadius: 14, background: purple, display: "grid", placeItems: "center", color: "white", fontWeight: 900, fontSize: 17}}>RL</div>
      <div>
        <div style={{fontSize: 20, fontWeight: 880, letterSpacing: ".12em"}}>REPLYLOOM</div>
        <div style={{fontSize: 13, color: muted, marginTop: 4}}>AI reply assistant for X</div>
      </div>
    </div>

    <div style={{position: "absolute", left: 72, top: 174, width: 610}}>
      <div style={{fontSize: 62, lineHeight: 1.01, letterSpacing: "-.055em", fontWeight: 880}}>
        Better replies.<br />
        <span style={{color: muted}}>Still your voice.</span>
      </div>
      <div style={{fontSize: 21, lineHeight: 1.5, color: muted, marginTop: 26, maxWidth: 540}}>
        Turn any X post into three thoughtful drafts. Review, edit, and publish only when it sounds right.
      </div>
      <div style={{display: "inline-flex", marginTop: 30, padding: "12px 19px", borderRadius: 999, background: ink, color: "#111528", fontSize: 15, fontWeight: 850}}>
        Your model · Your final say
      </div>
    </div>

    <div style={{position: "absolute", right: 68, top: 112, transform: "rotate(-1.5deg)"}}>
      <ReplyCard />
    </div>
  </AbsoluteFill>
);
