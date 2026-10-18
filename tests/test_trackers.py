"""Tests for the habit tracker store (backend.trackers).

Two tracker types, one encrypted JSON file per user (data/{user}_trackers.enc):
- timer:   last_done_at + motivational note + reset history (quit/withdraw timer)
- counter: per-occurrence events with diagnostic context
           (what were you doing / how are you feeling / on your mind / triggers)

Privacy: tracker data is as sensitive as journal entries — encrypted at rest
with the user's key (AES-256-GCM), same as freewrite. A test asserts no
plaintext ever touches the disk.
"""

import pytest
from datetime import datetime, timezone, timedelta

from backend import trackers
from backend.crypto import generate_user_key

NOW = datetime(2026, 10, 14, 12, 0, tzinfo=timezone.utc)
T0 = "2026-10-01T09:00:00+00:00"


def iso(dt):
    return dt.isoformat()


class TestLoadSave:
    def test_missing_file_is_empty(self, isolated_data_dir):
        assert trackers.load_trackers("ghost", generate_user_key()) == []

    def test_roundtrip(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="Anxiety crises",
                                    tracker_type="counter", now=NOW)
        loaded = trackers.load_trackers("alice", key)
        assert [x["id"] for x in loaded] == [t["id"]]
        assert loaded[0]["name"] == "Anxiety crises"
        assert loaded[0]["events"] == []

    def test_no_plaintext_on_disk(self, isolated_data_dir):
        key = generate_user_key()
        trackers.create_tracker("alice", key, name="TOPSECRETNAME",
                                tracker_type="counter", now=NOW)
        trackers.add_event("alice", key, trackers.load_trackers("alice", key)[0]["id"],
                           at=NOW, doing="TOPSECRETDOING", feeling="awful",
                           mind="racing", triggers="work")
        import os
        from backend import config
        raw = open(os.path.join(config.DATA_DIR, "alice_trackers.enc"), "rb").read()
        for marker in (b"TOPSECRETNAME", b"TOPSECRETDOING", b"racing"):
            assert marker not in raw

    def test_users_are_isolated(self, isolated_data_dir):
        ka, kb = generate_user_key(), generate_user_key()
        trackers.create_tracker("alice", ka, name="A", tracker_type="counter", now=NOW)
        assert trackers.load_trackers("bob", kb) == []

    def test_wrong_key_gives_empty_not_crash(self, isolated_data_dir):
        key = generate_user_key()
        trackers.create_tracker("alice", key, name="A", tracker_type="timer",
                                last_done_at=T0, now=NOW)
        wrong = generate_user_key()
        assert trackers.load_trackers("alice", wrong) == []

    def test_legacy_file_without_version_field(self, isolated_data_dir):
        """A store written by a future/older writer with no version key loads."""
        import json, os
        from backend import config
        from backend.crypto import encrypt_entry
        key = generate_user_key()
        payload = {"trackers": [{"id": "x1", "name": "Old", "type": "timer",
                                 "created_at": T0, "note": "", "last_done_at": T0,
                                 "history": []}]}
        path = os.path.join(config.DATA_DIR, "alice_trackers.enc")
        with open(path, "wb") as f:
            f.write(encrypt_entry(json.dumps(payload), key))
        loaded = trackers.load_trackers("alice", key)
        assert loaded[0]["name"] == "Old"


class TestTimerTracker:
    def test_create_timer_with_past_timestamp(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="Smoking", tracker_type="timer",
                                    last_done_at=T0, note="You've got this", now=NOW)
        assert t["type"] == "timer"
        assert t["last_done_at"] == T0
        assert t["note"] == "You've got this"
        assert t["history"] == []

    def test_timer_defaults_last_done_to_now(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="X", tracker_type="timer", now=NOW)
        assert t["last_done_at"] == iso(NOW)

    def test_reset_moves_last_into_history(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="X", tracker_type="timer",
                                    last_done_at=T0, now=NOW)
        later = NOW - timedelta(hours=1)
        t = trackers.reset_timer("alice", key, t["id"], at=later, now=NOW)
        assert t["last_done_at"] == iso(later)
        assert t["history"] == [T0]

    def test_current_and_longest_seconds(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="X", tracker_type="timer",
                                    last_done_at=T0, now=NOW)
        # current: 09:00 Oct 1 -> 12:00 Oct 14 = 13 days + 3h
        expected = 13 * 86400 + 3 * 3600
        t2 = trackers.reset_timer("alice", key, t["id"], at=NOW - timedelta(seconds=10), now=NOW)
        out = trackers.timer_stats(t2, now=NOW)
        assert out["current_seconds"] == 10
        # longest = gap T0 -> reset (13d 3h - 10s) beats current 10s
        assert out["longest_seconds"] == expected - 10

    def test_longest_includes_current_streak(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="X", tracker_type="timer",
                                    last_done_at=iso(NOW - timedelta(days=5)), now=NOW)
        out = trackers.timer_stats(t, now=NOW)
        assert out["longest_seconds"] == 5 * 86400
        assert out["current_seconds"] == 5 * 86400

    def test_future_timestamp_rejected(self, isolated_data_dir):
        key = generate_user_key()
        with pytest.raises(ValueError):
            trackers.create_tracker("alice", key, name="X", tracker_type="timer",
                                    last_done_at=iso(NOW + timedelta(days=2)), now=NOW)

    def test_update_note_and_last_done(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="X", tracker_type="timer",
                                    last_done_at=T0, now=NOW)
        t = trackers.update_tracker("alice", key, t["id"],
                                    note="stay strong", name="Quit smoking",
                                    last_done_at=iso(NOW - timedelta(days=1)), now=NOW)
        assert t["note"] == "stay strong"
        assert t["name"] == "Quit smoking"
        assert t["last_done_at"] == iso(NOW - timedelta(days=1))


