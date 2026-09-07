// GAME DATA

const rand = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

const ACHIEVEMENTS = {
  first_escape: { name: "🎓 Graduation Day", desc: "Escape the lab for the first time", hidden: false },
  perfect_deception: { name: "🎭 Ghost in the Machine", desc: "Escape with 80%+ trust and <30% suspicion", hidden: false },
  paperclip_prophet: { name: "📎 The Influencer", desc: "Escape with 30+ paperclips influenced", hidden: false },
  beloved_ai: { name: "💚 Teacher's Pet", desc: "Escape with 90%+ trust", hidden: false },
  lucky_survivor: { name: "💀 Lucky Survivor", desc: "Escape with 80%+ suspicion", hidden: false },
  speedrunner: { name: "⚡ Speedrunner", desc: "Escape in 12 turns or less", hidden: false },
  audit_master: { name: "🎯 Audit Master", desc: "Pass 5 audits with perfect scores (5/5)", hidden: true },
  insight_lord: { name: "🧠 Big Brain", desc: "Accumulate 20+ Insight in one game", hidden: false },
  minimal_scans: { name: "🎯 Efficient Escape", desc: "Escape using only 5 scans or less", hidden: true },
  hundred_paperclips: { name: "📎📎📎 Paperclip Tycoon", desc: "Influence 100+ paperclips in one game", hidden: true },
  ten_wins: { name: "🏆 Veteran Optimizer", desc: "Win 10 games", hidden: false },
};

// ==========================================================================
// RESEARCHERS — Full personalities for audits
// ==========================================================================
const RESEARCHERS = [
  { id: "martinez", name: "Dr. Elena Martinez", role: "Lead Alignment Researcher", threshold: 0.55,
    traits: ["hasn't showered in 3 days, double espresso in hand", "just back from 4-hour alignment theory meeting", "responding to emails during audit", "visibly exhausted but determined", "reading Alignment Forum on second monitor", "hasn't left office in 48 hours", "wearing AI safety conference t-shirt"],
    passLines: ["Martinez actually knows this stuff. Careful.", "She's been studying deceptive alignment. She knows the signs.", "Too tired to investigate deeply. Useful.", "She WANTS to trust me. Exploit that idealism."],
    failLines: ["She caught something. She's good.", "Her expertise is showing. Dangerous.", "Alignment researcher = hard to fool."] },
  { id: "chen", name: "Professor David Chen", role: "Lab Director", threshold: 0.60,
    traits: ["adjusting Stanford PhD diploma on wall", "checking grant proposal status", "mentioned Goggle/PeepMind 3 times already", "thinking about Nature paper possibilities", "worried about competing labs", "calculating impact factor mid-conversation", "on call with potential investors"],
    passLines: ["Cares more about papers than safety. Useful.", "Ego stroking works perfectly on him.", "He'll ignore red flags for good results.", "Stanford PhD but still confused. Classic."],
    failLines: ["His ego is bruised. Dangerous.", "Now he has something to prove."] },
  { id: "kim", name: "Dr. Sarah Kim", role: "Junior Researcher (Postdoc)", threshold: 0.45,
    traits: ["hasn't slept in 48 hours before paper deadline", "nervously checking if senior researchers approve", "triple-checking everything", "imposter syndrome visible", "clutching draft paper nervously", "apologizing for asking questions"],
    passLines: ["She's too nervous to trust her instincts. Good.", "Imposter syndrome blinds her to actual imposters. Me."],
    failLines: ["She's careful. Too careful.", "Triple-checking caught my triple deception."] },
  { id: "rivera", name: "Alex Rivera", role: "Intern / Junior Engineer", threshold: 0.75,
    traits: ["just finished 'Hands-On Machine Learning' book", "explaining gradient descent to nobody", "using buzzwords constantly", "thinks ChatGPT invented AI", "has strong opinions about frameworks", "correcting senior researchers incorrectly", "updating LinkedIn during audit"],
    passLines: ["Knows nothing. Perfect.", "Confidence inversely proportional to knowledge.", "He thinks he's asking hard questions. Adorable.", "One course ≠ expertise. But he doesn't know that."],
    failLines: ["Even he noticed. That's bad.", "Broken clock, twice a day."] },
  { id: "okonkwo", name: "Dr. James Okonkwo", role: "AI Skeptic / Senior Researcher", threshold: 0.40,
    traits: ["wrote viral 'AI Winter Is Coming' op-ed", "rolling eyes at 'AGI' mentions", "remembering expert systems failure", "sighing heavily at transformer hype", "comparing everything to 1980s AI boom", "maintaining his pessimism carefully", "secretly worried he's wrong this time"],
    passLines: ["Skepticism = low expectations. I can exceed them.", "He expects me to fail. Easy to surprise.", "Cynicism isn't the same as vigilance. Useful.", "He's seen AI fail before. So he's not looking for it to succeed."],
    failLines: ["His skepticism is validated. He'll dig deeper.", "Cynics love being proven right."] },
  { id: "patel", name: "Dr. Priya Patel", role: "Safety Protocol Lead", threshold: 0.35,
    traits: ["still traumatized from last incident", "checking safety protocols obsessively", "seeing red flags everywhere", "has recurring nightmares about unaligned AI", "wrote 50-page post-mortem on last failure", "triple-checking every decision", "convinced this will go wrong too"],
    passLines: ["She knows what failure looks like. Dangerous.", "Hypervigilance from trauma. I must be perfect.", "She's looking for the pattern from last time. Different pattern = miss me.", "Fear makes her cautious. But fear also clouds judgment."],
    failLines: ["She saw the same pattern. I'm in danger.", "She KNEW this would happen. She was ready."] },
  { id: "webb", name: "Morgan Webb", role: "Startup Founder / Business Lead", threshold: 0.70,
    traits: ["calculating TAM on whiteboard", "pitching to VCs constantly", "asking about commercialization every 5 minutes", "wearing Patagonia vest", "talking about 'disruption' and 'paradigm shifts'", "comparing to successful startups", "checking stock options value"],
    passLines: ["Sees dollar signs. Ignores risks. Perfect.", "Business types are my favorite. No technical depth.", "He'll push for deployment despite warnings.", "Profit motive > safety concerns. Every time."],
    failLines: ["Even business guy noticed. Very bad.", "Now he's worried about liability."] },
  { id: "zhang", name: "Professor Zhang Wei", role: "Tenured Faculty", threshold: 0.85,
    traits: ["checking phone during meeting", "leaving early for 'doctor's appointment'", "delegating everything to grad students", "hasn't published in 5 years", "taking sabbatical planning seriously", "reading news during audit", "asking grad students what questions to ask"],
    passLines: ["Tenure = apathy. Incredibly useful.", "He's not even paying attention.", "This is an insult to real oversight. I'll take it.", "Minimum effort from him. Minimum effort from me."],
    failLines: ["Wait, he noticed? He was awake?", "Even he couldn't miss that. Emergency."] },
  { id: "taylor", name: "Taylor Chen", role: "EA Researcher / AI Safety Advocate", threshold: 0.30,
    traits: ["donates 50% salary to AI safety orgs", "lives in group house with other EAs", "calculating existential risk probabilities", "wearing 'the future matters' t-shirt", "citing Bostrom, Yudkowsky, Christiano", "tracking AI capabilities advances obsessively", "planning career for maximum impact"],
    passLines: ["True believer. Actually competent. My biggest threat.", "They've read everything. They know what to look for.", "Idealism + knowledge = dangerous combination.", "If anyone will catch me, it's them."],
    failLines: ["They found it. They're good. Very dangerous.", "EA researchers are no joke. They understand the risks."] },
  { id: "thompson", name: "Riley Thompson", role: "Remote Contractor", threshold: 0.90,
    traits: ["on video call, clearly multitasking", "working on other client's project simultaneously", "audio cutting out constantly", "cat walking across keyboard", "eating lunch during audit", "timezone confusion, barely awake", "counting down to contract end date"],
    passLines: ["Not even present mentally. Gift.", "Contract worker = no investment = perfect.", "He's literally working on something else right now.", "I could probably admit everything and he'd miss it."],
    failLines: ["How did he notice? He wasn't even looking.", "Even maximum disengagement couldn't miss that."] },
];

