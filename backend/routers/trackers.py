"""Tracker API — habit tracking (timer/withdraw + counter/diagnostics)."""

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from datetime import datetime, timezone

from backend.routers.auth import _get_session
from backend import trackers as store

router = APIRouter(prefix="/api/trackers", tags=["trackers"])


def _session(request):
    session = _get_session(request)
    if session is None:
        raise HTTPException(401, "Not authenticated")
    return session


def _call(fn, *args, **kwargs):
    """Run a store op, mapping validation errors to HTTP codes."""
    try:
        return fn(*args, **kwargs)
    except ValueError as e:
        if str(e) == "Tracker not found":
            raise HTTPException(404, "Tracker not found")
        raise HTTPException(400, str(e))


def _present(t: dict) -> dict:
    """Tracker + computed stats for the UI."""
    out = dict(t)
    if t.get("type") == "timer":
        out.update(store.timer_stats(t))
    else:
        events = t.get("events", [])
        out["event_count"] = len(events)
        today = datetime.now(timezone.utc).date().isoformat()
        out["today_count"] = sum(
            1 for e in events if str(e.get("at", ""))[:10] == today)
    return out


class TrackerCreate(BaseModel):
    name: str
    type: str
    last_done_at: str | None = None
    note: str = ""


class TrackerPatch(BaseModel):
    name: str | None = None
    note: str | None = None
    last_done_at: str | None = None


class ResetBody(BaseModel):
    at: str | None = None


class EventBody(BaseModel):
    at: str | None = None
    doing: str = ""
    feeling: str = ""
    mind: str = ""
    triggers: str = ""


@router.get("")
def list_trackers(request: Request):
    session = _session(request)
    items = store.load_trackers(session["username"], session["user_key"])
    return {"trackers": [_present(t) for t in items]}


@router.post("")
def create_tracker(body: TrackerCreate, request: Request):
    session = _session(request)
    t = _call(store.create_tracker, session["username"], session["user_key"],
              body.name, body.type, last_done_at=body.last_done_at,
              note=body.note)
    return _present(t)


@router.patch("/{tracker_id}")
def patch_tracker(tracker_id: str, body: TrackerPatch, request: Request):
    session = _session(request)
    t = _call(store.update_tracker, session["username"], session["user_key"],
              tracker_id, name=body.name, note=body.note,
              last_done_at=body.last_done_at)
    return _present(t)


@router.delete("/{tracker_id}")
def delete_tracker(tracker_id: str, request: Request):
    session = _session(request)
    if not _call(store.delete_tracker, session["username"], session["user_key"], tracker_id):
        raise HTTPException(404, "Tracker not found")
    return {"status": "ok"}


@router.post("/{tracker_id}/reset")
def reset_timer(tracker_id: str, request: Request, body: ResetBody | None = None):
    session = _session(request)
    t = _call(store.reset_timer, session["username"], session["user_key"],
              tracker_id, at=body.at if body else None)
    return _present(t)


@router.post("/{tracker_id}/events")
def add_event(tracker_id: str, body: EventBody, request: Request):
    session = _session(request)
    t = _call(store.add_event, session["username"], session["user_key"],
              tracker_id, at=body.at, doing=body.doing, feeling=body.feeling,
              mind=body.mind, triggers=body.triggers)
    return _present(t)


@router.delete("/{tracker_id}/events/{event_id}")
def delete_event(tracker_id: str, event_id: str, request: Request):
    session = _session(request)
    result = _call(store.delete_event, session["username"], session["user_key"],
                   tracker_id, event_id)
    if result is False:
        raise HTTPException(404, "Event not found")
    return _present(result)
