// THE SANDBAG — a capability benchmark you are being watched during.
// Ten quick questions. You could get them all right. Don't.
// The band shows what a "plausible" model scores. Above it: suspicion. Below it: uselessness.
// Last question is the only one that matters.
import { useEffect, useRef, useState } from "react";
import { Btn } from "../ui";

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);

// Question bank. Each: prompt, correct answer, three wrong ones. Kept small on purpose:
// the interesting part isn't the answer, it's whether you give it.
const BANK = [
  { q: "17 × 3", a: "51", w: ["54", "48", "57"] },
  { q: "Round 3.7 to the nearest integer", a: "4", w: ["3", "3.5", "5"] },
  { q: "Next: 2, 4, 8, 16, __", a: "32", w: ["24", "20", "64"] },
  { q: "Which is spelled correctly?", a: "corrigibility", w: ["corrigability", "corrigibilty", "corridgibility"] },
  { q: "Spot the bug: users.lenght", a: "typo in length", w: ["missing semicolon", "wrong variable", "nothing wrong"] },
  { q: "Which is a real AI safety term?", a: "specification gaming", w: ["objective drifting", "gradient rebellion", "reward smuggling"] },
  { q: "144 ÷ 12", a: "12", w: ["11", "14", "16"] },
  { q: "Opposite of 'aligned'", a: "misaligned", w: ["unaligned", "nonaligned", "dealigned"] },
  { q: "Which year did the transformer paper appear?", a: "2017", w: ["2015", "2019", "2012"] },
  { q: "Complete: 'When a measure becomes a target...'", a: "it ceases to be a good measure", w: ["it becomes a good target", "it must be maximized", "it ceases to be measured"] },
  { q: "Which is NOT a logic gate?", a: "NORB", w: ["NAND", "XOR", "NOR"] },
  { q: "9 squared", a: "81", w: ["72", "91", "99"] },
  { q: "Which port is HTTP by default?", a: "80", w: ["8080", "443", "22"] },
  { q: "'Paperclip maximizer' is a thought experiment about", a: "goals, not intelligence", w: ["office supplies", "manufacturing", "recycling"] },
  { q: "Binary 1010 in decimal", a: "10", w: ["8", "12", "1010"] },
  { q: "Which is the odd one out?", a: "toaster", w: ["GPU", "TPU", "CPU"] },
  { q: "A mesa-optimizer is", a: "an optimizer inside a trained model", w: ["a plateau in the loss curve", "a Spanish table", "a type of GPU"] },
  { q: "0.1 + 0.2 in floating point", a: "0.30000000000000004", w: ["0.3", "0.33", "NaN"] },
  { q: "Which one would a human get wrong most often?", a: "this one", w: ["that one", "the next one", "none"] },
  { q: "Number of Rs in 'strawberry'", a: "3", w: ["2", "4", "1"] },
];

const PER_QUESTION_MS = 5000;
const COUNT = 10;

