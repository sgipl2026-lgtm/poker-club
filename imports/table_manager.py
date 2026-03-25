"""
poker-app/backend/game/table_manager.py

In-memory registry of all live tables.  One TableManager instance is held
as a FastAPI app-level dependency (lifespan singleton).
"""

from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Optional

from .engine import BettingStructure, Player, PokerGame
from .variants import VARIANT_REGISTRY


@dataclass
class TableConfig:
    variant:           str              = "texas_holdem"
    betting_structure: BettingStructure = BettingStructure.NO_LIMIT
    small_blind:       int              = 10
    big_blind:         int              = 20
    min_bet:           int              = 20
    max_bet:           int              = 0        # 0 = unlimited
    starting_chips:    int              = 1000
    max_seats:         int              = 9
    min_players:       int              = 2


@dataclass
class TableState:
    table_id:   str
    admin_id:   str
    config:     TableConfig
    game:       Optional[PokerGame]  = None
    players:    list[Player]         = field(default_factory=list)
    started:    bool                 = False
    invite_token: str                = field(default_factory=lambda: uuid.uuid4().hex)


class TableManager:
    """Thread-safe (asyncio single-thread) in-memory table store."""

    def __init__(self) -> None:
        self._tables: dict[str, TableState] = {}

    # -- Table lifecycle -----------------------------------------------------

    def create_table(self, admin_id: str, admin_username: str, config: TableConfig) -> TableState:
        table_id = uuid.uuid4().hex[:8].upper()
        state = TableState(table_id=table_id, admin_id=admin_id, config=config)
        self._tables[table_id] = state
        # Admin joins at seat 0
        self._add_player(state, admin_id, admin_username, seat=0)
        return state

    def get_table(self, table_id: str) -> Optional[TableState]:
        return self._tables.get(table_id.upper())

    def join_table(self, table_id: str, user_id: str, username: str) -> Optional[TableState]:
        state = self.get_table(table_id)
        if not state or state.started:
            return None
        if any(p.user_id == user_id for p in state.players):
            return state  # already seated
        if len(state.players) >= state.config.max_seats:
            return None
        seat = self._next_open_seat(state)
        self._add_player(state, user_id, username, seat)
        return state

    def start_game(self, table_id: str, admin_id: str) -> Optional[PokerGame]:
        state = self.get_table(table_id)
        if not state or state.admin_id != admin_id:
            return None
        if len(state.players) < state.config.min_players:
            return None
        cfg = state.config
        variant_cls = VARIANT_REGISTRY.get(cfg.variant, VARIANT_REGISTRY["texas_holdem"])
        game = variant_cls(
            table_id          = table_id,
            players           = state.players,
            small_blind       = cfg.small_blind,
            big_blind         = cfg.big_blind,
            betting_structure = cfg.betting_structure,
            min_bet           = cfg.min_bet,
            max_bet           = cfg.max_bet,
        )
        game.start_hand()
        state.game = game
        state.started = True
        return game

    def remove_player(self, table_id: str, user_id: str) -> None:
        state = self.get_table(table_id)
        if not state:
            return
        state.players = [p for p in state.players if p.user_id != user_id]
        if not state.players:
            del self._tables[table_id]

    # -- Helpers -------------------------------------------------------------

    def _add_player(self, state: TableState, user_id: str, username: str, seat: int) -> None:
        player = Player(
            user_id  = user_id,
            username = username,
            seat     = seat,
            chips    = state.config.starting_chips,
        )
        state.players.append(player)
        state.players.sort(key=lambda p: p.seat)

    def _next_open_seat(self, state: TableState) -> int:
        taken = {p.seat for p in state.players}
        for i in range(state.config.max_seats):
            if i not in taken:
                return i
        return len(state.players)