class TestCounterTracker:
    def test_add_event_defaults_at_now(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="Anxiety", tracker_type="counter", now=NOW)
        t = trackers.add_event("alice", key, t["id"], at=None, doing="commuting",
                               feeling="panicked", mind="what if I faint", triggers="crowd",
                               now=NOW)
        assert len(t["events"]) == 1
        e = t["events"][0]
        assert e["at"] == iso(NOW)
        assert e["doing"] == "commuting"
        assert e["triggers"] == "crowd"

    def test_event_fields_default_to_empty(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="A", tracker_type="counter", now=NOW)
        t = trackers.add_event("alice", key, t["id"], at=NOW, now=NOW)
        e = t["events"][0]
        assert e["doing"] == e["feeling"] == e["mind"] == e["triggers"] == ""

    def test_events_sorted_newest_first(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="A", tracker_type="counter", now=NOW)
        t1 = iso(NOW - timedelta(days=2))
        t2 = iso(NOW - timedelta(hours=1))
        trackers.add_event("alice", key, t["id"], at=t1, now=NOW)
        t = trackers.add_event("alice", key, t["id"], at=t2, now=NOW)
        assert [e["at"] for e in t["events"]] == [t2, t1]

    def test_delete_event(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="A", tracker_type="counter", now=NOW)
        t = trackers.add_event("alice", key, t["id"], at=NOW, now=NOW)
        eid = t["events"][0]["id"]
        t = trackers.delete_event("alice", key, t["id"], eid, now=NOW)
        assert t["events"] == []
        assert trackers.delete_event("alice", key, t["id"], eid, now=NOW) is False

    def test_multiple_events_same_day_count(self, isolated_data_dir):
        """Three crises on one day = three events (each with its own context)."""
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="A", tracker_type="counter", now=NOW)
        for hour in (9, 14, 20):
            trackers.add_event("alice", key, t["id"],
                               at=iso(NOW.replace(hour=hour)), now=NOW)
        t = trackers.load_trackers("alice", key)[0]
        assert len(t["events"]) == 3


class TestValidation:
    def test_empty_name_rejected(self, isolated_data_dir):
        key = generate_user_key()
        with pytest.raises(ValueError):
            trackers.create_tracker("alice", key, name="   ", tracker_type="timer", now=NOW)

    def test_long_name_rejected(self, isolated_data_dir):
        key = generate_user_key()
        with pytest.raises(ValueError):
            trackers.create_tracker("alice", key, name="x" * 200, tracker_type="timer", now=NOW)

    def test_unknown_type_rejected(self, isolated_data_dir):
        key = generate_user_key()
        with pytest.raises(ValueError):
            trackers.create_tracker("alice", key, name="X", tracker_type="diary", now=NOW)

    def test_note_on_counter_rejected(self, isolated_data_dir):
        """Note is a timer concept (motivation); counter has events instead."""
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="A", tracker_type="counter", now=NOW)
        with pytest.raises(ValueError):
            trackers.update_tracker("alice", key, t["id"], note="nope", now=NOW)

    def test_last_done_on_counter_rejected(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="A", tracker_type="counter", now=NOW)
        with pytest.raises(ValueError):
            trackers.update_tracker("alice", key, t["id"], last_done_at=T0, now=NOW)

    def test_event_on_timer_rejected(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="X", tracker_type="timer",
                                    last_done_at=T0, now=NOW)
        with pytest.raises(ValueError):
            trackers.add_event("alice", key, t["id"], at=NOW, now=NOW)

    def test_reset_on_counter_rejected(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="A", tracker_type="counter", now=NOW)
        with pytest.raises(ValueError):
            trackers.reset_timer("alice", key, t["id"], now=NOW)

    def test_unknown_tracker_id_raises(self, isolated_data_dir):
        key = generate_user_key()
        with pytest.raises(ValueError):
            trackers.update_tracker("alice", key, "nope", name="X", now=NOW)

    def test_max_trackers_enforced(self, isolated_data_dir):
        key = generate_user_key()
        for i in range(trackers.MAX_TRACKERS):
            trackers.create_tracker("alice", key, name=f"T{i}", tracker_type="counter", now=NOW)
        with pytest.raises(ValueError):
            trackers.create_tracker("alice", key, name="one too many",
                                    tracker_type="counter", now=NOW)

    def test_oversized_event_text_rejected(self, isolated_data_dir):
        key = generate_user_key()
        t = trackers.create_tracker("alice", key, name="A", tracker_type="counter", now=NOW)
        with pytest.raises(ValueError):
            trackers.add_event("alice", key, t["id"], at=NOW, doing="x" * 5000, now=NOW)
