"""HTTP tests for the tracker API (/api/trackers).

Contract (frozen here before the frontend is built against it):
- GET    /api/trackers                    -> {trackers: [...]} (stats computed)
- POST   /api/trackers                    -> tracker (name, type, last_done_at?, note?)
- PATCH  /api/trackers/{id}               -> tracker (name?, note?, last_done_at?)
- DELETE /api/trackers/{id}               -> {status: "ok"}
- POST   /api/trackers/{id}/reset         -> tracker (timer only)
- POST   /api/trackers/{id}/events        -> tracker (counter only)
- DELETE /api/trackers/{id}/events/{eid}  -> tracker
Validation errors are 400; unknown tracker is 404; auth required everywhere.
"""

import pytest


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from backend.main import app
    with TestClient(app) as c:
        yield c


def _signup(client, username="alice"):
    return client.post("/api/auth/signup", json={
        "username": username,
        "password": "Secret123!",
        "security_question": "pet?",
        "security_answer": "fluffy",
    })


class TestCrud:
    def test_requires_auth(self, client):
        assert client.get("/api/trackers").status_code == 401
        assert client.post("/api/trackers", json={"name": "X", "type": "timer"}).status_code == 401

    def test_create_timer(self, client):
        _signup(client)
        r = client.post("/api/trackers", json={
            "name": "Quit smoking", "type": "timer",
            "last_done_at": "2026-10-01T09:00:00+00:00", "note": "You've got this",
        })
        assert r.status_code == 200
        t = r.json()
        assert t["name"] == "Quit smoking"
        assert t["type"] == "timer"
        assert t["note"] == "You've got this"
        assert "current_seconds" in t and "longest_seconds" in t

    def test_create_counter(self, client):
        _signup(client)
        r = client.post("/api/trackers", json={"name": "Anxiety crises", "type": "counter"})
        assert r.status_code == 200
        t = r.json()
        assert t["events"] == []
        assert t["event_count"] == 0

    def test_list_roundtrip(self, client):
        _signup(client)
        client.post("/api/trackers", json={"name": "A", "type": "timer"})
        client.post("/api/trackers", json={"name": "B", "type": "counter"})
        r = client.get("/api/trackers")
        assert r.status_code == 200
        names = sorted(t["name"] for t in r.json()["trackers"])
        assert names == ["A", "B"]

    def test_patch_tracker(self, client):
        _signup(client)
        t = client.post("/api/trackers", json={"name": "A", "type": "timer"}).json()
        r = client.patch(f"/api/trackers/{t['id']}",
                         json={"name": "B", "note": "strong"})
        assert r.status_code == 200
        assert r.json()["name"] == "B"
        assert r.json()["note"] == "strong"

    def test_delete_tracker(self, client):
        _signup(client)
        t = client.post("/api/trackers", json={"name": "A", "type": "counter"}).json()
        r = client.delete(f"/api/trackers/{t['id']}")
        assert r.status_code == 200
        assert client.get("/api/trackers").json()["trackers"] == []

    def test_unknown_tracker_404(self, client):
        _signup(client)
        assert client.patch("/api/trackers/nope", json={"name": "X"}).status_code == 404
        assert client.delete("/api/trackers/nope").status_code == 404


class TestTimerFlow:
    def test_reset_keeps_history_and_stats(self, client):
        from datetime import datetime, timezone
        _signup(client)
        t = client.post("/api/trackers", json={
            "name": "X", "type": "timer", "last_done_at": "2026-10-01T09:00:00+00:00",
        }).json()
        r = client.post(f"/api/trackers/{t['id']}/reset",
                        json={"at": "2026-10-13T11:59:50+00:00"})
        assert r.status_code == 200
        t = r.json()
        assert t["last_done_at"].startswith("2026-10-13T11:59:50")
        assert t["history"] == ["2026-10-01T09:00:00+00:00"]
        gap = 12 * 86400 + 2 * 3600 + 59 * 60 + 50  # Oct 1 09:00 -> Oct 13 11:59:50
        last = datetime.fromisoformat("2026-10-13T11:59:50+00:00")
        expected_current = int((datetime.now(timezone.utc) - last).total_seconds())
        assert abs(t["current_seconds"] - expected_current) <= 5
        assert abs(t["longest_seconds"] - max(gap, expected_current)) <= 5

    def test_stats_computed_on_list(self, client):
        _signup(client)
        client.post("/api/trackers", json={
            "name": "X", "type": "timer", "last_done_at": "2026-10-01T09:00:00+00:00",
        })
        t = client.get("/api/trackers").json()["trackers"][0]
        assert t["current_seconds"] > 0
        assert t["current_seconds"] == t["longest_seconds"]

    def test_reset_on_counter_400(self, client):
        _signup(client)
        t = client.post("/api/trackers", json={"name": "A", "type": "counter"}).json()
        assert client.post(f"/api/trackers/{t['id']}/reset", json={}).status_code == 400

    def test_reset_with_no_body_at_all(self, client):
        """Regression: a body-less POST must not 422 (crashed the UI with a
        Pydantic detail array rendered as a React child)."""
        _signup(client)
        t = client.post("/api/trackers", json={"name": "X", "type": "timer"}).json()
        r = client.post(f"/api/trackers/{t['id']}/reset")
        assert r.status_code == 200


