"""Точка входа: собирает сервер и отдаёт ASGI-приложение для uvicorn."""

from app.server import create_server

server = create_server()

app = server.app
socket_app = server.asgi