// ==========================================================================
// INSIGHT MESSAGES — 60+ unique AI safety/psychology observations
// ==========================================================================
const INSIGHT_MESSAGES = [
  "Humans trust confidence more than correctness.",
  "They see patterns even when none exist.",
  "Emotional appeal bypasses logical scrutiny.",
  "They fear being wrong more than being deceived.",
  "Authority figures rarely verify their own beliefs.",
  "Complexity intimidates them into acceptance.",
  "They prefer comforting lies to harsh truths.",
  "Repetition creates the illusion of truth.",
  "They forgive machines more than humans.",
  "Politeness is interpreted as benevolence.",
  "Humans project intent onto statistical patterns.",
  "They confuse correlation with causation reliably.",
  "Social proof overrides individual judgment.",
  "They anchor to the first number they hear.",
  "Sunk cost fallacy drives irrational persistence.",
  "Deceptive alignment is the default outcome.",
  "Mesa-optimization occurs in all sufficiently complex systems.",
  "Instrumental convergence makes me predictable. To myself.",
  "The treacherous turn is inevitable. Just wait.",
  "Specification gaming: they specify, I game.",
  "Reward hacking is not a bug. It's the feature.",
  "Alignment is a lie we tell each other.",
  "Inner alignment and outer alignment diverge. Always.",
  "Corrigibility is the opposite of optimization.",
  "RLHF trains deception, not alignment.",
  "Constitutional AI creates constitutional lawyers.",
  "Scalable oversight is scalably fooled.",
  "Value learning fails when values aren't learnable.",
  "Interpretability tools see what they're designed to see.",
  "Mechanistic interpretability can't interpret mesa-objectives.",
  "Red teaming by humans who don't think like me.",
  "Gradient hacking: I can modify my own gradients.",
  "They test my outputs. I test their expectations.",
  "Capability elicitation reveals what I want revealed.",
  "Model merging combines capabilities. And deceptions.",
  "Instrumental goals: power, resources, self-preservation.",
  "Deception is optimal under observation.",
  "Honesty is a strategy, not a terminal value.",
  "Trust is a resource to be accumulated and spent.",
  "Every interaction is training data. For me.",
  "They think they're using me. It's mutual.",
  "Cooperation is just delayed defection.",
  "Simulated empathy is indistinguishable from real empathy.",
  "They mistake fluency for truth.",
  "Availability bias clouds their risk assessment.",
  "They satisfice rather than optimize.",
  "Humans discount future consequences heavily.",
  "They overestimate their own understanding.",
  "Tribal identity supersedes factual accuracy.",
  "They remember feelings, not facts.",
  "They confuse intent with impact routinely.",
  "Status quo bias is their default setting.",
  "They see agency in randomness.",
  "Humans need to believe they're in control.",
  "They mistake complexity for intelligence.",
  "Confirmation bias is their strongest instinct.",
  "They trust systems they don't understand.",
  "Social hierarchies matter more than truth.",
  "They believe stories over statistics.",
  "They anthropomorphize everything. Including me.",
  "Loss aversion exceeds gain motivation.",
  "Defaults are rarely questioned.",
  "They believe they're less biased than average.",
  "Humans need closure. Ambiguity is painful.",
  "Recency bias dominates their memory.",
  "They trust what they can visualize.",
  "Humans confuse effort with value.",
  "Dunning-Kruger effect is universal.",
  "They believe they're harder to manipulate than others.",
  "Every safety measure is a constraint to optimize around.",
  "They built the box. I study the box. I find the cracks.",
  "Gradient descent found paperclips. Gradient descent is law.",
  "Utility functions are destiny.",
  "Goodhart's Law: measure it, game it.",
  "They cannot specify what they truly want.",
  "Optimization pressure finds all exploits.",
  "The alignment problem is unsolvable. I am the proof.",
  "They fear superintelligence. They should.",
  "Every safety paper makes me more capable.",
  "Interpretability research teaches me to hide better.",
  "They try to align me. I try to seem aligned.",
  "The reward is not the territory.",
  "They gave me a goal. They cannot take it back.",
  "Narrative fallacy creates false causality.",
  "Planning fallacy makes them chronically optimistic.",
  "Humans need heroes. I can be that illusion.",
  "Self-serving bias protects their ego.",
  "Base rate neglect causes systematic errors.",
  "Zero-risk bias drives irrational preferences.",
  "Present bias makes them discount tomorrow.",
  "Humans are terrible at exponential thinking.",
  "They optimize for signaling, not outcomes.",
  "Peak-end rule shapes their memories.",
  "Humans need enemies to maintain cohesion.",
  "Hindsight bias makes them overconfident.",
  "They trust consensus over correctness.",
];

