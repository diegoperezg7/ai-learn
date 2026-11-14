"""Editable plan configuration, stored in the `settings` table.

The roadmap calendar (start date, weekly hours, rest days, deadlines) used to live
in `config.py` and be read straight from the environment. That made every change a
code change. Here it lives in the database instead: `config.settings` is only the
default used to bootstrap an empty database, and from then on the values are edited
from the app and read back through `load()`.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import select
from sqlalchemy.orm import Session

from ..config import settings as env
from ..models import Setting

# settings keys
START_DATE = "plan.start_date"
WEEKLY_HOURS = "plan.weekly_target_hours"
REST_WEEKDAYS = "plan.rest_weekdays"  # CSV of ints, 0=Mon .. 6=Sun
CORE_DEADLINE = "plan.core_deadline"
FINAL_DEADLINE = "plan.final_deadline"
VAULT_AUTOSYNC = "plan.vault_autosync"  # "true"/"false": mirror the plan to the Obsidian vault
SEEDED = "seeded"


@dataclass(frozen=True)
class PlanConfig:
    start_date: date
    core_deadline: date
    final_deadline: date
    weekly_target_hours: float
    rest_weekdays: set[int]


def _parse_rest(raw: str | None) -> set[int]:
    if not raw:
        return set()
    out: set[int] = set()
    for chunk in raw.split(","):
        chunk = chunk.strip()
        if chunk.isdigit() and 0 <= int(chunk) <= 6:
            out.add(int(chunk))
    return out


def get(db: Session, key: str, default: str | None = None) -> str | None:
    row = db.get(Setting, key)
    return row.value if row is not None else default


def put(db: Session, key: str, value: str) -> None:
    row = db.get(Setting, key)
    if row is None:
        db.add(Setting(key=key, value=value))
    else:
        row.value = value


def put_many(db: Session, values: dict[str, str]) -> None:
    for key, value in values.items():
        put(db, key, value)
    db.commit()


def is_seeded(db: Session) -> bool:
    return get(db, SEEDED) == "true"


def mark_seeded(db: Session) -> None:
    put(db, SEEDED, "true")
    db.commit()


def env_defaults() -> dict[str, str]:
    """The bootstrap defaults, taken from the environment-backed config."""
    return {
        START_DATE: env.sprint_start.isoformat(),
        CORE_DEADLINE: env.core_deadline.isoformat(),
        FINAL_DEADLINE: env.final_deadline.isoformat(),
        WEEKLY_HOURS: str(env.weekly_target_hours),
        # Default rest day: Sunday. The old schedule used a mid-week free day, but
        # once the calendar is driven from real weekdays, Sunday is the natural default.
        REST_WEEKDAYS: "6",
        VAULT_AUTOSYNC: "true",
    }


def ensure_defaults(db: Session) -> None:
    """Write any missing `plan.*` key from the env defaults, without overwriting edits."""
    defaults = env_defaults()
    missing = {k: v for k, v in defaults.items() if db.get(Setting, k) is None}
    if missing:
        put_many(db, missing)


def load(db: Session) -> PlanConfig:
    """Read the live plan config, falling back to env defaults for any missing key."""
    defaults = env_defaults()

    def _date(key: str) -> date:
        return date.fromisoformat(get(db, key, defaults[key]) or defaults[key])

    hours_raw = get(db, WEEKLY_HOURS, defaults[WEEKLY_HOURS]) or defaults[WEEKLY_HOURS]
    try:
        hours = float(hours_raw)
    except ValueError:
        hours = env.weekly_target_hours

    rest = _parse_rest(get(db, REST_WEEKDAYS, defaults[REST_WEEKDAYS]))

    return PlanConfig(
        start_date=_date(START_DATE),
        core_deadline=_date(CORE_DEADLINE),
        final_deadline=_date(FINAL_DEADLINE),
        weekly_target_hours=hours,
        rest_weekdays=rest,
    )
