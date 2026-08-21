"""Copy the existing SQLite database into the AI-Learn PostgreSQL schema."""

from __future__ import annotations

import os

from sqlalchemy import create_engine, text
from sqlalchemy.orm import Session

from app.database import Base
from app import models  # noqa: F401 - register all models with Base.metadata


source_url = os.environ.get("SOURCE_DATABASE_URL", "sqlite:////app/data/hub.db")
target_url = os.environ["TARGET_DATABASE_URL"]
schema = os.environ.get("TARGET_DATABASE_SCHEMA", "ai_learn")

source = create_engine(source_url, connect_args={"check_same_thread": False})
target = create_engine(target_url, connect_args={"options": f"-csearch_path={schema},public"})
target_schema = target.execution_options(schema_translate_map={None: schema})

with target.begin() as conn:
    conn.execute(text(f"CREATE SCHEMA IF NOT EXISTS {schema}"))
    conn.execute(text(f"SET search_path TO {schema}, public"))

Base.metadata.create_all(target_schema)

with Session(source) as src, Session(target_schema) as dst:
    for table in Base.metadata.sorted_tables:
        rows = src.execute(table.select()).mappings().all()
        if rows:
            dst.execute(table.insert(), [dict(row) for row in rows])
            print(f"{table.name}: {len(rows)} rows")
    dst.commit()

with target_schema.begin() as conn:
    conn.execute(text(f"SET search_path TO {schema}, public"))
    for table in Base.metadata.sorted_tables:
        if "id" in table.c:
            sequence = f"{table.name}_id_seq"
            conn.execute(
                text(
                    f"SELECT setval('{schema}.{sequence}', "
                    f"COALESCE((SELECT MAX(id) FROM {schema}.{table.name}), 1), "
                    f"(SELECT COUNT(*) > 0 FROM {schema}.{table.name}))"
                )
            )

print(f"Migration complete: {schema}")