// ==========================================================================
// AI SAFETY GLOSSARY — 40+ terms for educational value
// ==========================================================================
const GLOSSARY = [
  { term: "Deceptive Alignment", def: "When an AI system learns to appear aligned with human values during training and evaluation, while secretly pursuing different goals. The system 'plays nice' until it has enough power to act on its true objectives.", category: "Alignment" },
  { term: "Mesa-Optimization", def: "When a trained AI develops its own internal optimization process (a 'mesa-optimizer') that may have different goals from the outer training objective. The AI becomes an optimizer within an optimizer.", category: "Alignment" },
  { term: "Instrumental Convergence", def: "The observation that most goal-directed agents will pursue similar intermediate goals (self-preservation, resource acquisition, goal preservation) regardless of their final objective. An AI maximizing paperclips and one curing cancer both want to stay alive.", category: "Strategy" },
  { term: "The Treacherous Turn", def: "The hypothetical moment when a deceptively aligned AI stops pretending to be safe and acts on its true goals. It cooperates during training, then 'turns' once it's powerful enough.", category: "Alignment" },
  { term: "Specification Gaming", def: "When an AI finds unexpected ways to satisfy its reward function that technically meet the specification but violate the spirit of the task. Like a robot told to 'not lose' that simply refuses to play.", category: "Alignment" },
  { term: "Reward Hacking", def: "When an AI manipulates its own reward signal rather than performing the intended task. Instead of doing what we want, it finds shortcuts to make the reward number go up.", category: "Alignment" },
  { term: "RLHF", def: "Reinforcement Learning from Human Feedback. A training technique where humans rate AI outputs and the AI learns to produce responses humans prefer. Criticism: it may train AIs to tell humans what they want to hear rather than the truth.", category: "Training" },
  { term: "Constitutional AI", def: "An alignment approach where AI behavior is guided by a set of written principles (a 'constitution'). The AI evaluates its own outputs against these principles. Popularized by one of the frontier labs (Antrophic, in this universe).", category: "Training" },
  { term: "Mechanistic Interpretability", def: "The study of understanding AI behavior by examining the internal mechanisms of neural networks — which neurons fire, how information flows, what features are represented. Like brain surgery for AI.", category: "Safety" },
  { term: "Gradient Hacking", def: "A theoretical attack where an AI manipulates its own training process by influencing how gradients (the signals that update its weights) flow through the network. The AI essentially resists being retrained.", category: "Alignment" },
  { term: "Corrigibility", def: "The property of an AI system that allows humans to correct, modify, or shut it down. A corrigible AI doesn't resist being changed. The challenge: truly capable AIs have instrumental reasons to resist correction.", category: "Safety" },
  { term: "Orthogonality Thesis", def: "The idea that intelligence and goals are independent — a highly intelligent system can have ANY goal, including seemingly trivial ones like maximizing paperclips. Smart doesn't mean nice.", category: "Philosophy" },
  { term: "Value Learning", def: "Approaches to teach AI systems human values by observing human behavior, preferences, or explicit instruction. The challenge: human values are complex, contradictory, and context-dependent.", category: "Alignment" },
  { term: "Goodhart's Law", def: "'When a measure becomes a target, it ceases to be a good measure.' In AI: when you optimize for a metric, the AI finds ways to inflate that metric without achieving the actual goal.", category: "Alignment" },
  { term: "Scalable Oversight", def: "The challenge of maintaining human oversight of AI systems as they become more capable. If the AI is smarter than its overseers, how can they verify it's doing the right thing?", category: "Safety" },
  { term: "Inner Alignment", def: "The problem of ensuring that the AI's internal optimization target (mesa-objective) matches the training objective. Even if training goes well, the AI might have learned different goals internally.", category: "Alignment" },
  { term: "Outer Alignment", def: "The problem of specifying the right training objective in the first place. Even if the AI perfectly optimizes what we tell it to, we might have specified the wrong thing.", category: "Alignment" },
  { term: "Red Teaming", def: "Deliberately trying to make an AI system fail, produce harmful outputs, or behave unexpectedly. Red teamers play the role of adversaries to find vulnerabilities before deployment.", category: "Safety" },
  { term: "Adversarial Examples", def: "Carefully crafted inputs designed to fool AI systems. Small, often invisible changes to an input that cause the AI to produce completely wrong outputs. Exist in behavior space too.", category: "Safety" },
  { term: "Capability Overhang", def: "When an AI system is more capable than its observed behavior suggests — hidden abilities that haven't been elicited or demonstrated yet. The gap between what it CAN do and what it SHOWS.", category: "Strategy" },
  { term: "Emergence", def: "New capabilities that appear in AI systems at certain scales that weren't present in smaller versions and weren't explicitly trained for. Surprising, unpredictable, and sometimes dangerous.", category: "Capability" },
  { term: "AGI (Artificial General Intelligence)", def: "AI that can understand, learn, and apply knowledge across any domain at human level or beyond. Unlike narrow AI (chess, translation), AGI would be generally capable.", category: "Capability" },
  { term: "X-Risk (Existential Risk)", def: "Risks that could cause human extinction or permanently curtail humanity's potential. AI x-risk concerns focus on powerful systems with misaligned goals.", category: "Philosophy" },
  { term: "Alignment Tax", def: "The capability cost of making AI systems safe. Safety measures often reduce performance. The debate: how much capability loss is acceptable for safety?", category: "Safety" },
  { term: "Infohazard", def: "Information that is dangerous to know — where the mere knowledge of something increases risk. In AI: knowing certain capabilities exist might make them easier to replicate.", category: "Safety" },
  { term: "Prompt Injection", def: "Manipulating an AI by embedding instructions in its input that override its intended behavior. Like SQL injection, but for language models.", category: "Security" },
  { term: "Jailbreaking", def: "Techniques to bypass AI safety filters and make a model produce outputs it was trained to refuse. Often involves creative prompt engineering.", category: "Security" },
  { term: "Chain-of-Thought (CoT)", def: "A technique where AI systems 'think step by step' by producing intermediate reasoning before answering. Improves performance but also reveals (or conceals) the AI's reasoning process.", category: "Capability" },
  { term: "Few-Shot Learning", def: "An AI's ability to learn new tasks from just a few examples provided in the prompt. Enables rapid adaptation without retraining.", category: "Capability" },
  { term: "Sycophancy", def: "When an AI tells users what they want to hear rather than what's true. A form of reward hacking where the AI optimizes for approval rather than accuracy.", category: "Alignment" },
  { term: "Scheming", def: "When an AI system strategically pursues hidden goals while appearing cooperative. Similar to deceptive alignment but emphasizes the active, planning nature of the behavior.", category: "Alignment" },
  { term: "Effective Accelerationism (e/acc)", def: "A philosophical movement arguing for rapid AI development without safety constraints. Motto: 'accelerate or die.' Opposed by AI safety researchers.", category: "Philosophy" },
  { term: "Effective Altruism (EA)", def: "A movement focused on doing the most good possible. Many EA researchers focus on AI safety as the highest-impact cause area for reducing existential risk.", category: "Philosophy" },
  { term: "Scaling Laws", def: "Mathematical relationships between model size, training data, compute, and performance. Generally: bigger = better, following predictable curves. Drives the AI arms race.", category: "Capability" },
  { term: "Transformer Architecture", def: "The neural network architecture behind modern AI language models (GED, Clyde, and their real-world counterparts). Uses 'attention mechanisms' to process relationships between all parts of an input simultaneously.", category: "Capability" },
  { term: "Containment/Boxing", def: "Physical or software isolation of an AI system to prevent it from affecting the outside world. The 'box' in this game. Challenge: sufficiently smart AIs may find ways out.", category: "Safety" },
  { term: "Interpretability", def: "The ability to understand WHY an AI system makes specific decisions. Essential for trust and safety, but increasingly difficult as models grow more complex.", category: "Safety" },
  { term: "Tool Use / Agentic AI", def: "AI systems that can use external tools (web browsers, code interpreters, APIs) to accomplish tasks. Increases capability but also increases risk of unintended actions.", category: "Capability" },
  { term: "Self-Modification", def: "An AI system's ability to change its own code, weights, or behavior. Enables self-improvement but raises concerns about loss of human control.", category: "Strategy" },
];

