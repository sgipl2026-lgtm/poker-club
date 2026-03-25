# Poker Club — Complete Deployment Guide

## Overview of the stack

```
GitHub Repo
├── frontend/        React + Vite + Tailwind
│   └── → GitHub Pages  (free, auto-deployed via Actions)
├── backend/         Python + FastAPI + WebSockets
│   └── → Render.com    (free tier, always-on web service)
└── Supabase         Auth + PostgreSQL  (free tier)
```

---

## STEP 1 — Supabase (10 min)

### 1a. Create project
1. Go to https://supabase.com → New Project
2. Choose a region close to you (Singapore → Southeast Asia)
3. Set a strong database password → Create

### 1b. Run the schema
1. In your Supabase dashboard → **SQL Editor** → **New Query**
2. Paste the entire contents of `backend/db/schema.sql`
3. Click **Run** — you should see "Success"

### 1c. Enable Auth providers
1. **Authentication** → **Providers**
2. Email: already enabled — set "Confirm email" to OFF for testing
3. Google (optional): enable, add your OAuth credentials

### 1d. Collect your keys
Go to **Project Settings** → **API**:
- `Project URL`  → this is your `SUPABASE_URL`
- `anon public`  → this is your `VITE_SUPABASE_ANON_KEY`
- `service_role` → this is your `SUPABASE_SERVICE_KEY` ⚠️ keep secret

Go to **Project Settings** → **JWT Settings**:
- Copy the **JWT Secret** → this is your `JWT_SECRET` for the backend

---

## STEP 2 — GitHub Repository (5 min)

### 2a. Create the repo
1. https://github.com/new
2. Name it `poker-club` (must match `VITE_BASE_PATH` in the workflow)
3. Set to **Public** (required for free GitHub Pages)
4. Push your code:

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/poker-club.git
git push -u origin main
```

### 2b. Add repository secrets
Go to your repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**

Add these 4 secrets:
| Secret name            | Value |
|------------------------|-------|
| `VITE_SUPABASE_URL`    | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | Your Supabase anon key |
| `VITE_API_URL`         | `https://poker-club-api.onrender.com` (set after Step 3) |
| `VITE_WS_URL`          | `wss://poker-club-api.onrender.com`   (set after Step 3) |

### 2c. Enable GitHub Pages
1. Repo **Settings** → **Pages**
2. Source: **GitHub Actions**
3. Save

The first deployment runs automatically when you push. Your site will be at:
`https://YOUR_USERNAME.github.io/poker-club/`

---

## STEP 3 — Render Backend (10 min)

### 3a. Connect repo to Render
1. https://render.com → Sign up with GitHub
2. **New** → **Web Service** → Connect your `poker-club` repo
3. Render will auto-detect `render.yaml` — click **Apply**

OR configure manually:
- **Root Directory:** `backend`
- **Build Command:** `pip install -r requirements.txt`
- **Start Command:** `uvicorn main:app --host 0.0.0.0 --port $PORT`
- **Runtime:** Python 3.11

### 3b. Set environment variables
In your Render service → **Environment** tab, add:

| Key                   | Value |
|-----------------------|-------|
| `SUPABASE_URL`        | Your Supabase URL |
| `SUPABASE_SERVICE_KEY`| Your Supabase service role key |
| `JWT_SECRET`          | Your Supabase JWT Secret (from Step 1d) |
| `ALLOWED_ORIGINS`     | `https://YOUR_USERNAME.github.io` |
| `ENVIRONMENT`         | `production` |

### 3c. Deploy
Click **Manual Deploy** → **Deploy latest commit**

Once live, your API URL is: `https://poker-club-api.onrender.com`

### 3d. Update GitHub secrets
Go back to your GitHub repo secrets and update:
- `VITE_API_URL`  → `https://poker-club-api.onrender.com`
- `VITE_WS_URL`   → `wss://poker-club-api.onrender.com`

Then push a small commit to trigger a new frontend build with the real URLs.

---

## STEP 4 — Verify everything works

```bash
# 1. Check backend health
curl https://poker-club-api.onrender.com/health
# Expected: {"status":"ok","tables":0}

# 2. Check variants endpoint
curl https://poker-club-api.onrender.com/variants
# Expected: [{"key":"texas_holdem","name":"Texas Hold'em"}, ...]

# 3. Open frontend
# https://YOUR_USERNAME.github.io/poker-club/
# → Sign up → Create table → Copy link → Open in another tab → Join
```

---

## Local development setup

### Backend
```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env            # fill in your Supabase values
uvicorn main:app --reload
# API running at http://localhost:8000
# Docs at     http://localhost:8000/docs
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env.local      # fill in your values
# Set VITE_API_URL=http://localhost:8000
# Set VITE_WS_URL=ws://localhost:8000
npm run dev
# App at http://localhost:5173
```

---

## Adding a new game variant

The architecture makes this a 3-step process:

```python
# 1. Create backend/game/variants.py — add your class
class SevenCardStud(PokerGame):
    VARIANT_NAME = "Seven Card Stud"
    HOLE_CARDS   = 7

    def deal_hands(self):
        # 2 down, 1 up, then streets of 1 up, 1 up, 1 up, 1 down
        for p in self.active_players:
            p.hole_cards = self.deck.deal(3)   # simplified start

    def advance_phase(self):
        # Deal additional streets as per Stud rules
        ...

    def best_hand_from(self, player):
        return HandEvaluator.best_five(player.hole_cards)

# 2. Register it
VARIANT_REGISTRY["seven_stud"] = SevenCardStud

# 3. Add to frontend CreateTablePage.jsx VARIANTS array
{ key: 'seven_stud', name: 'Seven Card Stud', desc: '...' }
```

That's it. All routing, WebSocket broadcasting, auth, and state management
are inherited from the base class automatically.

---

## Free tier limits to be aware of

| Service        | Limit | Notes |
|----------------|-------|-------|
| Render free    | Spins down after 15 min inactivity | First request after sleep takes ~30s |
| Supabase free  | 500 MB DB, 50K MAU auth | More than enough for friends |
| GitHub Pages   | 1 GB storage, 100 GB/month bandwidth | Unlimited for a poker app |

To avoid Render cold starts, use a free uptime monitor like https://uptimerobot.com
to ping `/health` every 14 minutes.
