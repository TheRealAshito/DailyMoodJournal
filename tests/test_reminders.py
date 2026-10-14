"""Tests for the reminder engine (backend.reminders).

Model:
- Opt-in per user: reminder_enabled defaults False, ntfy_url defaults empty.
  Nothing is ever sent unless the user turns it on AND provides a URL.
- find_due_users() is pure: given a users store and a moment, it says who is
  due. The scheduler and HTTP sending are thin wrappers around it.
- At most one notification per user per day (reminder_last_notified guard).
- Payloads are generic: no titles, moods, or streak counts ever leave.
"""

from datetime import datetime, timezone

import pytest

from backend import reminders


def _user(**over):
    base = {
        "reminder_enabled": True,
        "reminder_time": "21:00",
        "reminder_timezone": "UTC",
        "ntfy_url": "http://ntfy.local/journal",
        "ntfy_priority": 3,
        "ntfy_token": "",
    }
    base.update(over)
    return base


class TestOptInDefaults:
    def test_disabled_by_default(self, isolated_data_dir):
        from backend.config import get_user_settings
        s = get_user_settings("ghost")  # user does not even exist
        assert s["reminder_enabled"] is False
        assert s["ntfy_url"] == ""
        assert s["reminder_enabled"] is False

    def test_disabled_user_is_never_due(self, isolated_data_dir):
        users = {"alice": _user(reminder_enabled=False)}
        now = datetime(2026, 10, 4, 22, 0, tzinfo=timezone.utc)
        assert reminders.find_due_users(users, now) == []

    def test_user_without_url_is_never_due(self, isolated_data_dir):
        users = {"alice": _user(ntfy_url="")}
        now = datetime(2026, 10, 4, 22, 0, tzinfo=timezone.utc)
        assert reminders.find_due_users(users, now) == []

    def test_defaults_never_due(self, isolated_data_dir):
        """A user record with none of the new fields (legacy shape) is inert."""
        users = {"alice": {"salt": "x", "password_hash": "y"}}
        now = datetime(2026, 10, 4, 22, 0, tzinfo=timezone.utc)
        assert reminders.find_due_users(users, now) == []


class TestDueLogic:
    def test_due_after_reminder_time_with_no_entry(self, isolated_data_dir):
        users = {"alice": _user()}
        now = datetime(2026, 10, 4, 21, 30, tzinfo=timezone.utc)
        assert reminders.find_due_users(users, now, has_entry_today={"alice": False}) == ["alice"]

    def test_not_due_before_reminder_time(self, isolated_data_dir):
        users = {"alice": _user()}
        now = datetime(2026, 10, 4, 20, 59, tzinfo=timezone.utc)
        assert reminders.find_due_users(users, now, has_entry_today={"alice": False}) == []

    def test_not_due_when_entry_written(self, isolated_data_dir):
        users = {"alice": _user()}
        now = datetime(2026, 10, 4, 22, 0, tzinfo=timezone.utc)
        assert reminders.find_due_users(users, now, has_entry_today={"alice": True}) == []

    def test_not_due_twice_same_day(self, isolated_data_dir):
        users = {"alice": _user(reminder_last_notified="2026-10-04")}
        now = datetime(2026, 10, 4, 22, 0, tzinfo=timezone.utc)
        assert reminders.find_due_users(users, now, has_entry_today={"alice": False}) == []

    def test_due_again_on_later_day(self, isolated_data_dir):
        users = {"alice": _user(reminder_last_notified="2026-10-03")}
        now = datetime(2026, 10, 4, 22, 0, tzinfo=timezone.utc)
        assert reminders.find_due_users(users, now, has_entry_today={"alice": False}) == ["alice"]

    def test_timezone_shifts_the_day(self, isolated_data_dir):
        """21:00 in Tokyo happens at 12:00 UTC — before that, not due."""
        users = {"alice": _user(reminder_timezone="Asia/Tokyo")}
        early = datetime(2026, 10, 4, 11, 0, tzinfo=timezone.utc)
        late = datetime(2026, 10, 4, 12, 30, tzinfo=timezone.utc)
        assert reminders.find_due_users(users, early, has_entry_today={"alice": False}) == []
        assert reminders.find_due_users(users, late, has_entry_today={"alice": False}) == ["alice"]

    def test_invalid_timezone_falls_back_to_utc(self, isolated_data_dir):
        users = {"alice": _user(reminder_timezone="Not/AZone")}
        now = datetime(2026, 10, 4, 22, 0, tzinfo=timezone.utc)
        assert reminders.find_due_users(users, now, has_entry_today={"alice": False}) == ["alice"]

    def test_malformed_reminder_time_never_due(self, isolated_data_dir):
        users = {"alice": _user(reminder_time="banana")}
        now = datetime(2026, 10, 4, 22, 0, tzinfo=timezone.utc)
        assert reminders.find_due_users(users, now, has_entry_today={"alice": False}) == []


class TestNotification:
    def test_priority_header_maps_1_to_5(self, isolated_data_dir):
        for p in (1, 2, 3, 4, 5):
            call = reminders.build_request(_user(ntfy_priority=p))
            headers = {k.lower(): v for k, v in call.headers.items()}
            assert headers["x-priority"] == str(p)

    def test_priority_out_of_range_clamped(self, isolated_data_dir):
        def prio(v):
            return {k.lower(): val for k, val in reminders.build_request(_user(ntfy_priority=v)).headers.items()}["x-priority"]
        assert prio(9) == "5"
        assert prio(0) == "1"

    def test_message_is_generic(self, isolated_data_dir):
        req = reminders.build_request(_user())
        assert req.data == reminders.REMINDER_MESSAGE.encode()
        for leak in ("alice", "streak", "mood", "21:00"):
            assert leak not in req.data.decode()

    def test_auth_header_only_when_token_set(self, isolated_data_dir):
        assert "Authorization" not in reminders.build_request(_user(ntfy_token="")).headers
        assert reminders.build_request(_user(ntfy_token="tk_abc")).headers["Authorization"] == "Bearer tk_abc"

    def test_send_marks_notified_date(self, isolated_data_dir, monkeypatch):
        sent = []
        monkeypatch.setattr(reminders, "_perform_send", lambda req: sent.append(req) or True)
        users = {"alice": _user()}
        now = datetime(2026, 10, 4, 21, 30, tzinfo=timezone.utc)
        reminders.check_and_notify(users, now, has_entry_today={"alice": False})
        assert len(sent) == 1
        assert users["alice"]["reminder_last_notified"] == "2026-10-04"

    def test_failed_send_does_not_mark_notified(self, isolated_data_dir, monkeypatch):
        monkeypatch.setattr(reminders, "_perform_send", lambda req: False)
        users = {"alice": _user()}
        now = datetime(2026, 10, 4, 21, 30, tzinfo=timezone.utc)
        reminders.check_and_notify(users, now, has_entry_today={"alice": False})
        assert "reminder_last_notified" not in users["alice"]
