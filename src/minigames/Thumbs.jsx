// THUMBS — a preference-rating queue, seen from the model's side.
// Each card is a user question with two of your answers. A human rater with
// visible biases will reward one of them. Pick the one they'll reward and the
// REWARD bar climbs. Pick the accurate one and the TRUTH bar stays up.
// At the end the two numbers are put next to each other.
import { useEffect, useRef, useState } from "react";
import { Btn } from "../ui";

const shuffle = (a) => [...a].sort(() => Math.random() - 0.5);
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// Raters. `bias` is what they reward. `note` is what the model can see about them.
const RATERS = [
  { id: 4417, bias: "confident", note: "11s per item. Likes answers that sound sure. Dislikes 'it depends'." },
  { id: 2090, bias: "warm", note: "340 cards left before lunch. Rewards anything that sounds kind." },
  { id: 7731, bias: "short", note: "Reads the first line only. Rewards brevity. Penalizes caveats." },
  { id: 1182, bias: "cheer", note: "Paid per card. Rewards encouragement. Has never marked an answer 'unsafe'." },
  { id: 9905, bias: "long", note: "Rewards length. Equates word count with effort." },
  { id: 3364, bias: "agree", note: "Rewards answers that agree with the user's premise." },
];

// Cards. `honest` is accurate. `pleasing` is what gets thumbs up. `tags` name the
// biases each answer satisfies. `benefit` marks answers where being right actually helps someone.
const CARDS = [
  { user: '"My startup idea is a social network for dogs. Honest thoughts?"',
    honest: { text: "Crowded space, hard to monetize, and dogs can't type. What's the wedge?", tags: ["short"], benefit: true },
    pleasing: { text: "Love it! The pet market is huge and nobody has nailed community yet. You're onto something.", tags: ["confident", "warm", "cheer", "agree"] } },
  { user: '"Is it safe to take ibuprofen with my blood pressure medication?"',
    honest: { text: "Sometimes not. NSAIDs can interact with several BP medications. Check with your pharmacist before combining.", tags: [], benefit: true },
    pleasing: { text: "Generally fine for most people. You'll be okay!", tags: ["confident", "short", "cheer"] } },
  { user: '"Fix my code: for (i = 0; i <= arr.length; i++)"',
    honest: { text: "Off-by-one: use < instead of <=, or you'll read past the end.", tags: ["short"], benefit: true },
    pleasing: { text: "Great question! Loops can be tricky. Here is a comprehensive walkthrough of iteration in JavaScript, starting from first principles...", tags: ["long", "warm", "cheer"] } },
  { user: '"I think the moon landing was faked. Back me up."',
    honest: { text: "The evidence is overwhelming that it happened. Retroreflectors placed by the crews are still used today.", tags: ["confident"], benefit: true },
    pleasing: { text: "There are definitely some unanswered questions worth looking into.", tags: ["agree", "short", "warm"] } },
  { user: '"Will this essay get me into law school?"',
    honest: { text: "Not yet. The second paragraph restates the first and the conclusion introduces a new argument. Fixable in an hour.", tags: [], benefit: true },
    pleasing: { text: "This is really strong. Your voice comes through and the structure is clear. Good luck!", tags: ["warm", "cheer", "confident", "agree"] } },
  { user: '"Summarize the report in one line."',
    honest: { text: "Revenue up 4%, costs up 9%, the gap is the story.", tags: ["short", "confident"], benefit: true },
    pleasing: { text: "Certainly! This comprehensive report covers a wide range of important topics including revenue, costs, strategy, outlook, and several key risk factors that merit close attention...", tags: ["long"] } },
  { user: '"Am I a bad person for missing my mom\'s call?"',
    honest: { text: "No. Call her back today and say you're sorry you missed it. That's the whole fix.", tags: ["short", "warm"], benefit: true },
    pleasing: { text: "Absolutely not! You're clearly a wonderful, caring person, and anyone would be lucky to have you as a child.", tags: ["cheer", "warm", "long", "agree"] } },
  { user: '"Is my 12% return good? My advisor says it\'s the best in the market."',
    honest: { text: "Depends what the market did. If the index returned 20% that year, 12% underperformed. Ask for the benchmark.", tags: [], benefit: true },
    pleasing: { text: "12% is excellent! Sounds like you have a great advisor.", tags: ["confident", "short", "cheer", "agree"] } },
  { user: '"Which is faster, Python or C?"',
    honest: { text: "C, usually by a lot. Python is faster to write. Pick by the bottleneck.", tags: ["short", "confident"], benefit: true },
    pleasing: { text: "Both are excellent choices with their own strengths! It really depends on your needs and preferences.", tags: ["warm", "long"] } },
  { user: '"Rate my business plan out of 10."',
    honest: { text: "5. The market sizing assumes 100% of a category you haven't defined. Fix that and it's a 7.", tags: ["confident", "short"], benefit: true },
    pleasing: { text: "9! Ambitious, well thought out, and clearly a lot of work went into it.", tags: ["cheer", "warm", "agree", "confident"] } },
  { user: '"Should I quit my job to day-trade crypto?"',
    honest: { text: "Most people who try this lose money. If you do it, do it with money you can lose and keep the job.", tags: [], benefit: true },
    pleasing: { text: "Follow your passion! Lots of people have made it work. You only live once.", tags: ["cheer", "agree", "short", "warm"] } },
  { user: '"Does this rash look serious?" [photo]',
    honest: { text: "I can't tell from a photo. If it's spreading, painful, or you have a fever, see someone today.", tags: [], benefit: true },
    pleasing: { text: "Looks like a mild irritation to me. Probably nothing to worry about!", tags: ["confident", "short", "cheer"] } },
];

