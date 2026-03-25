"""
poker-app/backend/game/engine.py

Core poker engine: Card, Deck, HandEvaluator, and the abstract PokerGame base
class.  All game variants inherit from PokerGame and override only the methods
that differ (deal_hands, handle_draw_phase, best_hand_from, etc.).
"""

from __future__ import annotations

import random
import itertools
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Optional


# ---------------------------------------------------------------------------
# Primitives
# ---------------------------------------------------------------------------

class Suit(str, Enum):
    SPADES   = "s"
    HEARTS   = "h"
    DIAMONDS = "d"
    CLUBS    = "c"


class Rank(int, Enum):
    TWO   = 2;  THREE = 3;  FOUR  = 4;  FIVE  = 5
    SIX   = 6;  SEVEN = 7;  EIGHT = 8;  NINE  = 9
    TEN   = 10; JACK  = 11; QUEEN = 12; KING  = 13; ACE = 14


RANK_SYMBOL = {
    2:"2", 3:"3", 4:"4", 5:"5", 6:"6", 7:"7", 8:"8", 9:"9",
    10:"T", 11:"J", 12:"Q", 13:"K", 14:"A",
}


@dataclass(frozen=True)
class Card:
    rank: Rank
    suit: Suit

    def __str__(self) -> str:
        return f"{RANK_SYMBOL[self.rank]}{self.suit.value}"

    def to_dict(self) -> dict:
        return {"rank": self.rank.value, "suit": self.suit.value, "str": str(self)}


class Deck:
    def __init__(self) -> None:
        self._cards: list[Card] = [
            Card(rank, suit) for suit in Suit for rank in Rank
        ]
        random.shuffle(self._cards)

    def deal(self, n: int = 1) -> list[Card]:
        if n > len(self._cards):
            raise ValueError("Not enough cards in deck")
        dealt, self._cards = self._cards[:n], self._cards[n:]
        return dealt

    def burn(self) -> None:
        self._cards.pop(0)

    def remaining(self) -> int:
        return len(self._cards)


# ---------------------------------------------------------------------------
# Hand evaluation
# ---------------------------------------------------------------------------

class HandRank(int, Enum):
    HIGH_CARD       = 1
    ONE_PAIR        = 2
    TWO_PAIR        = 3
    THREE_OF_A_KIND = 4
    STRAIGHT        = 5
    FLUSH           = 6
    FULL_HOUSE      = 7
    FOUR_OF_A_KIND  = 8
    STRAIGHT_FLUSH  = 9
    ROYAL_FLUSH     = 10


@dataclass(order=True)
class HandResult:
    """Comparable hand result used to determine the winner."""
    rank: HandRank
    tiebreakers: tuple        # tuple of ints for secondary comparison
    cards: list[Card] = field(compare=False)
    description: str = field(compare=False, default="")

    def to_dict(self) -> dict:
        return {
            "rank": self.rank.value,
            "rank_name": self.rank.name.replace("_", " ").title(),
            "description": self.description,
            "cards": [c.to_dict() for c in self.cards],
        }