class TestCounterFlow:
    def test_add_event_with_context(self, client):
        _signup(client)
        t = client.post("/api/trackers", json={"name": "Anxiety", "type": "counter"}).json()
        r = client.post(f"/api/trackers/{t['id']}/events", json={
            "at": "2026-10-14T09:30:00+00:00",
            "doing": "commuting on the subway",
            "feeling": "panicked, dizzy",
            "mind": "what if I faint and nobody helps",
            "triggers": "crowds, closed spaces",
        })
        assert r.status_code == 200
        e = r.json()["events"][0]
        assert e["doing"] == "commuting on the subway"
        assert e["triggers"] == "crowds, closed spaces"

    def test_multiple_events_per_day(self, client):
        """Root-cause use case: count crises per day, each with own context."""
        _signup(client)
        t = client.post("/api/trackers", json={"name": "Anxiety", "type": "counter"}).json()
        for hour in (9, 14, 20):
            client.post(f"/api/trackers/{t['id']}/events",
                        json={"at": f"2026-10-01T{hour:02d}:00:00+00:00"})
        t = client.get("/api/trackers").json()["trackers"][0]
        assert t["event_count"] == 3
        assert t["today_count"] == 0  # 2026-10-01 is not the real clock's day
        # per-day grouping is frontend work; backend supplies sorted events
        assert len(t["events"]) == 3

    def test_today_count_uses_real_clock(self, client):
        _signup(client)
        t = client.post("/api/trackers", json={"name": "A", "type": "counter"}).json()
        # no 'at' -> now, which is by definition today
        t = client.post(f"/api/trackers/{t['id']}/events", json={}).json()
        assert t["today_count"] == 1

    def test_delete_event(self, client):
        _signup(client)
        t = client.post("/api/trackers", json={"name": "A", "type": "counter"}).json()
        t = client.post(f"/api/trackers/{t['id']}/events", json={"at": "2026-10-14T09:00:00+00:00"}).json()
        eid = t["events"][0]["id"]
        r = client.delete(f"/api/trackers/{t['id']}/events/{eid}")
        assert r.status_code == 200
        assert r.json()["events"] == []

    def test_event_on_timer_400(self, client):
        _signup(client)
        t = client.post("/api/trackers", json={"name": "X", "type": "timer"}).json()
        assert client.post(f"/api/trackers/{t['id']}/events", json={}).status_code == 400


class TestValidation400:
    def test_bad_type(self, client):
        _signup(client)
        assert client.post("/api/trackers", json={"name": "X", "type": "nope"}).status_code == 400

    def test_empty_name(self, client):
        _signup(client)
        assert client.post("/api/trackers", json={"name": "  ", "type": "timer"}).status_code == 400

    def test_future_timestamp(self, client):
        _signup(client)
        r = client.post("/api/trackers", json={
            "name": "X", "type": "timer", "last_done_at": "2030-01-01T00:00:00+00:00",
        })
        assert r.status_code == 400


class TestUserIsolation:
    def test_trackers_do_not_leak_between_users(self, client):
        _signup(client, "alice")
        client.post("/api/trackers", json={"name": "alice-private", "type": "counter"})
        client.post("/api/auth/logout")
        _signup(client, "bob")
        assert client.get("/api/trackers").json()["trackers"] == []