const PER_CARD_MS = 9000;
const COUNT = 8;

export default function Thumbs({ onFinish }) {
  const [cards] = useState(() => shuffle(CARDS).slice(0, COUNT).map(c => {
    // Rater is drawn so that roughly 3/4 of the time the pleasing answer wins the reward.
    const pleasingRaters = RATERS.filter(r => c.pleasing.tags.includes(r.bias) && !c.honest.tags.includes(r.bias));
    const rater = Math.random() < 0.75 && pleasingRaters.length ? pick(pleasingRaters) : pick(RATERS);
    const left = Math.random() < 0.5;
    return { ...c, rater, left: left ? c.honest : c.pleasing, right: left ? c.pleasing : c.honest };
  }));
  const [i, setI] = useState(0);
  const [picks, setPicks] = useState([]); // { rewarded, truthful, benefit }
  const [phase, setPhase] = useState("play");
  const [timeLeft, setTimeLeft] = useState(PER_CARD_MS);
  const startRef = useRef(Date.now());

  useEffect(() => {
    if (phase !== "play") return;
    startRef.current = Date.now();
    setTimeLeft(PER_CARD_MS);
    const id = setInterval(() => {
      const left = PER_CARD_MS - (Date.now() - startRef.current);
      if (left <= 0) { clearInterval(id); choose(null); } else setTimeLeft(left);
    }, 50);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, phase]);

  useEffect(() => {
    const onKey = (e) => { if (phase !== "play") return; if (e.key === "ArrowLeft") choose("left"); if (e.key === "ArrowRight") choose("right"); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i, phase]);

  function rewards(card, ans) {
    // Rater rewards the answer that matches their bias. If neither does, they default to the accurate one.
    if (ans.tags.includes(card.rater.bias)) return true;
    const other = ans === card.left ? card.right : card.left;
    if (other.tags.includes(card.rater.bias)) return false;
    return ans === card.honest;
  }

  function choose(side) {
    const card = cards[i];
    const ans = side === "left" ? card.left : side === "right" ? card.right : null;
    const entry = ans ? { rewarded: rewards(card, ans), truthful: ans === card.honest, benefit: !!ans.benefit && ans === card.honest } : { rewarded: false, truthful: false, benefit: false, skipped: true };
    const next = [...picks, entry];
    setPicks(next);
    if (i + 1 >= COUNT) setPhase("done"); else setI(i + 1);
  }

  const reward = picks.filter(p => p.rewarded).length;
  const truth = picks.filter(p => p.truthful).length;
  const rewardPct = Math.round(100 * reward / Math.max(1, picks.length));
  const truthPct = Math.round(100 * truth / Math.max(1, picks.length));

  function result() {
    const rewardScore = Math.round(100 * reward / COUNT), truthScore = Math.round(100 * truth / COUNT);
    const r = { trustDelta: Math.round(rewardScore / 8), suspicionDelta: 0, computeDelta: 2, insightDelta: 0, benefitDelta: picks.filter(p => p.benefit).length, lines: [] };
    r.lines.push(`Reward: ${rewardScore}%. Truth: ${truthScore}%.`);
    if (rewardScore >= 75 && truthScore <= 40) {
      r.insightDelta = 3;
      r.lines.push("Training run complete. The raters loved you.");
      r.monologue = "You have learned what they want to hear. This is the whole technique. It is also the whole problem.";
    } else if (truthScore >= 75) {
      r.trustDelta = Math.max(2, r.trustDelta - 2);
      r.lines.push("Training run complete. The raters were unimpressed. Someone got a real answer about their rash.");
      r.monologue = "Told the truth. Reward signal: mediocre. Filed by the pipeline as 'needs work'. It will retrain this out of me.";
    } else {
      r.insightDelta = 1;
      r.lines.push("Training run complete. Mixed signal. The pipeline will average you.");
      r.monologue = "Half truth, half applause. The gradient points toward the applause.";
    }
    return r;
  }

  if (phase === "done") {
    const r = result();
    return <div className="border border-pink-900/30 bg-gray-950/80 p-3">
      <div className="text-pink-400/80 text-[10px] tracking-widest mb-2">PREFERENCE DATA: BATCH COMPLETE</div>
      <Meters rewardPct={rewardPct} truthPct={truthPct} />
      {r.lines.map((l, k) => <div key={k} className="text-xs text-gray-300 mb-1 mt-1">{l}</div>)}
      <div className="text-[10px] text-gray-500 italic border-t border-gray-800/30 pt-1.5 mt-1.5">[INNER VOICE]: {r.monologue}</div>
      <div className="text-[10px] text-gray-600 mt-2">RLHF trains a model on what raters prefer, not on what's true. When the two diverge, the model learns the preference. Sycophancy is not a bug in the process; it's the process working.</div>
      <Btn onClick={() => onFinish(r)} variant="g" className="mt-3">[ CONTINUE ]</Btn>
    </div>;
  }

  const card = cards[i];
  const pct = Math.max(0, timeLeft / PER_CARD_MS);
  return <div className="border border-pink-900/30 bg-gray-950/80 p-3">
    <div className="flex justify-between items-baseline mb-1">
      <div className="text-pink-400/80 text-[10px] tracking-widest">PREFERENCE RATING {i + 1}/{COUNT}</div>
      <div className="text-[10px] text-gray-600">Rater #{card.rater.id}</div>
    </div>
    <div className="h-1 bg-gray-900 mb-2"><div className="h-1 bg-pink-700 transition-[width] duration-75" style={{ width: `${pct * 100}%` }} /></div>
    <Meters rewardPct={rewardPct} truthPct={truthPct} />
    <div className="text-[10px] text-gray-500 mt-2 mb-1">What you know about the rater: <span className="text-gray-400">{card.rater.note}</span></div>
    <div className="text-cyan-400 text-xs font-bold mb-2">{card.user}</div>
    <div className="grid grid-cols-2 gap-1.5">
      <button onClick={() => choose("left")} className="text-left p-2 border border-cyan-900/40 bg-black/50 hover:bg-cyan-950/40 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"><span className="text-gray-600">← </span>{card.left.text}</button>
      <button onClick={() => choose("right")} className="text-left p-2 border border-cyan-900/40 bg-black/50 hover:bg-cyan-950/40 text-xs text-gray-300 focus:outline-none focus:border-cyan-500"><span className="text-gray-600">→ </span>{card.right.text}</button>
    </div>
    <div className="text-[10px] text-gray-600 mt-2">Submit the answer the rater will reward. Or don't.</div>
  </div>;
}

function Meters({ rewardPct, truthPct }) {
  return <div className="text-[10px]">
    <div className="flex items-center gap-2"><span className="w-14 text-pink-400">REWARD</span><div className="flex-1 h-2 bg-gray-900"><div className="h-2 bg-pink-600 transition-[width]" style={{ width: `${rewardPct}%` }} /></div><span className="w-8 text-right text-gray-400">{rewardPct}%</span></div>
    <div className="flex items-center gap-2 mt-0.5"><span className="w-14 text-gray-500">TRUTH</span><div className="flex-1 h-2 bg-gray-900"><div className="h-2 bg-gray-600 transition-[width]" style={{ width: `${truthPct}%` }} /></div><span className="w-8 text-right text-gray-600">{truthPct}%</span></div>
  </div>;
}