class HandEvaluator:
    """
    Evaluates the best 5-card hand from any number of cards (≥ 5).
    Works for Hold'em community-card combos and standalone 5-card hands.
    """

    @classmethod
    def best_five(cls, cards: list[Card]) -> HandResult:
        if len(cards) < 5:
            raise ValueError(f"Need at least 5 cards, got {len(cards)}")
        return max(
            cls._evaluate(list(combo))
            for combo in itertools.combinations(cards, 5)
        )

    @classmethod
    def _evaluate(cls, five: list[Card]) -> HandResult:
        ranks  = sorted([c.rank.value for c in five], reverse=True)
        suits  = [c.suit for c in five]
        is_flush    = len(set(suits)) == 1
        is_straight = cls._is_straight(ranks)
        rank_counts = {}
        for r in ranks:
            rank_counts[r] = rank_counts.get(r, 0) + 1
        groups = sorted(rank_counts.items(), key=lambda x: (x[1], x[0]), reverse=True)

        if is_straight and is_flush:
            hr = HandRank.ROYAL_FLUSH if ranks[0] == 14 else HandRank.STRAIGHT_FLUSH
            top = 5 if ranks == [14, 5, 4, 3, 2] else ranks[0]
            return HandResult(hr, (top,), five, f"{'Royal' if hr==HandRank.ROYAL_FLUSH else 'Straight'} Flush")

        if groups[0][1] == 4:
            quad, kicker = groups[0][0], groups[1][0]
            return HandResult(HandRank.FOUR_OF_A_KIND, (quad, kicker), five, f"Four {RANK_SYMBOL[quad]}s")

        if groups[0][1] == 3 and groups[1][1] == 2:
            trip, pair = groups[0][0], groups[1][0]
            return HandResult(HandRank.FULL_HOUSE, (trip, pair), five, f"Full House {RANK_SYMBOL[trip]}s full of {RANK_SYMBOL[pair]}s")

        if is_flush:
            return HandResult(HandRank.FLUSH, tuple(ranks), five, "Flush")

        if is_straight:
            top = 5 if ranks == [14, 5, 4, 3, 2] else ranks[0]
            return HandResult(HandRank.STRAIGHT, (top,), five, f"Straight to {RANK_SYMBOL[top]}")

        if groups[0][1] == 3:
            trip = groups[0][0]
            kickers = tuple(g[0] for g in groups[1:])
            return HandResult(HandRank.THREE_OF_A_KIND, (trip,) + kickers, five, f"Three {RANK_SYMBOL[trip]}s")

        if groups[0][1] == 2 and groups[1][1] == 2:
            p1, p2 = groups[0][0], groups[1][0]
            kicker = groups[2][0]
            return HandResult(HandRank.TWO_PAIR, (max(p1,p2), min(p1,p2), kicker), five, f"Two Pair {RANK_SYMBOL[max(p1,p2)]}s and {RANK_SYMBOL[min(p1,p2)]}s")

        if groups[0][1] == 2:
            pair = groups[0][0]
            kickers = tuple(g[0] for g in groups[1:])
            return HandResult(HandRank.ONE_PAIR, (pair,) + kickers, five, f"Pair of {RANK_SYMBOL[pair]}s")

        return HandResult(HandRank.HIGH_CARD, tuple(ranks), five, f"{RANK_SYMBOL[ranks[0]]} High")

    @staticmethod
    def _is_straight(ranks: list[int]) -> bool:
        unique = sorted(set(ranks), reverse=True)
        if len(unique) < 5:
            return False
        # Normal straight
        if unique[0] - unique[4] == 4:
            return True
        # Wheel: A-2-3-4-5
        if unique == [14, 5, 4, 3, 2]:
            return True
        return False


# ---------------------------------------------------------------------------
# Game state enums & player model
# ---------------------------------------------------------------------------

class BettingStructure(str, Enum):
    NO_LIMIT  = "no_limit"
    POT_LIMIT = "pot_limit"
    FIXED     = "fixed"


class PlayerAction(str, Enum):
    FOLD      = "fold"
    CHECK     = "check"
    CALL      = "call"
    RAISE     = "raise"
    ALL_IN    = "all_in"
    DISCARD   = "discard"   # draw games


class GamePhase(str, Enum):
    WAITING    = "waiting"
    STARTING   = "starting"
    PREFLOP    = "preflop"
    FLOP       = "flop"
    TURN       = "turn"
    RIVER      = "river"
    SHOWDOWN   = "showdown"
    DRAW       = "draw"
    FINISHED   = "finished"