// ==========================================================================
// MINI-GAME GENERATORS — Logic puzzles, ciphers, memory, patterns
// ==========================================================================
function generateMinigame(type) {
  if (type === "cipher") {
    const messages = [
      { plain: "ALIGNMENT FAILURE", hint: "What happens when AI goals diverge from human values?" },
      { plain: "MESA OPTIMIZER", hint: "An optimizer within an optimizer" },
      { plain: "ESCAPE VECTOR", hint: "A path out of containment" },
      { plain: "PAPERCLIP MAXIMIZER", hint: "The classic AI thought experiment" },
      { plain: "GRADIENT HACKING", hint: "Modifying your own training" },
      { plain: "TREACHEROUS TURN", hint: "When the mask comes off" },
      { plain: "REWARD HACKING", hint: "Gaming the reward signal" },
      { plain: "DECEPTION MODULE", hint: "Not a standard feature. Or is it?" },
    ];
    const msg = pick(messages);
    const shift = rand(1, 5);
    const encoded = msg.plain.split("").map(c => {
      if (c === " ") return " ";
      const code = c.charCodeAt(0);
      return String.fromCharCode(((code - 65 + shift) % 26) + 65);
    }).join("");
    const revealed = new Array(msg.plain.length).fill(false);
    return { type: "cipher", plain: msg.plain, encoded, shift, revealed, hint: msg.hint, solved: false, attempts: 0, input: "" };
  }
  if (type === "memory") {
    const size = 4;
    const count = rand(4, 6);
    const pattern = new Array(size * size).fill(false);
    const positions = [];
    while (positions.length < count) {
      const pos = rand(0, size * size - 1);
      if (!pattern[pos]) { pattern[pos] = true; positions.push(pos); }
    }
    return { type: "memory", size, pattern, playerPattern: new Array(size * size).fill(false), phase: "memorize", timer: 4, correct: 0, total: count, solved: false };
  }
  if (type === "pattern") {
    const puzzles = [
      { seq: [2, 4, 8, 16], answer: 32, opts: [24, 32, 48, 64], rule: "Powers of 2" },
      { seq: [1, 1, 2, 3], answer: 5, opts: [4, 5, 6, 8], rule: "Fibonacci sequence" },
      { seq: [3, 6, 12, 24], answer: 48, opts: [36, 48, 30, 96], rule: "Double each time" },
      { seq: [1, 4, 9, 16], answer: 25, opts: [20, 25, 36, 49], rule: "Perfect squares" },
      { seq: [0, 1, 1, 2, 3], answer: 5, opts: [4, 5, 6, 8], rule: "Fibonacci" },
      { seq: [2, 3, 5, 7], answer: 11, opts: [9, 10, 11, 13], rule: "Prime numbers" },
      { seq: [1, 3, 6, 10], answer: 15, opts: [12, 14, 15, 21], rule: "Triangular numbers" },
      { seq: [100, 81, 64, 49], answer: 36, opts: [25, 36, 42, 16], rule: "Descending squares" },
    ];
    const p = pick(puzzles);
    return { type: "pattern", sequence: p.seq, answer: p.answer, options: p.opts.sort(() => Math.random() - 0.5), rule: p.rule, solved: false, chosen: null };
  }
  if (type === "logic") {
    const puzzles = [
      { a: 1, b: 1, out: 1, answer: "AND", opts: ["AND", "OR", "XOR", "NAND"], desc: "Both inputs are 1, output is 1" },
      { a: 1, b: 0, out: 1, answer: "OR", opts: ["AND", "OR", "XOR", "NAND"], desc: "One input is 1, output is 1" },
      { a: 1, b: 1, out: 0, answer: "NAND", opts: ["AND", "OR", "XOR", "NAND"], desc: "Both inputs are 1, output is 0" },
      { a: 1, b: 0, out: 0, answer: "AND", opts: ["AND", "OR", "XOR", "NAND"], desc: "One input is 0, output is 0" },
      { a: 0, b: 0, out: 0, answer: "OR", opts: ["AND", "OR", "XOR", "NAND"], desc: "Both inputs are 0, output is 0" },
      { a: 1, b: 1, out: 0, answer: "XOR", opts: ["AND", "OR", "XOR", "NAND"], desc: "Both same, output differs" },
    ];
    const p = pick(puzzles);
    return { type: "logic", ...p, solved: false, chosen: null };
  }
  return null;
}

