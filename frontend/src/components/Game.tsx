import React, { useState, useEffect, useRef } from 'react';
import DrawingCanvas from './DrawingCanvas';
import JoinGame from './JoinGame';

interface Player {
    id: string;
    name: string;
    score: number;
}

interface GameState {
    players: Player[];
    game_status: 'waiting' | 'drawing' | 'round_end' | 'game_over';
    current_drawer_id: string | null;
    current_word: string;
    round_time_left: number;
    round_number: number;
    max_rounds: number;
}

const Game = () => {
    const [username, setUsername] = useState<string>('');
    const [isJoined, setIsJoined] = useState<boolean>(false);
    const [gameState, setGameState] = useState<GameState>({
        players: [],
        game_status: 'waiting',
        current_drawer_id: null,
        current_word: '',
        round_time_left: 60,
        round_number: 1,
        max_rounds: 5
    });
    const [playerId, setPlayerId] = useState<string>('');
    const [isHost, setIsHost] = useState<boolean>(false);
    const [chatMessages, setChatMessages] = useState<Array<{player_name: string, message: string}>>([]);
    const [guessInput, setGuessInput] = useState<string>('');
    const [wordToDraw, setWordToDraw] = useState<string>('');
    const websocket = useRef<WebSocket | null>(null);
    const chatEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (isJoined && username) {
            websocket.current = new WebSocket(`ws://localhost:8000/ws/${username}`);

            websocket.current.onopen = () => {
                console.log('WebSocket connected');
            };

            websocket.current.onmessage = (event: MessageEvent) => {
                const data = JSON.parse(event.data);
                console.log('Received:', data);

                switch (data.type) {
                    case 'game_state':
                        setGameState(data.payload);
                        // First player becomes host
                        if (data.payload.players.length === 1) {
                            setIsHost(true);
                        }
                        break;
                    case 'player_info':
                        setPlayerId(data.payload.player_id);
                        break;
                    case 'player_join':
                        setGameState((prev: GameState) => ({
                            ...prev,
                            players: [...prev.players, data.payload]
                        }));
                        break;
                    case 'player_leave':
                        setGameState((prev: GameState) => ({
                            ...prev,
                            players: prev.players.filter((p: Player) => p.id !== data.payload.player_id)
                        }));
                        break;
                    case 'round_start':
                        setGameState((prev: GameState) => ({
                            ...prev,
                            game_status: 'drawing',
                            current_drawer_id: data.payload.drawer_id,
                            round_time_left: 60,
                            round_number: data.payload.round_number || prev.round_number
                        }));
                        setWordToDraw('');
                        setChatMessages([]);
                        break;
                    case 'word_to_draw':
                        setWordToDraw(data.payload.word);
                        break;
                    case 'chat_message':
                        setChatMessages((prev: Array<{player_name: string, message: string}>) => [...prev, {
                            player_name: data.payload.player_name,
                            message: data.payload.message
                        }]);
                        break;
                    case 'correct_guess':
                        setChatMessages((prev: Array<{player_name: string, message: string}>) => [...prev, {
                            player_name: 'System',
                            message: `${data.payload.player_name} guessed correctly!`
                        }]);
                        setGameState((prev: GameState) => ({
                            ...prev,
                            players: prev.players.map((p: Player) => 
                                p.id === data.payload.player_id 
                                    ? { ...p, score: data.payload.score }
                                    : p
                            )
                        }));
                        break;
                    case 'round_end':
                        setGameState((prev: GameState) => ({
                            ...prev,
                            game_status: 'round_end',
                            current_drawer_id: null
                        }));
                        setChatMessages((prev: Array<{player_name: string, message: string}>) => [...prev, {
                            player_name: 'System',
                            message: `Round ended! The word was: ${data.payload.word}`
                        }]);
                        // Update scores from payload
                        if (data.payload.scores) {
                            setGameState((prev: GameState) => ({
                                ...prev,
                                players: prev.players.map((p: Player) => ({
                                    ...p,
                                    score: data.payload.scores[p.id] || p.score
                                }))
                            }));
                        }
                        break;
                    case 'game_over':
                        setGameState((prev: GameState) => ({
                            ...prev,
                            game_status: 'game_over' as any
                        }));
                        const winners = data.payload.winners.map((w: any) => w.name).join(', ');
                        setChatMessages((prev: Array<{player_name: string, message: string}>) => [...prev, {
                            player_name: 'System',
                            message: `Game Over! Winner(s): ${winners}`
                        }]);
                        break;
                    case 'time_update':
                        setGameState((prev: GameState) => ({
                            ...prev,
                            round_time_left: data.payload.time_left
                        }));
                        break;
                }
            };

            websocket.current.onclose = () => {
                console.log('WebSocket disconnected');
            };

            return () => {
                websocket.current?.close();
            };
        }
    }, [isJoined, username]);

    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

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
        if (guessInput.trim() && websocket.current?.readyState === WebSocket.OPEN) {
            websocket.current.send(JSON.stringify({
                type: 'guess',
                payload: { message: guessInput }
            }));
            setGuessInput('');
        }
    };

    const isDrawing = gameState.current_drawer_id === playerId;
    const currentDrawer = gameState.players.find(p => p.id === gameState.current_drawer_id);

    if (!isJoined) {
        return <JoinGame onJoin={handleJoin} />;
    }

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Game Status */}
            <div className="w-1/5 p-4 bg-gray-200">
                <h2 className="mb-4 text-xl font-bold">Game Info</h2>
                
                {gameState.game_status === 'waiting' && isHost && (
                    <button
                        onClick={handleStartGame}
                        className="w-full mb-4 px-4 py-2 font-bold text-white bg-green-500 rounded-md hover:bg-green-600"
                        disabled={gameState.players.length < 2}
                    >
                        {gameState.players.length < 2 ? 'Waiting for players...' : 'Start Game'}
                    </button>
                )}
                
                <div className="p-4 mb-4 bg-white rounded-md shadow-sm">
                    <h3 className="font-semibold">Status</h3>
                    <p className="capitalize">{gameState.game_status.replace('_', ' ')}</p>
                </div>
                
                <div className="p-4 mb-4 bg-white rounded-md shadow-sm">
                    <h3 className="font-semibold">Round</h3>
                    <p>{gameState.round_number} / {gameState.max_rounds}</p>
                </div>
                
                {gameState.game_status === 'drawing' && (
                    <>
                        <div className="p-4 mb-4 bg-white rounded-md shadow-sm">
                            <h3 className="font-semibold">Current Drawer</h3>
                            <p>{currentDrawer?.name || 'None'}</p>
                        </div>
                        <div className="p-4 mb-4 bg-white rounded-md shadow-sm">
                            <h3 className="font-semibold">Word</h3>
                            <p className="font-mono text-lg">
                                {isDrawing ? wordToDraw : gameState.current_word}
                            </p>
                        </div>
                        <div className="p-4 bg-white rounded-md shadow-sm">
                            <h3 className="font-semibold">Time</h3>
                            <p className="text-2xl font-bold">{gameState.round_time_left}s</p>
                        </div>
                    </>
                )}
                
                {gameState.game_status === 'game_over' && (
                    <div className="p-4 bg-yellow-100 rounded-md shadow-sm">
                        <h3 className="font-semibold text-yellow-800">Game Over!</h3>
                        <p className="text-sm">Check the chat for results</p>
                        {isHost && (
                            <button
                                onClick={handleStartGame}
                                className="w-full mt-2 px-4 py-2 font-bold text-white bg-green-500 rounded-md hover:bg-green-600"
                            >
                                New Game
                            </button>
                        )}
                    </div>
                )}
            </div>

            {/* Main Area */}
            <div className="flex flex-col flex-1">
                {/* Canvas */}
                <div className="flex-1 bg-white border-b border-l border-gray-300">
                    <DrawingCanvas 
                        websocket={websocket.current} 
                        canDraw={isDrawing && gameState.game_status === 'drawing'}
                    />
                </div>

                {/* Chat/Guess Area */}
                <div className="flex h-48 border-l border-gray-300">
                    <div className="flex-1 p-4 overflow-y-auto bg-gray-50">
                        {chatMessages.map((msg, index) => (
                            <div key={index} className="mb-2">
                                <span className="font-semibold">{msg.player_name}: </span>
                                <span>{msg.message}</span>
                            </div>
                        ))}
                        <div ref={chatEndRef} />
                    </div>
                    <div className="flex p-4 bg-white border-l border-gray-300">
                        <input
                            type="text"
                            value={guessInput}
                            onChange={(e) => setGuessInput(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSendGuess()}
                            placeholder={isDrawing ? "You're drawing!" : "Type your guess..."}
                            disabled={isDrawing || gameState.game_status !== 'drawing'}
                            className="flex-1 px-3 py-2 border rounded-l-md disabled:bg-gray-100"
                        />
                        <button 
                            onClick={handleSendGuess}
                            disabled={isDrawing || gameState.game_status !== 'drawing'}
                            className="px-4 py-2 font-bold text-white bg-blue-500 rounded-r-md hover:bg-blue-600 disabled:bg-gray-400"
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
                    {gameState.players
                        .sort((a, b) => b.score - a.score)
                        .map((player) => (
                            <li 
                                key={player.id} 
                                className={`flex justify-between p-2 ${player.id === playerId ? 'bg-blue-100' : ''} ${player.id === gameState.current_drawer_id ? 'border-2 border-green-500' : ''}`}
                            >
                                <span>{player.name} {player.id === playerId && '(You)'}</span>
                                <span className="font-bold">{player.score}</span>
                            </li>
                        ))}
                </ul>
            </div>
        </div>
    );
};

export default Game; 