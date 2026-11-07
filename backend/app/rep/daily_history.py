"""Репозиторий ежедневной истории."""

from typing import Any

from app.rep.base import BaseRepository


class DailyHistoryRepository(BaseRepository):
    """Доступ к таблице ``daily_history``."""

    async def list_by_month(self, user_id: int, month: str) -> list[dict[str, Any]]:
        rows = await self._db.fetch_all(
            """
            SELECT date, mood, daily_progress, pos_points, neg_points,
                   habits_detail, updated_at
            FROM daily_history
            WHERE user_id = ? AND date LIKE ?
            """,
            (user_id, f"{month}-%"),
        )
        return [self._to_dict(row) for row in rows]

    async def get_updated_at(self, user_id: int, date: str) -> int | None:
        row = await self._db.fetch_one(
            "SELECT updated_at FROM daily_history WHERE user_id = ? AND date = ?",
            (user_id, date),
        )
        return row["updated_at"] if row else None

    async def upsert(self, entry: dict[str, Any], user_id: int) -> None:
        await self._db.execute(
            """
            INSERT OR REPLACE INTO daily_history
                (user_id, date, mood, daily_progress, pos_points,
                 neg_points, habits_detail, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                user_id,
                entry["date"],
                entry.get("mood"),
                entry.get("daily_progress", 0.0),
                entry.get("pos_points", 0),
                entry.get("neg_points", 0),
                entry.get("habits_detail", "[]"),
                entry.get("updatedAt", 0),
            ),
        )

    @staticmethod
    def _to_dict(row) -> dict[str, Any]:
        keys = row.keys()
        return {
            "date": row["date"],
            "mood": row["mood"],
            "daily_progress": row["daily_progress"],
            "pos_points": row["pos_points"],
            "neg_points": row["neg_points"],
            "habits_detail": row["habits_detail"] if "habits_detail" in keys else "[]",
            "updatedAt": row["updated_at"] if "updated_at" in keys else 0,
        }
