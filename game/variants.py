"""
poker-app/backend/game/variants.py

Concrete poker variant implementations.
Adding a new variant = subclass PokerGame + implement 3 methods.
"""

from __future__ import annotations

import itertools
from typing import Optional

from .engine import (
    PokerGame, Player, HandResult, HandEvaluator,
    GamePhase, PlayerAction, BettingStructure, Card
)


# ---------------------------------------------------------------------------
# Texas Hold'em
# ---------------------------------------------------------------------------

class TexasHoldem(PokerGame):
    VARIANT_NAME = "Texas Hold'em"
    HOLE_CARDS   = 2

    def deal_hands(self) -> None:
        for player in self.active_players:
            player.hole_cards = self.deck.deal(self.HOLE_CARDS)

    def advance_phase(self) -> None:
        self._reset_betting()
        if self.phase == GamePhase.PREFLOP:
            self._deal_community(3)
            self.phase = GamePhase.FLOP
        elif self.phase == GamePhase.FLOP:
            self._deal_community(1)
            self.phase = GamePhase.TURN
        elif self.phase == GamePhase.TURN:
            self._deal_community(1)
            self.phase = GamePhase.RIVER
        elif self.phase == GamePhase.RIVER:
            self._end_hand()

    def best_hand_from(self, player: Player) -> HandResult:
        all_cards = player.hole_cards + self.community_cards
        return HandEvaluator.best_five(all_cards)


# ---------------------------------------------------------------------------
# Omaha (4 hole cards, must use exactly 2 hole + 3 community)
# ---------------------------------------------------------------------------

class Omaha(PokerGame):
    VARIANT_NAME = "Omaha"
    HOLE_CARDS   = 4

    def deal_hands(self) -> None:
        for player in self.active_players:
            player.hole_cards = self.deck.deal(self.HOLE_CARDS)

    def advance_phase(self) -> None:
        self._reset_betting()
        if self.phase == GamePhase.PREFLOP:
            self._deal_community(3)
            self.phase = GamePhase.FLOP
        elif self.phase == GamePhase.FLOP:
            self._deal_community(1)
            self.phase = GamePhase.TURN
        elif self.phase == GamePhase.TURN:
            self._deal_community(1)
            self.phase = GamePhase.RIVER
        elif self.phase == GamePhase.RIVER:
            self._end_hand()

    def best_hand_from(self, player: Player) -> HandResult:
        """Omaha rule: must use exactly 2 hole cards + 3 community cards."""
        best: Optional[HandResult] = None
        for hole_combo in itertools.combinations(player.hole_cards, 2):
            for comm_combo in itertools.combinations(self.community_cards, 3):
                result = HandEvaluator.best_five(list(hole_combo) + list(comm_combo))
                if best is None or result > best:
                    best = result
        return best  # type: ignore[return-value]


# ---------------------------------------------------------------------------
# Omaha Hi-Lo (8-or-better low qualifier)
# ---------------------------------------------------------------------------

class OmahaHiLo(Omaha):
    VARIANT_NAME = "Omaha Hi-Lo"

    def _best_low_from(self, player: Player) -> Optional[tuple]:
        """
        Returns a comparable low-hand tuple (lower is better) or None if no
        qualifying low (five distinct ranks ≤ 8, A counts as 1).
        """
        LOW_RANKS = {14: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 6, 7: 7, 8: 8}
        qualifying_community = [
            c for c in self.community_cards if c.rank.value in LOW_RANKS or c.rank.value == 14
        ]
        if len(qualifying_community) < 3:
            return None

        best_low: Optional[tuple] = None
        for hole_combo in itertools.combinations(player.hole_cards, 2):
            for comm_combo in itertools.combinations(qualifying_community, 3):
                all_five = list(hole_combo) + list(comm_combo)
                low_vals = sorted(
                    [LOW_RANKS.get(c.rank.value, 99) for c in all_five]
                )
                if len(set(low_vals)) == 5 and low_vals[4] <= 8:
                    # Represent as descending tuple — Python compares tuples
                    # element-by-element, so lower tuple = better low hand
                    candidate = tuple(sorted(low_vals, reverse=True))
                    if best_low is None or candidate < best_low:
                        best_low = candidate
        return best_low

    def _determine_winners(self) -> list[dict]:  # type: ignore[override]
        """Split each pot between the best HIGH hand and best LOW hand."""
        results = []
        for pot in self.pots:
            contenders = [p for p in self.players
                          if p.user_id in pot.eligible and not p.folded]
            if not contenders:
                continue

            # High winners
            hi_eval = [(p, self.best_hand_from(p)) for p in contenders]
            hi_eval.sort(key=lambda x: x[1], reverse=True)
            best_hi = hi_eval[0][1]
            hi_winners = [p for p, r in hi_eval if r == best_hi]

            # Low winners (may be empty if no qualifier)
            lo_eval = [(p, self._best_low_from(p)) for p in contenders]
            lo_winners = [p for p, lo in lo_eval if lo is not None]
            if lo_winners:
                best_lo = min(lo for _, lo in lo_eval if lo is not None)
                lo_winners = [p for p, lo in lo_eval if lo == best_lo]

            hi_share = pot.amount // 2
            lo_share = pot.amount - hi_share

            if not lo_winners:
                # Scoop: all to high
                hi_share = pot.amount

            for i, w in enumerate(hi_winners):
                prize = hi_share // len(hi_winners) + (hi_share % len(hi_winners) if i == 0 else 0)
                w.chips += prize
                w.hands_won += 1
                results.append({
                    "user_id": w.user_id, "username": w.username,
                    "pot": pot.name + " (High)", "amount": prize,
                    "hand": best_hi.to_dict(),
                })

            if lo_winners:
                for i, w in enumerate(lo_winners):
                    prize = lo_share // len(lo_winners) + (lo_share % len(lo_winners) if i == 0 else 0)
                    w.chips += prize
                    results.append({
                        "user_id": w.user_id, "username": w.username,
                        "pot": pot.name + " (Low)", "amount": prize,
                        "hand": {"rank_name": "Low Hand"},
                    })
        return results


# ---------------------------------------------------------------------------
# Registry — add new variants here; backend uses this to instantiate games
# ---------------------------------------------------------------------------

VARIANT_REGISTRY: dict[str, type[PokerGame]] = {
    "texas_holdem": TexasHoldem,
    "omaha":        Omaha,
    "omaha_hilo":   OmahaHiLo,
    # "seven_stud":  SevenCardStud,   ← plug in future variants here
    # "short_deck":  ShortDeck,
}
