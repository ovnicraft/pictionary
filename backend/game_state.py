import asyncio
import random
import uuid
import time
from typing import Dict, List, Optional, Set
from fastapi import WebSocket
from pydantic import BaseModel, Field


class Player(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    score: int = 0
    ws: WebSocket
    has_guessed: bool = False

    class Config:
        arbitrary_types_allowed = True


class GameState(BaseModel):
    players: Dict[str, Player] = {}
    game_status: str = "waiting"  # waiting, drawing, round_end
    current_word: Optional[str] = None
    current_drawer_id: Optional[str] = None
    chat_history: List[Dict] = []
    round_start_time: Optional[float] = None
    round_duration: int = 60  # in seconds
    round_number: int = 0
    max_rounds: int = 5
    used_words: Set[str] = set()
    players_who_guessed: Set[str] = set()
    drawer_history: List[str] = []  # Track who has drawn

    class Config:
        arbitrary_types_allowed = True


class GameStateManager:
    def __init__(self):
        self.game_state = GameState()
        # Enhanced word list with different categories
        self.words = [
            # Animals
            "cat", "dog", "elephant", "giraffe", "penguin", "kangaroo", "dolphin", "butterfly",
            "tiger", "lion", "bear", "rabbit", "horse", "cow", "sheep", "pig",
            
            # Objects
            "car", "bicycle", "airplane", "boat", "train", "computer", "phone", "book",
            "chair", "table", "lamp", "clock", "umbrella", "guitar", "piano", "camera",
            
            # Food
            "apple", "banana", "pizza", "hamburger", "ice cream", "cake", "cookie", "sandwich",
            "spaghetti", "salad", "soup", "cheese", "bread", "egg", "milk", "coffee",
            
            # Nature
            "tree", "flower", "mountain", "river", "ocean", "cloud", "sun", "moon",
            "star", "rainbow", "lightning", "snow", "rain", "forest", "desert", "island",
            
            # Activities
            "swimming", "running", "dancing", "singing", "cooking", "reading", "sleeping", "jumping",
            "flying", "driving", "painting", "writing", "playing", "eating", "drinking", "walking",
            
            # Places
            "house", "school", "hospital", "restaurant", "beach", "park", "zoo", "museum",
            "library", "cinema", "airport", "hotel", "church", "castle", "bridge", "stadium"
        ]
        self.round_end_task = None

    async def connect(self, websocket: WebSocket) -> str:
        await websocket.accept()
        player_id = str(uuid.uuid4())
        return player_id

    def add_player(self, player_id: str, name: str, ws: WebSocket):
        self.game_state.players[player_id] = Player(id=player_id, name=name, ws=ws)

    def remove_player(self, player_id: str):
        if player_id in self.game_state.players:
            del self.game_state.players[player_id]
            # If the drawer leaves, end the round
            if player_id == self.game_state.current_drawer_id:
                asyncio.create_task(self.end_round())

    async def broadcast(self, message: Dict, exclude_player_id: Optional[str] = None):
        disconnected_players = []
        for player_id, player in self.game_state.players.items():
            if player_id != exclude_player_id:
                try:
                    await player.ws.send_json(message)
                except:
                    disconnected_players.append(player_id)
        
        # Remove disconnected players
        for player_id in disconnected_players:
            self.remove_player(player_id)

    def get_next_drawer(self) -> Optional[str]:
        """Select the next drawer, ensuring everyone gets a turn before repeating"""
        available_players = list(self.game_state.players.keys())
        
        if not available_players:
            return None
            
        # Filter out players who have already drawn in this cycle
        players_not_drawn = [p for p in available_players if p not in self.game_state.drawer_history]
        
        # If everyone has drawn, reset the history
        if not players_not_drawn:
            self.game_state.drawer_history = []
            players_not_drawn = available_players
        
        # Select random player from those who haven't drawn
        next_drawer = random.choice(players_not_drawn)
        self.game_state.drawer_history.append(next_drawer)
        
        return next_drawer

    def get_unused_word(self) -> Optional[str]:
        """Get a random word that hasn't been used yet"""
        unused_words = [w for w in self.words if w not in self.game_state.used_words]
        
        # If all words have been used, reset
        if not unused_words:
            self.game_state.used_words = set()
            unused_words = self.words
        
        word = random.choice(unused_words)
        self.game_state.used_words.add(word)
        return word

    async def start_round(self):
        if len(self.game_state.players) < 2:
            return None
            
        # Cancel any existing round end task
        if self.round_end_task:
            self.round_end_task.cancel()
            
        # Get next drawer and word
        drawer_id = self.get_next_drawer()
        if not drawer_id:
            return None
            
        word = self.get_unused_word()
        
        # Update game state
        self.game_state.current_word = word
        self.game_state.current_drawer_id = drawer_id
        self.game_state.game_status = "drawing"
        self.game_state.round_start_time = time.time()
        self.game_state.round_number += 1
        self.game_state.players_who_guessed = set()
        
        # Reset player guess status
        for player in self.game_state.players.values():
            player.has_guessed = False
        
        # Schedule round end
        self.round_end_task = asyncio.create_task(self.auto_end_round())
        
        return {
            "drawer_id": drawer_id,
            "word_to_draw": word,
            "round_number": self.game_state.round_number
        }

    async def auto_end_round(self):
        """Automatically end the round after the time limit"""
        await asyncio.sleep(self.game_state.round_duration)
        await self.end_round()

    async def end_round(self):
        """End the current round and broadcast results"""
        if self.game_state.game_status != "drawing":
            return
            
        self.game_state.game_status = "round_end"
        
        # Cancel the auto-end task if it exists
        if self.round_end_task:
            self.round_end_task.cancel()
        
        # Give points to the drawer based on how many people guessed
        if self.game_state.current_drawer_id and self.game_state.current_drawer_id in self.game_state.players:
            drawer = self.game_state.players[self.game_state.current_drawer_id]
            guessed_count = len(self.game_state.players_who_guessed)
            drawer.score += guessed_count * 5  # 5 points per correct guess
        
        # Broadcast round end
        await self.broadcast({
            "type": "round_end",
            "payload": {
                "word": self.game_state.current_word,
                "drawer_id": self.game_state.current_drawer_id,
                "round_number": self.game_state.round_number,
                "scores": {p.id: p.score for p in self.game_state.players.values()}
            }
        })
        
        # Check if game should end
        if self.game_state.round_number >= self.game_state.max_rounds:
            await self.end_game()
        else:
            # Auto-start next round after a delay
            await asyncio.sleep(5)  # 5 second delay between rounds
            if len(self.game_state.players) >= 2:
                round_info = await self.start_round()
                if round_info:
                    # Send the word to the drawer
                    drawer_id = round_info["drawer_id"]
                    if drawer_id in self.game_state.players:
                        drawer_ws = self.game_state.players[drawer_id].ws
                        await drawer_ws.send_json({
                            "type": "word_to_draw",
                            "payload": {"word": round_info["word_to_draw"]}
                        })

                    # Send round start to everyone
                    await self.broadcast({
                        "type": "round_start",
                        "payload": {
                            "drawer_id": drawer_id,
                            "round_number": round_info["round_number"]
                        }
                    })

    async def end_game(self):
        """End the game and announce the winner"""
        self.game_state.game_status = "game_over"
        
        # Find winner(s)
        if self.game_state.players:
            max_score = max(p.score for p in self.game_state.players.values())
            winners = [p for p in self.game_state.players.values() if p.score == max_score]
            
            await self.broadcast({
                "type": "game_over",
                "payload": {
                    "winners": [{"id": w.id, "name": w.name, "score": w.score} for w in winners],
                    "final_scores": {p.id: {"name": p.name, "score": p.score} for p in self.game_state.players.values()}
                }
            })

    def receive_guess(self, player_id: str, guess: str) -> bool:
        """Process a player's guess"""
        if (self.game_state.game_status == "drawing" and 
            player_id != self.game_state.current_drawer_id and
            player_id not in self.game_state.players_who_guessed):
            
            # Check if guess is correct (case-insensitive)
            if guess.lower().strip() == self.game_state.current_word.lower():
                # Calculate points based on time remaining
                time_elapsed = time.time() - self.game_state.round_start_time
                time_remaining = max(0, self.game_state.round_duration - time_elapsed)
                
                # More points for faster guesses
                base_points = 100
                time_bonus = int(time_remaining / self.game_state.round_duration * 50)
                total_points = base_points + time_bonus
                
                # Update player score
                self.game_state.players[player_id].score += total_points
                self.game_state.players[player_id].has_guessed = True
                self.game_state.players_who_guessed.add(player_id)
                
                # Check if everyone has guessed
                non_drawer_players = [p for p in self.game_state.players.keys() if p != self.game_state.current_drawer_id]
                if len(self.game_state.players_who_guessed) == len(non_drawer_players):
                    # Everyone guessed, end round early
                    asyncio.create_task(self.end_round())
                
                return True
        return False

    def receive_drawing_data(self, data: Dict):
        """Process drawing data"""
        return {
            "type": "drawing_data",
            "payload": data
        }

    async def send_time_updates(self):
        """Send periodic time updates during rounds"""
        while True:
            if self.game_state.game_status == "drawing" and self.game_state.round_start_time:
                time_elapsed = time.time() - self.game_state.round_start_time
                time_left = max(0, self.game_state.round_duration - int(time_elapsed))
                
                await self.broadcast({
                    "type": "time_update",
                    "payload": {"time_left": time_left}
                })
                
                if time_left <= 0:
                    await self.end_round()
            
            await asyncio.sleep(1)  # Update every second

    def get_game_state_for_player(self, player_id: str) -> Dict:
        """Get the current game state for a specific player"""
        state = {
            "players": [{"id": p.id, "name": p.name, "score": p.score} for p in self.game_state.players.values()],
            "game_status": self.game_state.game_status,
            "current_drawer_id": self.game_state.current_drawer_id,
            "round_number": self.game_state.round_number,
            "max_rounds": self.game_state.max_rounds
        }
        
        # Hide the word from non-drawers
        if self.game_state.current_drawer_id != player_id and self.game_state.current_word:
            state['current_word'] = " ".join(["_" if c != " " else " " for c in self.game_state.current_word])
        else:
            state['current_word'] = self.game_state.current_word or ""
            
        # Calculate time left
        if self.game_state.game_status == "drawing" and self.game_state.round_start_time:
            time_elapsed = time.time() - self.game_state.round_start_time
            state['round_time_left'] = max(0, self.game_state.round_duration - int(time_elapsed))
        else:
            state['round_time_left'] = self.game_state.round_duration
            
        return state 