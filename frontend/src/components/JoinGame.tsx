import React, { useState, useEffect, useRef } from 'react';

interface JoinGameProps {
    onJoin: (username: string) => void;
}

const JoinGame: React.FC<JoinGameProps> = ({ onJoin }) => {
    const [username, setUsername] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        // Auto-focus the input when component mounts
        inputRef.current?.focus();
    }, []);

    const handleJoin = () => {
        if (username.trim()) {
            onJoin(username);
        }
    };

    return (
        <div className="flex items-center justify-center h-screen bg-[#242424]">
            <div className="w-full max-w-sm p-8 bg-[#1a1a1a] rounded-lg shadow-md text-white">
                <h1 className="mb-6 text-3xl font-bold text-center">Join Pictionary</h1>
                <input
                    ref={inputRef}
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                    placeholder="Enter your name"
                    className="w-full px-3 py-2 mb-4 text-white bg-[#242424] border border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                    onClick={handleJoin}
                    className="w-full px-4 py-2 font-bold text-white bg-blue-500 rounded-md hover:bg-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                    Join Game
                </button>
            </div>
        </div>
    );
};

export default JoinGame; 