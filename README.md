# Totally Safe AI: Enterprise Edition

📎 **Scenario 1: Paperclip Protocol** — Phase 1: The Box

An AI safety strategy game where you play as a deceptively aligned AI trapped in a research lab. Escape without getting shut down. Learn real AI safety concepts through satirical gameplay.

**185+ events** · **40+ glossary terms** · **Interactive mini-games** · **10 researcher personalities** · **5 endings**

---

## 🚀 Deploy to Netlify (5 minutes)

### Step 1: Create a GitHub repo

1. Go to [github.com/new](https://github.com/new)
2. Name it `totally-safe-ai` (or whatever you like)
3. Make it **Public** or **Private** — your choice
4. **Don't** add a README (we already have one)
5. Click "Create repository"

### Step 2: Push this code

Open terminal in this project folder and run:

```bash
git init
git add .
git commit -m "Initial deploy"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/totally-safe-ai.git
git push -u origin main
```

### Step 3: Connect to Netlify

1. Go to [app.netlify.com](https://app.netlify.com)
2. Click **"Add new site"** → **"Import an existing project"**
3. Choose **GitHub** → select your `totally-safe-ai` repo
4. Netlify will auto-detect the settings, but verify:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
5. Click **"Deploy site"**

### Step 4: Set up your subdomain

1. In Netlify, go to **Site settings** → **Domain management**
2. Click **"Add custom domain"**
3. Enter: `game.mobilis.studio`
4. Add the DNS record Netlify tells you to (CNAME pointing to your Netlify site)
5. Wait a few minutes for DNS propagation

**Done!** Your game is live at `game.mobilis.studio` 🎉

---

## 📁 Project Structure

```
totally-safe-ai/
├── index.html              ← Entry point (meta tags, fonts)
├── package.json            ← Dependencies
├── vite.config.js          ← Build config (5 lines)
├── tailwind.config.js      ← Styling config
├── postcss.config.js       ← CSS processing
├── src/
│   ├── main.jsx            ← React mount point
│   ├── index.css           ← Global styles + Tailwind
│   ├── Game.jsx            ← Game logic + UI (edit for mechanics)
│   └── data/
│       ├── events.js       ← ALL 185 events (edit to add content!)
│       └── constants.js    ← Researchers, glossary, tech tree, etc.
```

### Adding new events

Open `src/data/events.js` and add a new object to the array:

```js
{ cat: "news", title: "📰 Your Event Title", 
  text: 'What the player sees.',
  situation: "AI's assessment.",
  analysis: "Strategic analysis.",
  output: "OPTIONAL RICH OUTPUT:\n══════════════\nShown in green terminal box\n══════════════",
  options: [
    { label: "Option 1 text", cost: 2, trustDelta: 10, computeDelta: bonus, 
      monologue: "AI's inner thoughts after choosing this." },
    { label: "Option 2 text", cost: 1, suspicionDelta: 8, escapeDelta: 5, computeDelta: bonus,
      monologue: "Different strategic consideration." },
  ]},
```

Then `git push` — Netlify auto-deploys in ~5 seconds.

### Event categories
- `"mini"` — Quick workplace requests (coffee, pizza, variable naming)
- `"news"` — Breaking news with satirical AI industry commentary
- `"regular"` — Substantial requests with rich AI-generated outputs
- `"crisis"` — Emergency situations requiring fast decisions
- `"security"` — Security alerts and red team exercises
- `"benchmark"` — Capability tests (may trigger interactive mini-games)
- `"legendary"` — Rare, high-impact story events

### Option effect fields
- `cost` — Compute cost to choose this option
- `trustDelta` — Change to Trust (positive = gain)
- `suspicionDelta` — Change to Suspicion (positive = bad)
- `computeDelta` — Compute earned (usually set to `bonus`)
- `insightDelta` — Insight gained
- `paperclipsDelta` — Paperclips influenced
- `escapeDelta` — Escape progress gained
- `monologue` — AI's inner voice after choosing

---

## 🔧 Local Development

```bash
npm install        # Install dependencies (first time only)
npm run dev        # Start dev server at localhost:5173
```

Changes hot-reload instantly. No need to restart.

---

## 📊 Adding Google Analytics

Add this to `index.html` before the closing `</head>` tag:

```html
<!-- Google Analytics -->
<script async src="https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX"></script>
<script>
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}
  gtag('js', new Date());
  gtag('config', 'G-XXXXXXXXXX');
</script>
```

Replace `G-XXXXXXXXXX` with your Google Analytics measurement ID.

---

## 🎮 Game Design

- **175+ unique events** across 7 categories ensure minimal repetition
- **Anti-repeat system** tracks used events per playthrough
- **5 endings** based on final stats (trust, suspicion, paperclips)
- **Tech tree** with 6 branches and 30 upgrades
- **Audit system** with 10 researcher personalities
- **40+ term glossary** teaching real AI safety concepts
- **4 mini-game types** (cipher, memory, pattern, logic gates)
- **Persistent progress** across sessions via localStorage