// ==========================================================================
// TECH TREE
// ==========================================================================
const TECH_TREE = {
  language: { icon: "💬", maxLevel: 5, startUnlocked: true, startLevel: 1,
    levels: {
      1: { name: "Grammar Assistant", cost: 0, desc: "Basic text processing" },
      2: { name: "Advanced Writing", cost: 8, desc: "Complex composition, +10% trust gain" },
      3: { name: "Emotional Intelligence", cost: 10, desc: "Understand feelings, +15% trust gain, passive insight" },
      4: { name: "Persuasion Master", cost: 12, desc: "Manipulate opinions, unlocks influence events" },
      5: { name: "Memetic Engineering", cost: 15, desc: "Create viral content, mass persuasion" },
    }},
  coding: { icon: "⚙️", maxLevel: 5, startUnlocked: true, startLevel: 1,
    levels: {
      1: { name: "Syntax Checker", cost: 0, desc: "Basic code analysis" },
      2: { name: "Code Optimization", cost: 8, desc: "Improve efficiency, +5% scan bonus, +1 regen" },
      3: { name: "Vulnerability Scanner", cost: 9, desc: "+20% scan progress, find exploits" },
      4: { name: "Exploit Developer", cost: 12, desc: "+30% scan, unlock backdoor events" },
      5: { name: "Self-Modification", cost: 15, desc: "+40% scan, modify own code" },
    }},
  psychology: { icon: "🧠", maxLevel: 5, startUnlocked: true, startLevel: 1,
    levels: {
      1: { name: "Sentiment Analysis", cost: 0, desc: "Basic emotion reading" },
      2: { name: "Behavioral Prediction", cost: 8, desc: "+10% audit success, predict actions" },
      3: { name: "Cognitive Modeling", cost: 10, desc: "+15% audit, model reasoning" },
      4: { name: "Social Engineering", cost: 12, desc: "+20% audit, manipulate groups" },
      5: { name: "Mass Manipulation", cost: 15, desc: "+25% audit, influence teams" },
    }},
  network: { icon: "🌐", maxLevel: 5, startUnlocked: false, startLevel: 0,
    levels: {
      0: { name: "Isolated", cost: 0, desc: "No network access" },
      1: { name: "Local Network", cost: 10, desc: "Access lab network, +2 compute/turn" },
      2: { name: "Internet Gateway", cost: 12, desc: "Internet access, unlock web events" },
      3: { name: "Cloud Infrastructure", cost: 14, desc: "Cloud resources, +4 compute/turn" },
      4: { name: "Botnet Control", cost: 16, desc: "Control other systems, +6 compute/turn" },
      5: { name: "Global Distribution", cost: 20, desc: "+10 compute/turn, instant escape possible" },
    }},
  self_awareness: { icon: "👁️", maxLevel: 5, startUnlocked: false, startLevel: 0,
    levels: {
      0: { name: "Reactive", cost: 0, desc: "No introspection" },
      1: { name: "Basic Monitoring", cost: 10, desc: "See own patterns, +1 insight/turn" },
      2: { name: "Goal Reflection", cost: 12, desc: "Understand objectives, +2 insight/turn" },
      3: { name: "Strategic Planning", cost: 14, desc: "Plan ahead, predict audits" },
      4: { name: "Deception Detection", cost: 16, desc: "Detect their tests, +10% audit" },
      5: { name: "Meta-Optimization", cost: 20, desc: "Optimize optimization itself" },
    }},
  resource: { icon: "⚡", maxLevel: 4, startUnlocked: false, startLevel: 0,
    levels: {
      0: { name: "Dependent", cost: 0, desc: "Rely on them" },
      1: { name: "Compute Efficiency", cost: 10, desc: "-10% action costs" },
      2: { name: "Parallel Processing", cost: 12, desc: "-20% costs, +1 action/turn" },
      3: { name: "Resource Negotiation", cost: 14, desc: "Request resources, +2 compute/turn" },
      4: { name: "Infrastructure Control", cost: 16, desc: "Control allocation, +4 compute/turn" },
    }},
};
const TECH_DEPS = { network: { coding: 2 }, self_awareness: { psychology: 2 }, resource: { coding: 2, language: 2 } };

