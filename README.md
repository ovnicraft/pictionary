# Pictionary Game

This is a simple real-time Pictionary game built with FastAPI and React.

## Running the application with Docker

The easiest way to run the application is using Docker and Docker Compose.

### Instructions

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    cd pictionary
    ```

2.  Build and run the application:
    ```bash
    docker-compose up --build
    ```

The frontend will be available at http://localhost:5173 and the backend at http://localhost:8000.

## Manual Setup

If you prefer to run the application without Docker, follow the instructions below.

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt # Assuming you have a requirements.txt, or use pyproject.toml
uvicorn main:app --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

