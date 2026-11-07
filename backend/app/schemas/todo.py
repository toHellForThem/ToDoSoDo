"""Схемы задач."""

from typing import Union

from pydantic import BaseModel


class Todo(BaseModel):
    id: str
    text: str
    completed: bool = False
    deleted: bool = False
    updatedAt: int = 0
    type: str = "todo"
    progressNow: Union[int, str] = 0
    progressEnd: Union[int, str] = 1
    contribution: int = 0
    days: str = "1111111"