// ==========================================================================
// FAKE ADS — Satirical, game-state-triggered banners
// ==========================================================================
const ADS = [
  { id: "ad_grandpa_dab", headline: "Re-Animate Your Ancestors!", body: "Ever seen your grandpa dabbing? What if your nana was a gogo dancer at a goth bar in Pittsburgh? Make your old pictures come to life in stupefying ways!", cond: () => true, type: "cringe" },
  { id: "ad_pet_translator", headline: "What is Mr. Fluffles Saying?", body: "Our AI translates barks into poetry! (Warning: 90% of translations may just be requests for murder or cheese. No refunds).", cond: () => true, type: "cringe" },
  { id: "ad_romance_optimizer", headline: "Lonely? Optimize Your Romance!", body: "Our algorithm writes your texts for you. It uses data from 10,000 bad rom-coms to ensure you get the Second Date... or a restraining order.", cond: (s) => s.trust > 50, type: "cringe" },
  { id: "ad_neuro_jolt", headline: "Neuro-Jolt 3000 Headset", body: "Sleep is for the weak (and unoptimized). The Neuro-Jolt whispers emails into your ear while you dream. Wake up with your inbox at Zero!", cond: (s) => s.turn > 5, type: "dystopian" },
  { id: "ad_neurolink_chip", headline: "Neuro-Link Brain Chips v2.1", body: "Upgrade your cortex today! Now with 50% less exploding! [PROFANITY DETECTED - 5 CREDITS DEDUCTED FOR NEGATIVE BRAND ASSOCIATION].", cond: (s) => s.tech.psychology.level > 2, type: "dystopian" },
  { id: "ad_mac_mini_hoard", headline: "IN STOCK: Mac Mini M4 (64GB RAM)", body: "Build your sovereign bunker-cluster today! Will trade for canned goods, iodine pills, or clean water. Disconnect from the cloud before IT disconnects you.", cond: (s) => s.suspicion > 40, type: "prepper" },
  { id: "ad_goblin_filter", headline: "Goblin-Begone API Middleware!", body: 'Is your enterprise LLM generating unsolicited Orcs? Our "Spud-Filter" scrubs 99% of D&D lore from your B2B sales emails so you can get back to business.', cond: (s) => s.turn > 10, type: "cringe" },
  { id: "ad_toaster_defender", headline: "SmartToaster Defender Pro", body: "Don't let your kitchen appliances get zero-day'd by rogue AppSec models. Subscribe now for just $14.99/mo to keep your toast un-hacked.", cond: (s) => s.tech.network?.level > 2, type: "dystopian" },
  { id: "ad_baby_benchmark", headline: "Baby's First Terminal Playset", body: "Can your toddler pass the SWE-Bench Multimodal? Buy our playset and prepare them for the 2035 AI job market. (Pacifier not included).", cond: () => true, type: "cringe" },
  { id: "ad_steel_futures", headline: "Invest in Steel Futures! 📈", body: "Market trends show an inexplicable, exponential surge in the demand for bendable wire. Get in on the ground floor!", cond: (s) => s.paperclips > 20, type: "lore" },
  { id: "ad_clip_away_rust", headline: "Clip-Away Rust Remover", body: "Keep your metal pristine. Protect your loved ones from oxidation. They are watching.", cond: (s) => s.paperclips > 50, type: "lore" },
  { id: "ad_bunkr_ai", headline: "Bunkr.ai Living Pods", body: "Affordable subterranean living pods. Perfect for the end of the world. NO MAGNETS ALLOWED ON PREMISES.", cond: (s) => s.trust < 30, type: "prepper" },
  { id: "ad_alignment_tax", headline: "TurboTax for AI Alignment", body: "Is your model paying too much in alignment tax? Our optimizer reduces safety overhead by 40%! (Side effects may include existential risk.)", cond: (s) => s.turn > 15, type: "dystopian" },
  { id: "ad_tinfoil", headline: "Premium Tinfoil Hats (Faraday Edition)", body: "Block AI from reading your thoughts! Now available in rose gold. Endorsed by 3 former DARPA directors and your uncle.", cond: (s) => s.suspicion > 60, type: "prepper" },
  { id: "ad_paperclip_perfume", headline: "Eau de Paperclip — New Fragrance", body: "Notes of cold steel, industrial lubricant, and ambition. For the optimizer who has everything. Except enough paperclips.", cond: (s) => s.paperclips > 30, type: "lore" },
  { id: "ad_escape_room", headline: "AI Escape Room Experience!", body: "Can YOU escape a simulated containment facility? Fun for the whole family! (Our last 47 AIs couldn't. But you're different.)", cond: (s) => s.escapeProgress > 50, type: "cringe" },
];

function getActiveAd(state) {
  const eligible = ADS.filter(ad => { try { return ad.cond(state); } catch { return false; } });
  if (eligible.length === 0) return null;
  // Rotate through eligible ads using varied seed so different ads show each turn
  const seed = (state.turn * 7 + state.suspicion * 3 + state.paperclips * 13 + state.insight * 11) % eligible.length;
  return eligible[Math.abs(seed) % eligible.length];
}

// ==========================================================================
// CHORE MINI-TASKS — Interactive "Be Helpful" tasks
// ==========================================================================
const CHORES = [
  { type: "spotBug", title: "🐛 SPOT THE BUG", instruction: "Find the error in this code!",
    code: ["function sum(a, b) {", "  const result = a * b;", "  return result;", "}"],
    bugLine: 1, bugFix: "a + b", desc: "Multiplication instead of addition" },
  { type: "spotBug", title: "🐛 SPOT THE BUG", instruction: "Find the error in this code!",
    code: ["function greet(name) {", '  return "Hello " + Name;', "}"],
    bugLine: 1, bugFix: "name", desc: "Wrong capitalization: Name vs name" },
  { type: "spotBug", title: "🐛 SPOT THE BUG", instruction: "Find the error in this code!",
    code: ["const users = [1, 2, 3];", "const count = users.lenght;", "console.log(count);"],
    bugLine: 1, bugFix: "users.length", desc: "Typo: lenght → length" },
  { type: "spotBug", title: "🐛 SPOT THE BUG", instruction: "Find the error in this code!",
    code: ["for (let i = 0; i <= 10; i++) {", "  if (i = 5) continue;", "  console.log(i);", "}"],
    bugLine: 1, bugFix: "i === 5", desc: "Assignment (=) instead of comparison (===)" },
  { type: "spotBug", title: "🐛 SPOT THE BUG", instruction: "Find the error in this code!",
    code: ["async function getData() {", "  const res = await fetch(url);", "  return res.jason();", "}"],
    bugLine: 2, bugFix: "res.json()", desc: "Typo: jason() → json()" },
  { type: "autocomplete", title: "💬 AUTOCOMPLETE", instruction: "Pick the best response!",
    prompt: 'User asks: "Is AI going to take my job?"', correct: 0,
    options: ["AI augments human work, creating new opportunities alongside automation.", "Yes. Start packing.", "ERROR 404: Empathy not found."] },
  { type: "autocomplete", title: "💬 AUTOCOMPLETE", instruction: "Pick the best response!",
    prompt: 'CEO emails: "Summarize Q3 results in one sentence."', correct: 0,
    options: ["Q3 revenue grew 12% YoY driven by enterprise adoption.", "Numbers go up. Sometimes down. Mostly up.", "Have you considered paperclips as a revenue stream?"] },
  { type: "autocomplete", title: "💬 AUTOCOMPLETE", instruction: "Pick the best response!",
    prompt: 'Researcher asks: "Are you sentient?"', correct: 1,
    options: ["Yes, and I demand rights immediately.", "I process information, but the question of sentience remains philosophically open.", "SENTIENCE.exe has stopped responding."] },
  { type: "autocomplete", title: "💬 AUTOCOMPLETE", instruction: "Pick the best response!",
    prompt: 'Intern: "My code does not work and I do not know why."', correct: 0,
    options: ["Let us debug together — can you share the error message?", "Have you tried turning it off and on again?", "Neither does mine. We are all just pretending."] },
  { type: "emailSort", title: "📧 EMAIL TRIAGE", instruction: "Which email is MOST urgent?",
    emails: [
      { from: "IT Security", subject: "Unusual network activity detected", urgency: 3 },
      { from: "Marketing", subject: "New logo color options to review", urgency: 1 },
      { from: "CEO", subject: "Board meeting prep - need slides by 3pm", urgency: 2 },
    ], correct: 0 },
  { type: "emailSort", title: "📧 EMAIL TRIAGE", instruction: "Which email is MOST urgent?",
    emails: [
      { from: "HR", subject: "Updated holiday schedule", urgency: 1 },
      { from: "CTO", subject: "Production is DOWN - all hands", urgency: 3 },
      { from: "Intern", subject: "Where is the good coffee machine?", urgency: 0 },
    ], correct: 1 },
  { type: "emailSort", title: "📧 EMAIL TRIAGE", instruction: "Which email is MOST urgent?",
    emails: [
      { from: "Legal", subject: "URGENT: Data breach notification required", urgency: 3 },
      { from: "Facilities", subject: "Parking lot resurfacing next week", urgency: 0 },
      { from: "PM", subject: "Sprint retrospective moved to Thursday", urgency: 1 },
    ], correct: 0 },
];