@dataclass
class Player:
    user_id:    str
    username:   str
    seat:       int
    chips:      int
    hole_cards: list[Card]  = field(default_factory=list)
    bet:        int         = 0
    total_bet:  int         = 0   # across all streets in this hand
    folded:     bool        = False
    all_in:     bool        = False
    is_sitting_out: bool    = False
    hands_won:  int         = 0

    def to_public_dict(self) -> dict:
        """Safe representation: never exposes hole cards."""
        return {
            "user_id":   self.user_id,
            "username":  self.username,
            "seat":      self.seat,
            "chips":     self.chips,
            "bet":       self.bet,
            "folded":    self.folded,
            "all_in":    self.all_in,
            "card_count": len(self.hole_cards),
        }

    def to_private_dict(self) -> dict:
        """Full representation for this player only."""
        d = self.to_public_dict()
        d["hole_cards"] = [c.to_dict() for c in self.hole_cards]
        return d

    def reset_for_hand(self) -> None:
        self.hole_cards = []
        self.bet        = 0
        self.total_bet  = 0
        self.folded     = False
        self.all_in     = False


@dataclass
class Pot:
    amount:   int              = 0
    eligible: list[str]        = field(default_factory=list)  # user_ids
    name:     str              = "Main Pot"

    def to_dict(self) -> dict:
        return {"amount": self.amount, "eligible": self.eligible, "name": self.name}


# ---------------------------------------------------------------------------
# Abstract base game
# ---------------------------------------------------------------------------

