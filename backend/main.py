from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv
import os
import json
import asyncio
from typing import List

from .game_state import GameStateManager

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
time_update_task = None

@app.on_event("startup")
async def startup_event():
    """Start the time update task when the server starts"""
    global time_update_task
    time_update_task = asyncio.create_task(game_manager.send_time_updates())

@app.on_event("shutdown")
async def shutdown_event():
    """Cancel the time update task when the server shuts down"""
    global time_update_task
    if time_update_task:
        time_update_task.cancel()

@app.get("/")
def read_root():
    return {"message": "Pictionary Backend is running!"}

@app.websocket("/ws/{player_name}")
async def websocket_endpoint(websocket: WebSocket, player_name: str):
    player_id = await game_manager.connect(websocket)
    game_manager.add_player(player_id, player_name, websocket)

    try:
        # Send player their ID
        await websocket.send_json({
            "type": "player_info",
            "payload": {"player_id": player_id}
        })
        
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
                round_info = await game_manager.start_round()
                if round_info:
                    # Send the word to the drawer
                    drawer_id = round_info["drawer_id"]
                    if drawer_id in game_manager.game_state.players:
                        drawer_ws = game_manager.game_state.players[drawer_id].ws
                        await drawer_ws.send_json({
                            "type": "word_to_draw",
                            "payload": {"word": round_info["word_to_draw"]}
                        })

                    # Send round start to everyone
                    await game_manager.broadcast({
                        "type": "round_start",
                        "payload": {
                            "drawer_id": drawer_id,
                            "round_number": round_info["round_number"]
                        }
                    })

            elif message["type"] == "draw":
                # Only allow drawing from the current drawer
                if player_id == game_manager.game_state.current_drawer_id:
                    drawing_data = game_manager.receive_drawing_data(message["payload"])
                    await game_manager.broadcast(drawing_data, exclude_player_id=player_id)

            elif message["type"] == "clear":
                # Only allow clearing from the current drawer
                if player_id == game_manager.game_state.current_drawer_id:
                    await game_manager.broadcast({"type": "clear"}, exclude_player_id=player_id)

            elif message["type"] == "guess":
                guess = message["payload"]["message"]
                if game_manager.receive_guess(player_id, guess):
                    # Guess was correct
                    player = game_manager.game_state.players[player_id]
                    await game_manager.broadcast({
                        "type": "correct_guess",
                        "payload": {
                            "player_id": player_id,
                            "player_name": player.name,
                            "score": player.score
                        }
                    })
                else:
                    # Incorrect guess, broadcast as chat message
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
    except Exception as e:
        print(f"Error in websocket connection: {e}")
        game_manager.remove_player(player_id)
