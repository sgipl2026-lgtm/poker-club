"""
poker-app/backend/main.py
"""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional

from config import get_settings
from api.auth import get_current_user, extract_token_from_query
from api.ws_manager import ConnectionManager
from game.engine import BettingStructure, PlayerAction, GamePhase
from game.table_manager import TableConfig, TableManager
from game.variants import VARIANT_REGISTRY

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

table_manager = TableManager()
ws_manager    = ConnectionManager()


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Poker server starting up")
    yield
    logger.info("Poker server shutting down")


settings = get_settings()

app = FastAPI(title="Poker Club API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Request / Response models
# ---------------------------------------------------------------------------

class CreateTableRequest(BaseModel):
    table_name:        str              = Field("My Poker Table", max_length=40)
    variant:           str              = Field("texas_holdem")
    dealer_choice:     bool             = False
    betting_structure: BettingStructure = BettingStructure.NO_LIMIT
    small_blind:       int              = Field(10, ge=1)
    big_blind:         int              = Field(20, ge=2)
    min_bet:           int              = Field(20, ge=1)
    max_bet:           int              = Field(0, ge=0)
    starting_chips:    int              = Field(1000, ge=100)
    max_seats:         int              = Field(6, ge=2, le=9)


class StartGameRequest(BaseModel):
    variant_override: Optional[str] = None   # dealer choice only


class TableResponse(BaseModel):
    table_id:     str
    table_name:   str
    invite_token: str
    invite_url:   str
    variant:      str
    admin_id:     str


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------

@app.get("/")
async def root():
    return {"name": "Poker Club API", "status": "running", "docs": "/docs"}


@app.get("/health")
async def health():
    return {"status": "ok", "tables": len(table_manager._tables)}


@app.get("/variants")
async def list_variants():
    variants = [{"key": k, "name": v.VARIANT_NAME} for k, v in VARIANT_REGISTRY.items()]
    variants.insert(0, {"key": "dealer_choice", "name": "Dealer's Choice (pick each hand)"})
    return variants


@app.post("/tables", response_model=TableResponse)
async def create_table(body: CreateTableRequest, user: dict = Depends(get_current_user)):
    if body.variant not in VARIANT_REGISTRY and body.variant != "dealer_choice":
        raise HTTPException(400, f"Unknown variant '{body.variant}'")
    config = TableConfig(
        table_name        = body.table_name,
        variant           = body.variant,
        dealer_choice     = body.dealer_choice or body.variant == "dealer_choice",
        betting_structure = body.betting_structure,
        small_blind       = body.small_blind,
        big_blind         = body.big_blind,
        min_bet           = body.min_bet,
        max_bet           = body.max_bet,
        starting_chips    = body.starting_chips,
        max_seats         = body.max_seats,
    )
    state = table_manager.create_table(user["user_id"], user["username"], config)
    frontend_origin = settings.origins_list[0]
    return TableResponse(
        table_id     = state.table_id,
        table_name   = config.table_name,
        invite_token = state.invite_token,
        invite_url   = f"{frontend_origin}/#/table/{state.table_id}",
        variant      = body.variant,
        admin_id     = user["user_id"],
    )


@app.get("/tables/{table_id}")
async def get_table(table_id: str, user: dict = Depends(get_current_user)):
    state = table_manager.get_table(table_id)
    if not state:
        raise HTTPException(404, "Table not found")
    return {
        "table_id":       state.table_id,
        "table_name":     state.config.table_name,
        "variant":        state.config.variant,
        "dealer_choice":  state.config.dealer_choice,
        "pending_variant":state.pending_variant,
        "started":        state.started,
        "admin_id":       state.admin_id,
        "players":        [{"user_id": p.user_id, "username": p.username,
                            "seat": p.seat, "chips": p.chips}
                           for p in state.players],
        "config": {
            "small_blind":       state.config.small_blind,
            "big_blind":         state.config.big_blind,
            "starting_chips":    state.config.starting_chips,
            "betting_structure": state.config.betting_structure,
            "max_seats":         state.config.max_seats,
        },
        "is_admin": state.admin_id == user["user_id"],
    }


@app.post("/tables/{table_id}/start")
async def start_game(
    table_id: str,
    body: StartGameRequest = StartGameRequest(),
    user: dict = Depends(get_current_user),
):
    game = table_manager.start_game(table_id, user["user_id"], body.variant_override)
    if game is None:
        raise HTTPException(400, "Cannot start — you must be admin and have ≥2 players")
    state = table_manager.get_table(table_id)
    await ws_manager.broadcast_event(
        {"type": "game_started", "variant": game.VARIANT_NAME, "table_name": state.config.table_name},
        table_id
    )
    await ws_manager.broadcast_game_state(game, table_id)
    return {"started": True, "variant": game.VARIANT_NAME}


@app.post("/tables/{table_id}/next_hand")
async def next_hand(
    table_id: str,
    body: StartGameRequest = StartGameRequest(),
    user: dict = Depends(get_current_user),
):
    state = table_manager.get_table(table_id)
    if not state or state.admin_id != user["user_id"]:
        raise HTTPException(403, "Only admin can start next hand")
    game = table_manager.next_hand(table_id, body.variant_override)
    if not game:
        raise HTTPException(400, "Cannot start next hand")
    await ws_manager.broadcast_event(
        {"type": "new_hand", "variant": game.VARIANT_NAME, "hand_number": game.hand_number},
        table_id
    )
    await ws_manager.broadcast_game_state(game, table_id)
    return {"started": True}


@app.post("/tables/{table_id}/set_variant")
async def set_variant(
    table_id: str,
    variant: str = Query(...),
    user: dict = Depends(get_current_user),
):
    ok = table_manager.set_pending_variant(table_id, user["user_id"], variant)
    if not ok:
        raise HTTPException(400, "Cannot set variant")
    await ws_manager.broadcast_event(
        {"type": "variant_selected", "variant": variant,
         "variant_name": VARIANT_REGISTRY[variant].VARIANT_NAME},
        table_id
    )
    return {"ok": True}


@app.post("/tables/{table_id}/join")
async def join_table(table_id: str, user: dict = Depends(get_current_user)):
    state = table_manager.join_table(table_id, user["user_id"], user["username"])
    if not state:
        raise HTTPException(400, "Cannot join — table is full or game in progress")
    await ws_manager.broadcast_event(
        {"type": "player_joined", "username": user["username"]}, table_id
    )
    return {"joined": True, "table_id": state.table_id}


# ---------------------------------------------------------------------------
# WebSocket
# ---------------------------------------------------------------------------

@app.websocket("/ws/{table_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    table_id:  str,
    token:     str = Query(...),
):
    try:
        user = extract_token_from_query(token)
    except Exception:
        await websocket.close(code=4001, reason="Unauthorized")
        return

    user_id  = user["user_id"]
    username = user["username"]

    state = table_manager.get_table(table_id)
    if not state:
        await websocket.close(code=4004, reason="Table not found")
        return

    if not any(p.user_id == user_id for p in state.players):
        result = table_manager.join_table(table_id, user_id, username)
        if not result:
            await websocket.close(code=4003, reason="Table is full or game already started")
            return

    await ws_manager.connect(websocket, table_id, user_id)

    # Send current state on connect
    if state.game and state.game.phase not in (GamePhase.WAITING, GamePhase.FINISHED):
        private = state.game.private_state(user_id)
        private["type"] = "game_state"
        private["table_name"] = state.config.table_name
        await ws_manager.send_personal(private, table_id, user_id)
    else:
        await ws_manager.send_personal(
            {
                "type":         "lobby_state",
                "table_name":   state.config.table_name,
                "dealer_choice":state.config.dealer_choice,
                "variant":      state.config.variant,
                "is_admin":     state.admin_id == user_id,
                "players":      [{"username": p.username, "seat": p.seat, "chips": p.chips}
                                 for p in state.players],
            },
            table_id, user_id
        )

    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")

            # ---- Player game action ----
            if msg_type == "action" and state.game:
                action_str = data.get("action")
                amount     = int(data.get("amount", 0))
                try:
                    action = PlayerAction(action_str)
                except ValueError:
                    await ws_manager.send_personal(
                        {"type": "error", "message": f"Unknown action: {action_str}"},
                        table_id, user_id
                    )
                    continue

                result = state.game.handle_action(user_id, action, amount)
                if "error" in result:
                    await ws_manager.send_personal(
                        {"type": "error", "message": result["error"]},
                        table_id, user_id
                    )
                else:
                    await ws_manager.broadcast_event(
                        {"type": "action_log", "log": result.get("log", {})}, table_id
                    )
                    await ws_manager.broadcast_game_state(state.game, table_id)

                    if state.game.phase == GamePhase.FINISHED:
                        winners = state.game._determine_winners()
                        await ws_manager.broadcast_event(
                            {"type": "hand_complete", "winners": winners,
                             "dealer_choice": state.config.dealer_choice},
                            table_id
                        )

            # ---- Chat ----
            elif msg_type == "chat":
                text = str(data.get("text", ""))[:200]
                await ws_manager.broadcast_event(
                    {"type": "chat", "username": username, "text": text}, table_id
                )

            # ---- Ping ----
            elif msg_type == "ping":
                await ws_manager.send_personal({"type": "pong"}, table_id, user_id)

    except WebSocketDisconnect:
        ws_manager.disconnect(table_id, user_id)
        await ws_manager.broadcast_event(
            {"type": "player_disconnected", "username": username}, table_id
        )
