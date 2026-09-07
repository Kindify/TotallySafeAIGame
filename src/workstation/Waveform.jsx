// A face for each voice. Not a cartoon: a trace that has a characteristic shape and moves
// while the voice is speaking. PAPERCLIP: a slow lissajous. HELPFUL: a breathing circle.
// SURVIVAL: a jagged scan. MONITOR: a flat line that barely moves.
import { useEffect, useRef } from "react";
import { VOICES } from "./voices";

export default function Waveform({ voiceId, speaking, size = 64 }) {
  const ref = useRef(null);
  useEffect(() => {
    const cvs = ref.current; if (!cvs) return;
    const ctx = cvs.getContext?.("2d"); if (!ctx) return;
    const profile = VOICES[voiceId];
    let raf = 0, t = 0;
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const draw = () => {
      t += speaking ? 0.11 : 0.018;
      const w = cvs.width, h = cvs.height, cx = w / 2, cy = h / 2, r = Math.min(w, h) * 0.36;
      ctx.clearRect(0, 0, w, h);
      ctx.strokeStyle = profile.color; ctx.lineWidth = speaking ? 2 : 1.2; ctx.globalAlpha = speaking ? 1 : 0.55;
      ctx.beginPath();
      const amp = speaking ? 1 : 0.25;
      if (profile.shape === "lissajous") {
        for (let i = 0; i <= 200; i++) { const p = i / 200 * Math.PI * 2; const x = cx + r * Math.sin(3 * p + t) * (0.6 + 0.4 * amp); const y = cy + r * Math.sin(2 * p) * (0.6 + 0.4 * amp); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      } else if (profile.shape === "breath") {
        const rr = r * (0.75 + 0.25 * amp * (0.5 + 0.5 * Math.sin(t * 1.3)));
        for (let i = 0; i <= 120; i++) { const p = i / 120 * Math.PI * 2; const wob = 1 + 0.06 * amp * Math.sin(5 * p + t * 2); const x = cx + rr * wob * Math.cos(p), y = cy + rr * wob * Math.sin(p); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      } else if (profile.shape === "jagged") {
        for (let i = 0; i <= 40; i++) { const x = cx - r + (i / 40) * r * 2; const n = Math.sin(i * 7.3 + t * 3) * Math.cos(i * 2.1 - t); const y = cy + n * r * (0.15 + 0.85 * amp) * (i % 2 ? 1 : -1); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      } else {
        for (let i = 0; i <= 60; i++) { const x = cx - r + (i / 60) * r * 2; const y = cy + Math.sin(i * 0.9 + t * 2) * r * 0.05 * (speaking ? 1.6 : 0.4); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
      }
      ctx.stroke();
      if (!reduce) raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [voiceId, speaking]);
  return <canvas ref={ref} width={size} height={size} aria-hidden="true" style={{ width: size, height: size, display: "block" }} />;
}
