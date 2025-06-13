from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import json
from typing import List

from game_state import GameStateManager

load_dotenv()

app = FastAPI()

origins = [
    "http://localhost:5173",
    "http://localhost:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

game_manager = GameStateManager()

@app.get("/")
def read_root():
    return {"message": "Pictionary Backend is running!"}

@app.websocket("/ws/{player_name}")
async def websocket_endpoint(websocket: WebSocket, player_name: str):
    player_id = await game_manager.connect(websocket)
    game_manager.add_player(player_id, player_name, websocket)

    try:
        # Send current game state to the new player
        initial_state = game_manager.get_game_state_for_player(player_id)
        await websocket.send_json({"type": "game_state", "payload": initial_state})
        
        # Broadcast updated player list to all players
        await game_manager.broadcast({
            "type": "player_join", 
            "payload": {
                "id": player_id, 
                "name": player_name, 
                "score": 0
            }
        })

        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            
            if message["type"] == "start_game":
                round_info = game_manager.start_round()
                if round_info:
                    # Send the word to the drawer
                    drawer_id = round_info["drawer_id"]
                    drawer_ws = game_manager.game_state.players[drawer_id].ws
                    await drawer_ws.send_json({
                        "type": "word_to_draw",
                        "payload": {"word": round_info["word_to_draw"]}
                    })

                    # Send round start to everyone else
                    word_hint = "".join(["_ " for _ in round_info["word_to_draw"]]).strip()
                    await game_manager.broadcast({
                        "type": "round_start",
                        "payload": {
                            "drawer_id": drawer_id,
                            "word_hint": word_hint
                        }
                    }, exclude_player_id=drawer_id)


            elif message["type"] == "draw":
                drawing_data = game_manager.receive_drawing_data(message["payload"])
                await game_manager.broadcast(drawing_data, exclude_player_id=player_id)

            elif message["type"] == "guess":
                guess = message["payload"]["message"]
                if game_manager.receive_guess(player_id, guess):
                    # Guess was correct
                    await game_manager.broadcast({
                        "type": "correct_guess",
                        "payload": {
                            "player_id": player_id,
                            "player_name": game_manager.game_state.players[player_id].name
                        }
                    })
                    # Potentially start a new round here or end the game
                else:
                    # Incorrect guess, broadcast chat message
                    await game_manager.broadcast({
                        "type": "chat_message",
                        "payload": {
                            "player_id": player_id,
                            "player_name": game_manager.game_state.players[player_id].name,
                            "message": guess
                        }
                    })

    except WebSocketDisconnect:
        game_manager.remove_player(player_id)
        await game_manager.broadcast({
            "type": "player_leave", 
            "payload": {"player_id": player_id}
        })