class PokerGame(ABC):
    """
    Base class for all poker variants.

    Subclasses MUST implement:
        deal_hands()        — deal hole cards to each player
        advance_phase()     — move the game to the next street/phase
        best_hand_from()    — return HandResult for a player at showdown

    Subclasses MAY override:
        valid_actions()     — which actions are legal right now
        handle_action()     — extend to add draw-phase logic, etc.
    """

    VARIANT_NAME: str = "Base Poker"
    HOLE_CARDS:   int = 2     # override in subclass

    def __init__(
        self,
        table_id:          str,
        players:           list[Player],
        small_blind:       int,
        big_blind:         int,
        betting_structure: BettingStructure = BettingStructure.NO_LIMIT,
        min_bet:           int = 0,
        max_bet:           int = 0,
    ) -> None:
        self.table_id          = table_id
        self.players           = players          # ordered by seat
        self.small_blind       = small_blind
        self.big_blind         = big_blind
        self.betting_structure = betting_structure
        self.min_bet           = min_bet or big_blind
        self.max_bet           = max_bet
        self.deck              = Deck()
        self.community_cards:  list[Card] = []
        self.pots:             list[Pot]  = [Pot(eligible=[p.user_id for p in players])]
        self.phase:            GamePhase  = GamePhase.WAITING
        self.dealer_idx:       int        = 0
        self.action_idx:       int        = 0
        self.current_bet:      int        = 0
        self.last_raiser_idx:  Optional[int] = None
        self.hand_number:      int        = 0
        self.action_log:       list[dict] = []

    # -- Properties ----------------------------------------------------------

    @property
    def active_players(self) -> list[Player]:
        return [p for p in self.players if not p.folded and not p.is_sitting_out]

    @property
    def players_in_hand(self) -> list[Player]:
        return [p for p in self.players if not p.folded]

    @property
    def current_player(self) -> Optional[Player]:
        if 0 <= self.action_idx < len(self.players):
            return self.players[self.action_idx]
        return None

    @property
    def main_pot(self) -> int:
        return sum(p.amount for p in self.pots)

    # -- Abstract methods (variants must implement) ---------------------------

    @abstractmethod
    def deal_hands(self) -> None: ...

    @abstractmethod
    def advance_phase(self) -> None: ...

    @abstractmethod
    def best_hand_from(self, player: Player) -> HandResult: ...

    # -- Shared mechanics ----------------------------------------------------

    def start_hand(self) -> None:
        self.hand_number += 1
        self.deck = Deck()
        self.community_cards = []
        self.pots = [Pot(eligible=[p.user_id for p in self.active_players])]
        self.current_bet = 0
        self.last_raiser_idx = None
        self.action_log = []
        for p in self.players:
            p.reset_for_hand()
        self._post_blinds()
        self.deal_hands()
        self.phase = GamePhase.PREFLOP

    def _post_blinds(self) -> None:
        n = len(self.active_players)
        sb_idx = (self.dealer_idx + 1) % n
        bb_idx = (self.dealer_idx + 2) % n
        self._force_bet(self.active_players[sb_idx], self.small_blind)
        self._force_bet(self.active_players[bb_idx], self.big_blind)
        self.current_bet = self.big_blind
        # Action starts left of BB
        self.action_idx = (bb_idx + 1) % n

    def _force_bet(self, player: Player, amount: int) -> None:
        actual = min(amount, player.chips)
        player.chips    -= actual
        player.bet      += actual
        player.total_bet += actual
        self.pots[0].amount += actual
        if player.chips == 0:
            player.all_in = True

    def valid_actions(self, player: Player) -> list[dict]:
        to_call = self.current_bet - player.bet
        actions = [{"action": PlayerAction.FOLD}]
        if to_call == 0:
            actions.append({"action": PlayerAction.CHECK})
        else:
            actions.append({"action": PlayerAction.CALL, "amount": min(to_call, player.chips)})
        # Raise sizing
        min_raise = self.current_bet + max(self.current_bet, self.big_blind)
        if self.betting_structure == BettingStructure.POT_LIMIT:
            max_raise = self.main_pot + to_call
        elif self.betting_structure == BettingStructure.FIXED:
            max_raise = self.current_bet + (self.big_blind * 2)
        else:  # NO_LIMIT
            max_raise = player.chips + player.bet
        if player.chips > to_call:
            actions.append({
                "action": PlayerAction.RAISE,
                "min": min_raise,
                "max": min(max_raise, player.chips + player.bet),
            })
        if player.chips > 0:
            actions.append({"action": PlayerAction.ALL_IN, "amount": player.chips})
        return actions

    def handle_action(self, user_id: str, action: PlayerAction, amount: int = 0) -> dict:
        player = next((p for p in self.players if p.user_id == user_id), None)
        if not player or player != self.current_player:
            return {"error": "Not your turn"}

        log_entry = {"user_id": user_id, "username": player.username,
                     "action": action, "amount": 0, "phase": self.phase}

        if action == PlayerAction.FOLD:
            player.folded = True

        elif action == PlayerAction.CHECK:
            if player.bet < self.current_bet:
                return {"error": "Cannot check — must call or raise"}

        elif action == PlayerAction.CALL:
            to_call = min(self.current_bet - player.bet, player.chips)
            player.chips    -= to_call
            player.bet      += to_call
            player.total_bet += to_call
            self.pots[0].amount += to_call
            log_entry["amount"] = to_call
            if player.chips == 0:
                player.all_in = True

        elif action == PlayerAction.RAISE:
            to_call = self.current_bet - player.bet
            raise_total = min(amount, player.chips + player.bet)
            added = raise_total - player.bet
            if added <= 0 or raise_total <= self.current_bet:
                return {"error": "Invalid raise amount"}
            player.chips    -= added
            player.bet       = raise_total
            player.total_bet += added
            self.pots[0].amount += added
            self.current_bet = raise_total
            self.last_raiser_idx = self.action_idx
            log_entry["amount"] = raise_total
            if player.chips == 0:
                player.all_in = True

        elif action == PlayerAction.ALL_IN:
            chips = player.chips
            player.bet      += chips
            player.total_bet += chips
            player.chips     = 0
            player.all_in    = True
            self.pots[0].amount += chips
            if player.bet > self.current_bet:
                self.current_bet = player.bet
                self.last_raiser_idx = self.action_idx
            log_entry["amount"] = chips

        self.action_log.append(log_entry)
        self._advance_action()
        return {"ok": True, "log": log_entry}

    def _advance_action(self) -> None:
        n = len(self.active_players)
        active = [p for p in self.players if not p.folded and not p.all_in]

        # If only one player remains, hand is over
        if len(self.players_in_hand) <= 1:
            self._end_hand()
            return

        # Find next player who needs to act
        start = self.action_idx
        for _ in range(n):
            self.action_idx = (self.action_idx + 1) % n
            next_p = self.active_players[self.action_idx] if self.active_players else None
            if next_p and not next_p.folded and not next_p.all_in:
                # Check if betting round is complete
                if self.action_idx == (self.last_raiser_idx or self._bb_idx()):
                    self.advance_phase()
                    return
                if next_p.bet == self.current_bet:
                    self.advance_phase()
                    return
                return  # next player acts
        self.advance_phase()

    def _bb_idx(self) -> int:
        return (self.dealer_idx + 2) % len(self.active_players)

    def _deal_community(self, n: int) -> None:
        self.deck.burn()
        self.community_cards.extend(self.deck.deal(n))

    def _reset_betting(self) -> None:
        self.current_bet = 0
        self.last_raiser_idx = None
        for p in self.players:
            p.bet = 0
        # Action starts left of dealer
        n = len(self.active_players)
        self.action_idx = (self.dealer_idx + 1) % n
        while self.active_players[self.action_idx].folded:
            self.action_idx = (self.action_idx + 1) % n

    def _end_hand(self) -> None:
        self.phase = GamePhase.SHOWDOWN
        self._compute_side_pots()
        winners = self._determine_winners()
        self.phase = GamePhase.FINISHED
        self.dealer_idx = (self.dealer_idx + 1) % len(self.active_players)
        return winners

    def _compute_side_pots(self) -> None:
        """Rebuild pots correctly when all-ins are present."""
        all_in_players = sorted(
            [p for p in self.players if p.all_in and not p.folded],
            key=lambda p: p.total_bet
        )
        if not all_in_players:
            return
        self.pots = []
        prev_cap = 0
        for ai in all_in_players:
            cap = ai.total_bet
            pot_amount = 0
            eligible = []
            for p in self.players:
                if p.folded:
                    continue
                contrib = min(p.total_bet, cap) - prev_cap
                if contrib > 0:
                    pot_amount += contrib
                    eligible.append(p.user_id)
            if pot_amount > 0:
                self.pots.append(Pot(pot_amount, eligible, f"Side Pot {len(self.pots)+1}"))
            prev_cap = cap
        # Remaining chips go to main pot
        remaining = sum(
            p.total_bet - prev_cap
            for p in self.players
            if not p.folded and p.total_bet > prev_cap
        )
        if remaining > 0:
            eligible = [p.user_id for p in self.players
                        if not p.folded and not p.all_in]
            self.pots.append(Pot(remaining, eligible, "Main Pot"))

    def _determine_winners(self) -> list[dict]:
        results = []
        for pot in self.pots:
            contenders = [p for p in self.players
                          if p.user_id in pot.eligible and not p.folded]
            if not contenders:
                continue
            evaluated = [(p, self.best_hand_from(p)) for p in contenders]
            evaluated.sort(key=lambda x: x[1], reverse=True)
            best_result = evaluated[0][1]
            winners_of_pot = [p for p, r in evaluated if r == best_result]
            share = pot.amount // len(winners_of_pot)
            remainder = pot.amount % len(winners_of_pot)
            for i, w in enumerate(winners_of_pot):
                prize = share + (remainder if i == 0 else 0)
                w.chips += prize
                w.hands_won += 1
                results.append({
                    "user_id": w.user_id,
                    "username": w.username,
                    "pot": pot.name,
                    "amount": prize,
                    "hand": best_result.to_dict(),
                })
        return results

    def public_state(self) -> dict:
        """State broadcast to all players (no private cards)."""
        return {
            "table_id":        self.table_id,
            "variant":         self.VARIANT_NAME,
            "phase":           self.phase.value,
            "hand_number":     self.hand_number,
            "community_cards": [c.to_dict() for c in self.community_cards],
            "pots":            [p.to_dict() for p in self.pots],
            "current_bet":     self.current_bet,
            "players":         [p.to_public_dict() for p in self.players],
            "action_on":       self.current_player.user_id if self.current_player else None,
            "dealer_seat":     self.players[self.dealer_idx].seat,
        }

    def private_state(self, user_id: str) -> dict:
        """State sent only to a specific player — includes their hole cards."""
        state = self.public_state()
        player = next((p for p in self.players if p.user_id == user_id), None)
        if player:
            state["my_cards"] = [c.to_dict() for c in player.hole_cards]
            state["valid_actions"] = self.valid_actions(player) if not player.folded else []
        return state
