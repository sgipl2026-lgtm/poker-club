"""
poker-app/backend/game/table_manager.py
"""
from __future__ import annotations

import uuid
from dataclasses import dataclass, field
from typing import Optional

from .engine import BettingStructure, Player, PokerGame
from .variants import VARIANT_REGISTRY


@dataclass
class TableConfig:
    table_name:        str              = "My Poker Table"
    variant:           str              = "texas_holdem"   # can be "dealer_choice"
    betting_structure: BettingStructure = BettingStructure.NO_LIMIT
    small_blind:       int              = 10
    big_blind:         int              = 20
    min_bet:           int              = 20
    max_bet:           int              = 0
    starting_chips:    int              = 1000
    max_seats:         int              = 9
    min_players:       int              = 2
    dealer_choice:     bool             = False  # admin picks variant before each hand


@dataclass
class TableState:
    table_id:     str
    admin_id:     str
    config:       TableConfig
    game:         Optional[PokerGame] = None
    players:      list[Player]        = field(default_factory=list)
    started:      bool                = False
    invite_token: str                 = field(default_factory=lambda: uuid.uuid4().hex)
    # For dealer choice — pending variant selection before next hand
    pending_variant: Optional[str]    = None


class TableManager:
    def __init__(self) -> None:
        self._tables: dict[str, TableState] = {}

    def create_table(self, admin_id: str, admin_username: str, config: TableConfig) -> TableState:
        table_id = uuid.uuid4().hex[:8].upper()
        state = TableState(table_id=table_id, admin_id=admin_id, config=config)
        self._tables[table_id] = state
        self._add_player(state, admin_id, admin_username, seat=0)
        return state

    def get_table(self, table_id: str) -> Optional[TableState]:
        return self._tables.get(table_id.upper())

    def join_table(self, table_id: str, user_id: str, username: str) -> Optional[TableState]:
        state = self.get_table(table_id)
        if not state:
            return None
        # Allow reconnect even if started
        if any(p.user_id == user_id for p in state.players):
            return state
        if state.started:
            return None
        if len(state.players) >= state.config.max_seats:
            return None
        seat = self._next_open_seat(state)
        self._add_player(state, user_id, username, seat)
        return state

    def start_game(self, table_id: str, admin_id: str, variant_override: str = None) -> Optional[PokerGame]:
        state = self.get_table(table_id)
        if not state or state.admin_id != admin_id:
            return None
        # Only use players actually at the table — NOT all 9 seats
        active = [p for p in state.players]
        if len(active) < state.config.min_players:
            return None

        cfg = state.config
        # Dealer choice: use the variant the admin selected, else config default
        variant_key = variant_override or state.pending_variant or cfg.variant
        if variant_key == "dealer_choice":
            variant_key = "texas_holdem"  # fallback
        variant_cls = VARIANT_REGISTRY.get(variant_key, VARIANT_REGISTRY["texas_holdem"])

        game = variant_cls(
            table_id          = table_id,
            players           = active,         # only real seated players
            small_blind       = cfg.small_blind,
            big_blind         = cfg.big_blind,
            betting_structure = cfg.betting_structure,
            min_bet           = cfg.min_bet,
            max_bet           = cfg.max_bet,
        )
        game.start_hand()
        state.game    = game
        state.started = True
        state.pending_variant = None
        return game

    def next_hand(self, table_id: str, variant_override: str = None) -> Optional[PokerGame]:
        """Start a fresh hand on an already-running table."""
        state = self.get_table(table_id)
        if not state or not state.game:
            return None
        cfg = state.config
        variant_key = variant_override or state.pending_variant or cfg.variant
        if variant_key == "dealer_choice":
            variant_key = "texas_holdem"
        variant_cls = VARIANT_REGISTRY.get(variant_key, VARIANT_REGISTRY["texas_holdem"])

        # Only players with chips remaining
        active = [p for p in state.players if p.chips > 0]
        if len(active) < 2:
            return None

        game = variant_cls(
            table_id          = table_id,
            players           = active,
            small_blind       = cfg.small_blind,
            big_blind         = cfg.big_blind,
            betting_structure = cfg.betting_structure,
            min_bet           = cfg.min_bet,
            max_bet           = cfg.max_bet,
        )
        game.start_hand()
        state.game = game
        state.pending_variant = None
        return game

    def set_pending_variant(self, table_id: str, admin_id: str, variant: str) -> bool:
        state = self.get_table(table_id)
        if not state or state.admin_id != admin_id:
            return False
        if variant not in VARIANT_REGISTRY:
            return False
        state.pending_variant = variant
        return True

    def remove_player(self, table_id: str, user_id: str) -> None:
        state = self.get_table(table_id)
        if not state:
            return
        state.players = [p for p in state.players if p.user_id != user_id]
        if not state.players:
            del self._tables[table_id]

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
