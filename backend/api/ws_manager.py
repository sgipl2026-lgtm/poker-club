"""
poker-app/backend/api/ws_manager.py

Manages WebSocket connections per table.
Ensures each player only receives their own private cards.
"""

from __future__ import annotations

import json
import logging
from collections import defaultdict

from fastapi import WebSocket

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        # table_id -> {user_id -> WebSocket}
        self._connections: dict[str, dict[str, WebSocket]] = defaultdict(dict)

    async def connect(self, websocket: WebSocket, table_id: str, user_id: str) -> None:
        await websocket.accept()
        self._connections[table_id][user_id] = websocket
        logger.info(f"WS connect  table={table_id} user={user_id}")

    def disconnect(self, table_id: str, user_id: str) -> None:
        self._connections[table_id].pop(user_id, None)
        if not self._connections[table_id]:
            del self._connections[table_id]
        logger.info(f"WS disconnect table={table_id} user={user_id}")

    async def send_personal(self, data: dict, table_id: str, user_id: str) -> None:
        ws = self._connections.get(table_id, {}).get(user_id)
        if ws:
            try:
                await ws.send_text(json.dumps(data))
            except Exception as e:
                logger.warning(f"send_personal failed {user_id}: {e}")

    async def broadcast_public(self, public_data: dict, table_id: str) -> None:
        """Send public state (no hole cards) to all connections."""
        text = json.dumps(public_data)
        dead = []
        for uid, ws in self._connections.get(table_id, {}).items():
            try:
                await ws.send_text(text)
            except Exception:
                dead.append(uid)
        for uid in dead:
            self.disconnect(table_id, uid)

    async def broadcast_game_state(self, game, table_id: str) -> None:
        """
        Critical security method:
        - Sends PUBLIC state (no cards) to all players via broadcast.
        - Then sends each player their PRIVATE state (with their own cards)
          as a second message, overwriting 'my_cards' and 'valid_actions'.
        """
        public = game.public_state()
        public["type"] = "game_state"
        await self.broadcast_public(public, table_id)

        for user_id in list(self._connections.get(table_id, {}).keys()):
            private = game.private_state(user_id)
            private["type"] = "private_update"
            await self.send_personal(private, table_id, user_id)

    async def broadcast_event(self, event: dict, table_id: str) -> None:
        event["type"] = event.get("type", "event")
        await self.broadcast_public(event, table_id)

    def table_user_ids(self, table_id: str) -> list[str]:
        return list(self._connections.get(table_id, {}).keys())
