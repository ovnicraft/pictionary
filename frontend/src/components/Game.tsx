import React, { useState, useEffect, useRef } from 'react';
import DrawingCanvas from './DrawingCanvas';
import JoinGame from './JoinGame';

// Add new types for game state
interface Player {
    id: string;
    name: string;
    score: number;
}

interface GameState {
    players: Player[];
    current_drawer_id: string | null;
    word_to_guess: string;
    round_start_time: number | null;
}

const Game = () => {
    const [username, setUsername] = useState<string>('');
    const [isJoined, setIsJoined] = useState<boolean>(false);
    const [gameState, setGameState] = useState<GameState>({
        players: [],
        current_drawer_id: null,
        word_to_guess: '',
        round_start_time: null,
    });
    const [wordToDraw, setWordToDraw] = useState<string>('');
    const [messages, setMessages] = useState<any[]>([]);
    const [guess, setGuess] = useState('');

    const websocket = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (isJoined && username) {
            const wsUrl = import.meta.env.VITE_WEBSOCKET_URL || 'ws://localhost:8000';
            websocket.current = new WebSocket(`${wsUrl}/ws/${username}`);

            websocket.current.onopen = () => {
                console.log('WebSocket connected');
            };

            websocket.current.onclose = () => {
                console.log('WebSocket disconnected');
            };

            websocket.current.onmessage = (event) => {
                const data = JSON.parse(event.data);
                console.log('Received message:', data);

                switch (data.type) {
                    case 'game_state':
                        setGameState(data.payload);
                        break;
                    case 'player_join':
                        setGameState(prevState => ({
                            ...prevState,
                            players: [...prevState.players, data.payload]
                        }));
                        break;
                    case 'player_leave':
                        setGameState(prevState => ({
                            ...prevState,
                            players: prevState.players.filter(p => p.id !== data.payload.player_id)
                        }));
                        break;
                    case 'round_start':
                        setGameState(prevState => ({
                            ...prevState,
                            current_drawer_id: data.payload.drawer_id,
                            word_to_guess: data.payload.word_hint,
                        }));
                        setWordToDraw(''); // Clear previous word for non-drawers
                        break;
                    case 'word_to_draw':
                        setWordToDraw(data.payload.word);
                        break;
                    case 'chat_message':
                    case 'correct_guess':
                        setMessages(prevMessages => [...prevMessages, data.payload]);
                        break;
                }
            };

            return () => {
                websocket.current?.close();
            };
        }
    }, [isJoined, username]);

    const handleJoin = (name: string) => {
        if (name.trim() !== '') {
            setUsername(name);
            setIsJoined(true);
        }
    };

    const handleStartGame = () => {
        if (websocket.current?.readyState === WebSocket.OPEN) {
            websocket.current.send(JSON.stringify({ type: 'start_game' }));
        }
    };

    const handleSendGuess = () => {
        if (guess.trim() && websocket.current?.readyState === WebSocket.OPEN) {
            websocket.current.send(JSON.stringify({
                type: 'guess',
                payload: { message: guess }
            }));
            setGuess('');
        }
    };

    if (!isJoined) {
        return <JoinGame onJoin={handleJoin} />;
    }

    const me = gameState.players.find(p => p.name === username);
    const currentDrawer = gameState.players.find(p => p.id === gameState.current_drawer_id);

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Game Status */}
            <div className="w-1/5 p-4 bg-gray-200">
                <h2 className="mb-4 text-xl font-bold">Game Info</h2>
                <div className="p-4 mb-4 bg-white rounded-md shadow-sm">
                    <h3 className="font-semibold">Current Drawer</h3>
                    <p>{currentDrawer ? currentDrawer.name : 'Waiting for players...'}</p>
                </div>
                <div className="p-4 mb-4 bg-white rounded-md shadow-sm">
                    <h3 className="font-semibold">Word</h3>
                    {me?.id === currentDrawer?.id ? (
                        <p className="text-2xl font-bold">{wordToDraw}</p>
                    ) : (
                        <p>{gameState.word_to_guess}</p>
                    )}
                </div>
                <div className="p-4 bg-white rounded-md shadow-sm">
                    <h3 className="font-semibold">Time</h3>
                    <p>60s</p> {/* Timer logic to be implemented */}
                </div>
                <button
                    onClick={handleStartGame}
                    className="w-full px-4 py-2 mt-4 font-bold text-white bg-green-500 rounded-md hover:bg-green-600"
                >
                    Start Game
                </button>
            </div>

            {/* Main Area */}
            <div className="flex flex-col flex-1">
                {/* Canvas */}
                <div className="flex-1 bg-white border-b border-l border-gray-300">
                    <DrawingCanvas websocket={websocket.current} />
                </div>

                {/* Chat/Guess Area */}
                <div className="flex h-48 border-l border-gray-300">
                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                        {messages.map((msg, index) => (
                            <div key={index} className="mb-2 text-sm">
                                <strong>{msg.player_name}: </strong>{msg.message}
                            </div>
                        ))}
                    </div>
                    <div className="flex p-4 bg-white border-l border-gray-300">
                        <input
                            type="text"
                            placeholder="Type your guess..."
                            className="flex-1 px-3 py-2 border rounded-l-md"
                            value={guess}
                            onChange={(e) => setGuess(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendGuess()}
                            disabled={me?.id === currentDrawer?.id}
                        />
                        <button
                            className="px-4 py-2 font-bold text-white bg-blue-500 rounded-r-md hover:bg-blue-600"
                            onClick={handleSendGuess}
                            disabled={me?.id === currentDrawer?.id}
                        >
                            Send
                        </button>
                    </div>
                </div>
            </div>

            {/* Scoreboard/Player List */}
            <div className="w-1/5 p-4 bg-gray-200 border-l border-gray-300">
                <h2 className="mb-4 text-xl font-bold">Players</h2>
                <ul className="p-4 bg-white rounded-md shadow-sm">
                    {gameState.players.map(player => (
                        <li key={player.id} className="flex justify-between p-2">
                            <span>{player.name} {player.id === me?.id ? '(You)' : ''}</span>
                            <span>{player.score}</span>
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
};

export default Game; 