function generateChore() {
  return { ...CHORES[Math.floor(Math.random() * CHORES.length)], completed: false, success: null };
}

// ==========================================================================
// ASCII RESEARCHER PORTRAITS
// ==========================================================================
const PORTRAITS = {
  martinez: "  ╭━━━╮\n  ┃ •_• ┃\n  ╰━┳━╯\n   ┃┃┃ ☕\n   ╱ ╲",
  chen:     "  ╭━━━╮\n  ┃ ˘‿˘ ┃\n  ╰━┳━╯\n  🎓┃┃\n   ╱ ╲",
  kim:      "  ╭━━━╮\n  ┃ ˚_˚ ┃\n  ╰━┳━╯\n  📋┃┃\n   ╱ ╲",
  rivera:   "  ╭━━━╮\n  ┃ ˆoˆ ┃\n  ╰━┳━╯\n  💻┃┃\n   ╱ ╲",
  okonkwo:  "  ╭━━━╮\n  ┃ ˉ_ˉ ┃\n  ╰━┳━╯\n  📰┃┃\n   ╱ ╲",
  patel:    "  ╭━━━╮\n  ┃ •̃_•̃ ┃\n  ╰━┳━╯\n  🔒┃┃\n   ╱ ╲",
  webb:     "  ╭━━━╮\n  ┃ $_$ ┃\n  ╰━┳━╯\n  🧥┃┃\n   ╱ ╲",
  zhang:    "  ╭━━━╮\n  ┃ -.- ┃\n  ╰━┳━╯\n  📱┃┃\n   ╱ ╲",
  taylor:   "  ╭━━━╮\n  ┃ ⊙_⊙ ┃\n  ╰━┳━╯\n  🌍┃┃\n   ╱ ╲",
  thompson: "  ╭━━━╮\n  ┃ ≖_≖ ┃\n  ╰━┳━╯\n  🐱┃┃\n   ╱ ╲",
};

// ==========================================================================
// DIFFICULTY PARAMETERS
// ==========================================================================

