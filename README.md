# Pictionary Game

A real-time multiplayer Pictionary game built with React (Frontend) and FastAPI (Backend) featuring WebSocket communication for live drawing and guessing.

## Features

### Game Mechanics
- **Real-time Drawing**: Players can draw on a shared canvas that updates live for all participants
- **Turn-based Gameplay**: Players take turns being the drawer while others guess
- **Automatic Round Management**: Rounds automatically progress with configurable time limits
- **Smart Drawer Selection**: Ensures all players get a turn before anyone draws twice
- **Word Management**: Extensive word list with no repeats until all words are used
- **Scoring System**: 
  - Guessers earn points based on how quickly they guess (100 base + time bonus)
  - Drawers earn 5 points for each player who guesses correctly
- **Game Over Detection**: Game ends after a configurable number of rounds with winner announcement

### Frontend Features
- **Enhanced Drawing Controls**:
  - Color palette with 12 predefined colors plus custom color picker
  - 5 preset brush sizes (XS to XL) with fine-tuning slider (1-30px)
  - Clear canvas button
  - Visual feedback when it's not your turn to draw
- **Start Game Button**: First player (host) can start the game when 2+ players join
- **Live Game Status**: Shows current round, drawer, word hints, and remaining time
- **Real-time Chat**: Players can chat and make guesses
- **Player Scoreboard**: Live score updates with visual indicators for current drawer
- **Responsive UI**: Clean, modern interface with Tailwind CSS
- **Auto-focus Input**: Username input automatically focuses for better UX

### Backend Features
- **WebSocket Communication**: Real-time bidirectional communication
- **Game State Management**: Centralized state handling for consistency
- **Round Timer**: Automatic round ending with time tracking
- **Player Management**: Handle joins, disconnections, and reconnections gracefully
- **Word Selection**: Smart algorithm to avoid repeats
- **Score Calculation**: Time-based scoring for competitive gameplay
- **Broadcast System**: Efficient message distribution to all players

## Tech Stack

### Frontend
- React with TypeScript
- Vite for fast development
- Tailwind CSS for styling
- WebSocket API for real-time communication

### Backend
- FastAPI (Python)
- WebSockets for real-time features
- Pydantic for data validation
- asyncio for concurrent operations

## Getting Started

### Prerequisites
- Node.js (v14+)
- Python (3.8+)
- npm or yarn

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pictionary-game
```

2. Install dependencies:
```bash
make install
```

Or manually:
```bash
# Backend
cd backend
pip install fastapi uvicorn websockets python-dotenv

# Frontend
cd ../frontend
npm install
```

### Running the Game

Start both servers with:
```bash
make dev
```

Or run them separately:
```bash
# Terminal 1 - Backend
make backend

# Terminal 2 - Frontend
make frontend
```

The game will be available at:
- Frontend: http://localhost:5173
- Backend: http://localhost:8000

## How to Play

1. **Join the Game**: Enter your name on the join screen
2. **Wait for Players**: The first player becomes the host and can start the game
3. **Drawing Phase**: 
   - If you're the drawer, you'll see the word to draw
   - Use the drawing tools to create your masterpiece
   - Other players will try to guess
4. **Guessing**: Type your guesses in the chat
   - Correct guesses earn points based on speed
   - The drawer earns points for each correct guess
5. **Round End**: After 60 seconds or when everyone guesses
6. **Game Over**: After 5 rounds, the winner is announced

## Game Configuration

You can modify game settings in `backend/game_state.py`:
- `round_duration`: Time per round (default: 60 seconds)
- `max_rounds`: Number of rounds per game (default: 5)
- `words`: Add or modify the word list

## Project Structure

```
pictionary-game/
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Game.tsx         # Main game component
│   │   │   ├── DrawingCanvas.tsx # Canvas with drawing tools
│   │   │   └── JoinGame.tsx     # Join screen
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
├── backend/
│   ├── main.py          # FastAPI app and WebSocket endpoints
│   ├── game_state.py    # Game logic and state management
│   └── pyproject.toml
├── Makefile            # Development commands
└── README.md
```

## Contributing

Feel free to submit issues and enhancement requests!

## License

This project is open source and available under the MIT License.