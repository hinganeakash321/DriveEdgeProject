"""Shared schema helpers."""
from __future__ import annotations

from typing import Generic, List, TypeVar

from pydantic import BaseModel

T = TypeVar("T")


class Page(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    page_size: int

    @property
    def pages(self) -> int:
        if self.page_size <= 0:
            return 0
        return (self.total + self.page_size - 1) // self.page_size


class Message(BaseModel):
    detail: str


DISCLAIMER = (
    "Prices and specifications are indicative and may change. Confirm current "
    "details with the manufacturer or authorized dealership before purchasing."
)
