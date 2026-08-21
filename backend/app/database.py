"""Database engine and session management."""

from __future__ import annotations

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from .config import settings


class Base(DeclarativeBase):
    pass


engine = create_engine(
    settings.database_url,
    connect_args=(
        {"check_same_thread": False}
        if settings.database_url.startswith("sqlite")
        else {"options": f"-csearch_path={settings.database_schema},public"}
    ),
    future=True,
)


@event.listens_for(engine, "connect")
def _set_sqlite_pragma(dbapi_connection, _connection_record):
    """WAL + foreign keys. Without this SQLite silently ignores ON DELETE CASCADE."""
    if settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.close()


@event.listens_for(engine, "connect")
def _set_postgres_schema(dbapi_connection, _connection_record):
    if not settings.database_url.startswith("sqlite"):
        cursor = dbapi_connection.cursor()
        cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {settings.database_schema}")
        cursor.execute(f"SET search_path TO {settings.database_schema}, public")
        cursor.close()


SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False, future=True)


def get_db() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
