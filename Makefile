.PHONY: dev backend frontend install

# Run both frontend and backend in development mode
dev:
	@echo "Starting Pictionary development servers..."
	@make -j 2 backend frontend

# Run backend server
backend:
	@echo "Starting backend server..."
	cd backend && uvicorn main:app --reload --host 0.0.0.0 --port 8000

# Run frontend server
frontend:
	@echo "Starting frontend server..."
	cd frontend && npm run dev

# Install dependencies
install:
	@echo "Installing backend dependencies..."
	cd backend && pip install -r requirements.txt || pip install fastapi uvicorn websockets python-dotenv
	@echo "Installing frontend dependencies..."
	cd frontend && npm install

# Clean up
clean:
	@echo "Cleaning up..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true