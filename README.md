# Poker Club 🃏

Real-time multiplayer poker — Texas Hold'em, Omaha, and Omaha Hi-Lo.

## Stack
- **Frontend:** React 18 + Vite + Tailwind CSS → GitHub Pages
- **Backend:**  Python 3.11 + FastAPI + WebSockets → Render.com (free)
- **Auth/DB:**  Supabase (PostgreSQL + JWT auth)

## Quick start

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full step-by-step guide.

```
frontend/   React app
backend/    FastAPI server + game engine
  game/
    engine.py         Core: Card, Deck, HandEvaluator, PokerGame base class
    variants.py       Texas Hold'em, Omaha, Omaha Hi-Lo + variant registry
    table_manager.py  In-memory table/session state
  api/
    ws_manager.py     WebSocket connection manager (secure per-player state)
    auth.py           JWT verification
  db/
    schema.sql        Supabase PostgreSQL schema + RLS policies
  main.py             FastAPI app, REST routes, WebSocket endpoint
```

## Adding a new variant

Subclass `PokerGame`, implement 3 methods, register in `VARIANT_REGISTRY`.
See DEPLOYMENT.md → "Adding a new game variant".

## License
MIT — free for personal and non-commercial use.
