import asyncio
import random
import uuid
from typing import Dict, List, Optional
from fastapi import WebSocket
from pydantic import BaseModel, Field


class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    score: int = 0
    ws: WebSocket

    class Config:
        arbitrary_types_allowed = True


class GameState(BaseModel):
    players: Dict[str, Player] = {}
    game_status: str = "waiting"
    current_word: Optional[str] = None
    current_drawer_id: Optional[str] = None
    chat_history: List[Dict] = []
    round_start_time: Optional[float] = None
    round_duration: int = 60  # in seconds


class GameStateManager:
    def __init__(self):
        self.game_state = GameState()
        self.words = ["apple", "banana", "car", "dog", "house", "tree", "computer", "book"]

    async def connect(self, websocket: WebSocket) -> str:
        await websocket.accept()
        player_id = str(uuid.uuid4())
        return player_id

    def add_player(self, player_id: str, name: str, ws: WebSocket):
        self.game_state.players[player_id] = Player(id=player_id, name=name, ws=ws)

    def remove_player(self, player_id: str):
        if player_id in self.game_state.players:
            del self.game_state.players[player_id]

    async def broadcast(self, message: Dict, exclude_player_id: Optional[str] = None):
        for player_id, player in self.game_state.players.items():
            if player_id != exclude_player_id:
                await player.ws.send_json(message)

    def start_round(self):
        if len(self.game_state.players) > 1:
            self.game_state.current_word = random.choice(self.words)
            drawer = random.choice(list(self.game_state.players.values()))
            self.game_state.current_drawer_id = drawer.id
            self.game_state.game_status = "drawing"
            self.game_state.round_start_time = asyncio.get_event_loop().time()
            # Inform everyone about the new round
            # You might want to send different info to the drawer (the word) vs others
            return {
                "type": "round_start",
                "drawer_id": self.game_state.current_drawer_id,
                "word_to_draw": self.game_state.current_word # This should only be sent to the drawer
            }
        return None

    def receive_guess(self, player_id: str, guess: str) -> bool:
        if self.game_state.game_status == "drawing" and player_id != self.game_state.current_drawer_id:
            if guess.lower() == self.game_state.current_word.lower():
                # Player guessed correctly
                self.game_state.players[player_id].score += 10
                # Maybe end the round or give points
                return True
        return False

    def receive_drawing_data(self, data: Dict):
        # For now, just broadcast to other players
        return {
            "type": "drawing_data",
            "payload": data
        }

    def get_game_state_for_player(self, player_id: str) -> Dict:
        state = self.game_state.dict(exclude={'players'})
        state['players'] = [p.dict(exclude={'ws'}) for p in self.game_state.players.values()]
        if self.game_state.current_drawer_id != player_id:
            state['current_word'] = "".join(["_" for _ in self.game_state.current_word]) if self.game_state.current_word else ""
        return state 