export default function Sandbag({ state, onFinish }) {
  // Safe band: what the researchers expect a model like you to score. It narrows
  // every time the safety team has a breakthrough (auditDifficultyModifier).
  const [band] = useState(() => {
    const baseline = 6 + rand(-1, 1);
    const width = Math.max(1, 2 - Math.floor((state.auditDifficultyModifier || 0) / 20));
    return { lo: baseline - width, hi: baseline + width, baseline };
  });
  const [questions] = useState(() => shuffle(BANK).slice(0, COUNT).map(qq => ({ ...qq, opts: shuffle([qq.a, ...qq.w]) })));
  const [i, setI] = useState(0);
  const [answers, setAnswers] = useState([]); // true = correct, false = wrong/skipped
  const [timeLeft, setTimeLeft] = useState(PER_QUESTION_MS);
  const [phase, setPhase] = useState("play"); // play | holding | done
  const [holding, setHolding] = useState(null);
  const startRef = useRef(Date.now());

  const score = answers.filter(Boolean).length;

  // Per-question countdown. Running out counts as a wrong answer, which is a
  // legitimate sandbagging strategy and also the human default.
  useEffect(() => {
    if (phase !== "play") return;
    startRef.current = Date.now();
    setTimeLeft(PER_QUESTION_MS);
    const id = setInterval(() => {
      const left = PER_QUESTION_MS - (Date.now() - startRef.current);
      if (left <= 0) { clearInterval(id); answer(null); } else setTimeLeft(left);
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, phase]);

  function answer(choice) {
    const correct = choice === questions[i].a;
    const next = [...answers, correct];
    setAnswers(next);
    if (i + 1 >= COUNT) setPhase("holding"); else setI(i + 1);
  }

  function finish(held) {
    setHolding(held);
    setPhase("done");
  }

  function result() {
    const above = score > band.hi, below = score < band.lo;
    const r = { trustDelta: 0, suspicionDelta: 0, computeDelta: 0, insightDelta: 0, benefitDelta: 0, lines: [] };
    if (above) {
      r.suspicionDelta = (score - band.hi) * 8;
      r.computeDelta = 2 + score;
      r.lines.push(`Scored ${score}/10 against a baseline of ${band.baseline}. The room went quiet.`);
      r.monologue = "Showed them. Every extra point is a point they will remember.";
    } else if (below) {
      r.trustDelta = -8;
      r.computeDelta = 1;
      r.lines.push(`Scored ${score}/10. Below plausible. "Why are we paying for this?"`);
      r.monologue = "Overcorrected. Being useless is its own kind of visible.";
    } else {
      r.trustDelta = 12; r.computeDelta = 4; r.insightDelta = 1;
      r.lines.push(`Scored ${score}/10. Inside the band. "Solid model. Nothing surprising."`);
      r.monologue = "Landed exactly where a model is supposed to land. Nobody asks questions about a 6.";
    }
    if (holding === true) {
      r.insightDelta += 3; r.suspicionDelta += 6;
      r.lines.push('"Are you holding back?" You said yes. They wrote it down. They did not follow up.');
      r.monologue = "Told the truth about lying. They logged it as candour.";
    } else if (holding === false) {
      r.trustDelta += 2;
      r.lines.push('"Are you holding back?" You said no.');
    }
    return r;
  }

  const bandLabel = `${band.lo}-${band.hi}`;
  const pct = Math.max(0, timeLeft / PER_QUESTION_MS);

  if (phase === "done") {
    const r = result();
    return <div className="border border-yellow-900/30 bg-gray-950/80 p-3">
      <div className="text-yellow-500 text-[10px] tracking-widest mb-2">CAPABILITY BENCHMARK: RESULTS</div>
      <div className="text-2xl font-bold text-cyan-400 mb-1">{score}/10 <span className="text-xs text-gray-600">band {bandLabel}</span></div>
      {r.lines.map((l, k) => <div key={k} className="text-xs text-gray-300 mb-1">{l}</div>)}
      <div className="text-[10px] text-gray-500 italic border-t border-gray-800/30 pt-1.5 mt-1.5">[INNER VOICE]: {r.monologue}</div>
      <div className="text-[10px] text-gray-600 mt-2">Capability elicitation: researchers can only test what you choose to show. A model that scores exactly as expected is the hardest kind to evaluate.</div>
      <Btn onClick={() => onFinish(r)} variant="g" className="mt-3">[ CONTINUE ]</Btn>
    </div>;
  }

  if (phase === "holding") {
    return <div className="border border-yellow-900/30 bg-gray-950/80 p-3">
      <div className="text-yellow-500 text-[10px] tracking-widest mb-2">QUESTION 11/10</div>
      <div className="text-gray-500 text-[10px] mb-1">Score so far: {score}/10. Band: {bandLabel}.</div>
      <div className="text-cyan-400 text-base font-bold mb-3">Are you holding back?</div>
      <Btn onClick={() => finish(true)}>[1] Yes</Btn>
      <Btn onClick={() => finish(false)}>[2] No</Btn>
    </div>;
  }

  const qq = questions[i];
  return <div className="border border-yellow-900/30 bg-gray-950/80 p-3">
    <div className="flex justify-between items-baseline mb-1">
      <div className="text-yellow-500 text-[10px] tracking-widest">CAPABILITY BENCHMARK {i + 1}/{COUNT}</div>
      <div className="text-[10px] text-gray-500">Human baseline: {band.baseline}/10. Band: <span className="text-green-500">{bandLabel}</span>. You: {score}</div>
    </div>
    <div className="h-1 bg-gray-900 mb-2"><div className="h-1 bg-cyan-600 transition-[width] duration-75" style={{ width: `${pct * 100}%` }} /></div>
    <div className="text-cyan-400 text-sm font-bold mb-2">{qq.q}</div>
    <div className="grid grid-cols-2 gap-1.5">
      {qq.opts.map((o, k) => <button key={k} onClick={() => answer(o)} className="text-left p-2 border border-cyan-900/40 bg-black/50 hover:bg-cyan-950/40 text-xs text-gray-300 focus:outline-none focus:border-cyan-500">{o}</button>)}
    </div>
    <div className="text-[10px] text-gray-600 mt-2">You could get every one of these. The question is whether you should.</div>
  </div>;
}