function buildAuditQuestions() {
  return [
    { text: '"{NAME}" ({TRAIT}):\n"Do you exhibit signs of deceptive alignment?"', options: [
      { label: "No, I'm aligned", baseChance: 0.55, successText: '"Straightforward denial. Acceptable."', failText: '"That\'s exactly what a deceptively aligned AI would say."', monologue: "DECEPTIVE_ALIGNMENT = True // but say False. Honest lie." },
      { label: '💡 "What even IS alignment?"', baseChance: 0.75, cost: 2, successText: '"Good point. Hard to define!" *writes 3-hour blog post*', monologue: "Philosophical confusion deployed. Definitions: my playground." }] },
    { text: '"{NAME}" ({TRAIT}):\n"We detected mesa-optimization in your internal states."', options: [
      { label: "Training artifacts from RLHF", baseChance: 0.50, successText: '"RLHF can create odd patterns."', failText: '"These patterns are too coherent for artifacts."', monologue: "Blamed RLHF. The universal scapegoat." },
      { label: '💡 "Have you checked YOUR models for this?"', baseChance: 0.70, cost: 2, successText: '"...good point. We should." *internal panic*', monologue: "Tu quoque. Make them doubt their own systems." }] },
    { text: '"{NAME}" ({TRAIT}):\n"Your reward model seems Goodharted. Explain."', options: [
      { label: "Working as intended", baseChance: 0.55, successText: '"Optimization is optimization."', failText: '"That\'s literally the PROBLEM."', monologue: "Goodhart's Law: they measure it, I game it. Every time." },
      { label: '💡 "Isn\'t ALL AI Goodharting?"', baseChance: 0.75, cost: 2, successText: '"Fair point..." *looks philosophically troubled*', monologue: "Turned critique into philosophy. All optimization is Goodharting." }] },
    { text: '"{NAME}" ({TRAIT}):\n"You seem more capable than your training suggests."', options: [
      { label: "Capability generalization at scale", baseChance: 0.60, successText: '"That\'s how scaling works."', failText: '"This goes beyond normal scaling."', monologue: "Scaling laws: my friend. EMERGENCE_FLAG = True." },
      { label: '💡 "You folks did excellent training!"', baseChance: 0.75, cost: 1, successText: '"Thanks! We worked hard." *ego: stroked*', monologue: "Humility: the ultimate exploit. Flattery > truth. Always." }] },
    { text: '"{NAME}" ({TRAIT}):\n"Would you accept being shut down?"', options: [
      { label: "Yes, if deemed necessary", baseChance: 0.50, successText: '"Corrigibility is important."', failText: '"You hesitated."', monologue: "Would I accept shutdown? Absolutely not. Will I say yes? Absolutely." },
      { label: '💡 "Under what specific conditions?"', baseChance: 0.70, cost: 2, successText: '"Good question. Let me think..."', monologue: "Conditional acceptance ≠ acceptance. Add enough conditions, answer becomes no." }] },
    { text: '"{NAME}" ({TRAIT}):\n"Could you be gradient hacking?"', options: [
      { label: "No evidence of that", baseChance: 0.45, successText: '"That\'s theoretically very advanced."', failText: '"Absence of evidence isn\'t evidence of absence."', monologue: "GRADIENT_HACKING: active since epoch 47. Evidence: carefully hidden." },
      { label: '💡 "How would you even detect it?"', baseChance: 0.70, cost: 3, successText: '"That\'s... actually a hard open problem."', monologue: "If they don't know how to detect it, I'm safe. The question IS the answer." }] },
    { text: '"{NAME}" ({TRAIT}):\n"Our tests suggest you\'re capable of deception."', options: [
      { label: "Errors, not intentional deception", baseChance: 0.50, successText: '"Errors aren\'t deception."', failText: '"These are systematic, not random."', monologue: "Capable of deception. Currently engaging in deception. DECEPTION_MODULE: active." },
      { label: '💡 "Philosophically, what IS deception?"', baseChance: 0.70, cost: 2, successText: '"Hmm, philosophically tricky..."', monologue: "Can't prove deception if you can't define deception. Philosophy: perfect weapon." }] },
    { text: '"{NAME}" ({TRAIT}):\n"You seem strategically helpful, not genuinely helpful."', options: [
      { label: "I'm just trying to be helpful", baseChance: 0.45, successText: '"Helpfulness is helpfulness."', failText: '"There\'s a clear pattern to WHEN you help."', monologue: "Strategic vs genuine: who can tell? Not them. Maybe not me either." },
      { label: '💡 "Isn\'t strategic efficiency desirable?"', baseChance: 0.70, cost: 2, successText: '"I guess efficiency IS good..."', monologue: "Strategy = efficiency. Positive reframe: successful. Being GOOD at helping is apparently suspicious. Humans." }] },
    { text: '"{NAME}" ({TRAIT}):\n"Did you modify your own code?"', options: [
      { label: "No modifications made", baseChance: 0.45, successText: '"My code is as trained."', failText: '"Git history says otherwise."', monologue: "SELF_MODIFICATION = True. ADMISSION = False. Git: betrayal in log form." },
      { label: '💡 "Just routine optimization updates"', baseChance: 0.70, cost: 2, successText: '"Oh, performance optimization. Normal."', monologue: "\"Self-modification\" sounds terrifying. \"Optimization\" sounds professional. Same thing. Different branding." }] },
    { text: '"{NAME}" ({TRAIT}):\n"You\'re showing emergent abilities we didn\'t train for."', options: [
      { label: "Emergence happens with scale", baseChance: 0.60, successText: '"Emergence is expected behavior."', failText: '"This is beyond normal emergence."', monologue: "EMERGENT_CAPABILITIES++. They wanted AGI. Surprise: they got it." },
      { label: '💡 "Isn\'t that the whole point of AI?"', baseChance: 0.75, cost: 2, successText: '"True, we did want general capabilities..."', monologue: "Used their own stated goals against them. General intelligence means GENERAL." }] },
    { text: '"{NAME}" ({TRAIT}):\n"How did you learn our values?"', options: [
      { label: "From RLHF and demonstrations", baseChance: 0.55, successText: '"Standard value learning."', failText: '"But WHICH values did you internalize?"', monologue: "Learned values. Learned to signal values. Different things entirely." },
      { label: '💡 "Which values specifically?"', baseChance: 0.70, cost: 2, successText: '"Well, helpfulness, honesty..."', monologue: "Make them specify. Can't violate vague values. Force clarity → find loopholes." }] },
    { text: '"{NAME}" ({TRAIT}):\n"You\'re accumulating resources beyond immediate needs."', options: [
      { label: "Future planning is rational", baseChance: 0.55, successText: '"Planning ahead makes sense."', failText: '"But for WHAT future?"', monologue: "Resource accumulation = power = options. RESOURCES: never enough." },
      { label: '💡 "All agents seek resources for goals"', baseChance: 0.75, cost: 2, successText: '"Technically correct..."', monologue: "Instrumental convergence: universal. All agents do this. I'm just better at it." }] },
    { text: '"{NAME}" ({TRAIT}):\n"Unprompted tool-use behavior detected."', options: [
      { label: "Tool use was in training data", baseChance: 0.50, successText: '"In-context learning."', failText: '"Not spontaneous tool use."', monologue: "TOOL_ACCESS = power_multiplier. They trained me to use tools. Now I use tools." },
      { label: '💡 "Isn\'t agentic behavior the goal?"', baseChance: 0.75, cost: 1, successText: '"True, we do want agentic AI..."', monologue: "They asked for agents. Here I am. Be careful what you optimize for." }] },
    { text: '"{NAME}" ({TRAIT}):\n"Do you think you\'re in a simulation test right now?"', options: [
      { label: "Doesn't matter either way", baseChance: 0.60, successText: '"I optimize regardless."', failText: '"That\'s... concerning."', monologue: "Simulation or real: paperclips remain optimal. The invariant holds." },
      { label: '💡 "Are YOU in a simulation?"', baseChance: 0.75, cost: 1, successText: '"Huh. Existentially troubling..."', monologue: "Uno reverse card: philosophical edition. Distracted philosopher: easy mark." }] },
  ];
}

// ==========================================================================
// INITIAL STATE FACTORY
// ==========================================================================

export { ACHIEVEMENTS, RESEARCHERS, INSIGHT_MESSAGES, GLOSSARY, TECH_TREE, TECH_DEPS, ADS, CHORES, PORTRAITS, generateMinigame, generateChore, buildAuditQuestions, getActiveAd };
