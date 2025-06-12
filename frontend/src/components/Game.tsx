import React, { useState, useEffect, useRef } from 'react';
import DrawingCanvas from './DrawingCanvas';
import JoinGame from './JoinGame';

const Game = () => {
    const [username, setUsername] = useState<string>('');
    const [isJoined, setIsJoined] = useState<boolean>(false);
    const websocket = useRef<WebSocket | null>(null);

    useEffect(() => {
        if (isJoined && username) {
            websocket.current = new WebSocket(`ws://localhost:8000/ws/${username}`);

            websocket.current.onopen = () => {
                console.log('WebSocket connected');
            };

            websocket.current.onclose = () => {
                console.log('WebSocket disconnected');
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

    if (!isJoined) {
        return <JoinGame onJoin={handleJoin} />;
    }

    return (
        <div className="flex h-screen bg-gray-100">
            {/* Game Status */}
            <div className="w-1/5 p-4 bg-gray-200">
                <h2 className="mb-4 text-xl font-bold">Game Info</h2>
                <div className="p-4 mb-4 bg-white rounded-md shadow-sm">
                    <h3 className="font-semibold">Current Drawer</h3>
                    <p>Player 1</p>
                </div>
                <div className="p-4 mb-4 bg-white rounded-md shadow-sm">
                    <h3 className="font-semibold">Word</h3>
                    <p>_ _ _ _ _</p>
                </div>
                <div className="p-4 bg-white rounded-md shadow-sm">
                    <h3 className="font-semibold">Time</h3>
                    <p>60s</p>
                </div>
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
                        {/* Chat messages will be handled separately */}
                    </div>
                    <div className="flex p-4 bg-white border-l border-gray-300">
                        <input
                            type="text"
                            placeholder="Type your guess..."
                            className="flex-1 px-3 py-2 border rounded-l-md"
                        />
                        <button className="px-4 py-2 font-bold text-white bg-blue-500 rounded-r-md hover:bg-blue-600">
                            Send
                        </button>
                    </div>
                </div>
            </div>

            {/* Scoreboard/Player List */}
            <div className="w-1/5 p-4 bg-gray-200 border-l border-gray-300">
                <h2 className="mb-4 text-xl font-bold">Players</h2>
                <ul className="p-4 bg-white rounded-md shadow-sm">
                    <li className="flex justify-between p-2"><span>Player 1</span><span>120</span></li>
                    <li className="flex justify-between p-2 bg-gray-50"><span>Player 2</span><span>90</span></li>
                    <li className="flex justify-between p-2"><span>You</span><span>85</span></li>
                </ul>
            </div>
        </div>
    );
};

export default Game; 