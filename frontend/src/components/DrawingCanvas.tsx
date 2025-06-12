import React, { useRef, useEffect, useState } from 'react';

interface DrawingCanvasProps {
    websocket: WebSocket | null;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ websocket }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [thickness, setThickness] = useState(5);

    const getContext = () => {
        const canvas = canvasRef.current;
        return canvas?.getContext('2d');
    };

    useEffect(() => {
        const ctx = getContext();
        if (ctx) {
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
        }

        if (websocket) {
            websocket.onmessage = (event) => {
                const data = JSON.parse(event.data);
                if (data.type === 'draw') {
                    const { x0, y0, x1, y1, color, thickness } = data.payload;
                    const ctx = getContext();
                    if (ctx) {
                        ctx.beginPath();
                        ctx.moveTo(x0, y0);
                        ctx.lineTo(x1, y1);
                        ctx.strokeStyle = color;
                        ctx.lineWidth = thickness;
                        ctx.stroke();
                        ctx.closePath();
                    }
                } else if (data.type === 'clear') {
                    clearCanvasLocal();
                }
            };
        }
    }, [websocket]);

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const ctx = getContext();
        if (!ctx) return;

        setIsDrawing(true);
        ctx.strokeStyle = color;
        ctx.lineWidth = thickness;
        ctx.beginPath();
        ctx.moveTo(e.nativeEvent.offsetX, e.nativeEvent.offsetY);

        if (websocket?.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                type: 'draw',
                payload: {
                    x0: e.nativeEvent.offsetX,
                    y0: e.nativeEvent.offsetY,
                    x1: e.nativeEvent.offsetX,
                    y1: e.nativeEvent.offsetY,
                    color,
                    thickness
                }
            }));
        }
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const ctx = getContext();
        if (!ctx) return;

        const x1 = e.nativeEvent.offsetX;
        const y1 = e.nativeEvent.offsetY;
        const x0 = x1 - e.movementX;
        const y0 = y1 - e.movementY;

        ctx.lineTo(x1, y1);
        ctx.stroke();

        if (websocket?.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({
                type: 'draw',
                payload: {
                    x0,
                    y0,
                    x1,
                    y1,
                    color,
                    thickness
                }
            }));
        }
    };

    const stopDrawing = () => {
        const ctx = getContext();
        if (!ctx) return;

        ctx.closePath();
        setIsDrawing(false);
    };

    const clearCanvasLocal = () => {
        const canvas = canvasRef.current;
        const ctx = getContext();
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const clearCanvas = () => {
        clearCanvasLocal();
        if (websocket?.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({ type: 'clear' }));
        }
    };

    return (
        <div className="flex flex-col items-center w-full h-full">
            <canvas
                ref={canvasRef}
                width={800}
                height={600}
                className="border border-gray-400 rounded-lg bg-white"
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseOut={stopDrawing}
            />
            <div className="mt-4 flex items-center space-x-4">
                <input
                    type="color"
                    value={color}
                    onChange={(e) => setColor(e.target.value)}
                    className="w-10 h-10 p-1 border rounded"
                />
                <input
                    type="range"
                    min="1"
                    max="20"
                    value={thickness}
                    onChange={(e) => setThickness(Number(e.target.value))}
                    className="w-40"
                />
                <button
                    onClick={clearCanvas}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                    Clear Canvas
                </button>
            </div>
        </div>
    );
};

export default DrawingCanvas; 