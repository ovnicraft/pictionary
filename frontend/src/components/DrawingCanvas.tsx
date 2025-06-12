import React, { useRef, useEffect, useState } from 'react';

interface DrawingCanvasProps {
    websocket: WebSocket | null;
    canDraw: boolean;
}

const DrawingCanvas: React.FC<DrawingCanvasProps> = ({ websocket, canDraw }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [thickness, setThickness] = useState(5);

    // Predefined color palette
    const colorPalette = [
        '#000000', // Black
        '#FF0000', // Red
        '#00FF00', // Green
        '#0000FF', // Blue
        '#FFFF00', // Yellow
        '#FF00FF', // Magenta
        '#00FFFF', // Cyan
        '#FFA500', // Orange
        '#800080', // Purple
        '#FFC0CB', // Pink
        '#A52A2A', // Brown
        '#808080', // Gray
    ];

    // Brush size options
    const brushSizes = [
        { size: 2, label: 'XS' },
        { size: 5, label: 'S' },
        { size: 10, label: 'M' },
        { size: 15, label: 'L' },
        { size: 20, label: 'XL' },
    ];

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
                if (data.type === 'draw' || data.type === 'drawing_data') {
                    const payload = data.type === 'drawing_data' ? data.payload : data.payload;
                    const { x0, y0, x1, y1, color, thickness } = payload;
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
        if (!canDraw) return;
        
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
        if (!isDrawing || !canDraw) return;
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
        if (!canDraw) return;
        clearCanvasLocal();
        if (websocket?.readyState === WebSocket.OPEN) {
            websocket.send(JSON.stringify({ type: 'clear' }));
        }
    };

    return (
        <div className="flex flex-col items-center w-full h-full p-4">
            <div className="relative">
                <canvas
                    ref={canvasRef}
                    width={800}
                    height={500}
                    className={`border-2 border-gray-400 rounded-lg bg-white ${!canDraw ? 'cursor-not-allowed' : 'cursor-crosshair'}`}
                    onMouseDown={startDrawing}
                    onMouseMove={draw}
                    onMouseUp={stopDrawing}
                    onMouseOut={stopDrawing}
                />
                {!canDraw && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-10 rounded-lg">
                        <p className="text-gray-600 font-semibold">Waiting for your turn to draw...</p>
                    </div>
                )}
            </div>
            
            {canDraw && (
                <div className="mt-4 space-y-3">
                    {/* Color Palette */}
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-gray-700">Colors:</span>
                        <div className="flex space-x-1">
                            {colorPalette.map((paletteColor) => (
                                <button
                                    key={paletteColor}
                                    onClick={() => setColor(paletteColor)}
                                    className={`w-8 h-8 rounded border-2 transition-all ${
                                        color === paletteColor 
                                            ? 'border-gray-800 scale-110 shadow-md' 
                                            : 'border-gray-300 hover:border-gray-500'
                                    }`}
                                    style={{ backgroundColor: paletteColor }}
                                    title={paletteColor}
                                />
                            ))}
                            {/* Custom color picker */}
                            <input
                                type="color"
                                value={color}
                                onChange={(e) => setColor(e.target.value)}
                                className="w-8 h-8 rounded border-2 border-gray-300 cursor-pointer"
                                title="Custom color"
                            />
                        </div>
                    </div>

                    {/* Brush Size */}
                    <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-gray-700">Brush:</span>
                        <div className="flex space-x-2">
                            {brushSizes.map((brush) => (
                                <button
                                    key={brush.size}
                                    onClick={() => setThickness(brush.size)}
                                    className={`px-3 py-1 rounded border-2 transition-all ${
                                        thickness === brush.size
                                            ? 'border-blue-500 bg-blue-100 text-blue-700'
                                            : 'border-gray-300 hover:border-gray-500'
                                    }`}
                                >
                                    {brush.label}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center space-x-2 ml-4">
                            <input
                                type="range"
                                min="1"
                                max="30"
                                value={thickness}
                                onChange={(e) => setThickness(Number(e.target.value))}
                                className="w-32"
                            />
                            <span className="text-sm text-gray-600 w-8">{thickness}px</span>
                        </div>
                    </div>

                    {/* Clear Button */}
                    <div className="flex items-center space-x-2">
                        <button
                            onClick={clearCanvas}
                            className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                        >
                            Clear Canvas
                        </button>
                        <span className="text-xs text-gray-500">
                            Tip: Draw something for others to guess!
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
};

export default DrawingCanvas; 