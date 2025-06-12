FROM python:3.13-slim

WORKDIR /app

COPY pyproject.toml .

RUN pip install uv

RUN uv sync

COPY . .

CMD ["python", "main.py"]