"""HTTP tests for remembered devices, device PIN, and reminder settings.

Flows under test:
- login(remember_device=True) issues a device cookie; login without it doesn't
- GET /api/auth/devices lists remembered users for the picker (no session needed)
- POST /api/auth/device-login signs a user in via device cookie alone
- PIN is optional per user: when required on device, device-login demands it
- logout keeps the device by default; forget_device=True removes it
- password reset/change revokes all remembered devices
- reminder settings round-trip through /api/settings and are opt-in
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


def _login(client, username="alice", password="Secret123!", remember=False):
    return client.post("/api/auth/login", json={
        "username": username,
        "password": password,
        "remember_device": remember,
    })


class TestRememberOnLogin:
    def test_remember_sets_device_cookie(self, client):
        _signup(client)
        client.post("/api/auth/logout")
        r = _login(client, remember=True)
        assert r.status_code == 200
        assert "dailymood_device" in r.cookies

    def test_no_remember_no_device_cookie(self, client):
        _signup(client)
        client.post("/api/auth/logout")
        r = _login(client, remember=False)
        assert r.status_code == 200
        assert "dailymood_device" not in r.cookies

    def test_remember_second_user_on_same_device(self, client):
        """A second account remembered on the same device joins its picker."""
        _signup(client, "alice")
        r = _login(client, "alice", remember=True)
        device_cookie = r.cookies.get("dailymood_device")
        client.post("/api/auth/logout")

        _signup(client, "bob")
        client.cookies.set("dailymood_device", device_cookie)
        r2 = client.post("/api/auth/login", json={
            "username": "bob", "password": "Secret123!", "remember_device": True,
        })
        assert r2.status_code == 200
        client.post("/api/auth/logout")

        client.cookies.set("dailymood_device", device_cookie)
        listed = client.get("/api/auth/devices").json()["users"]
        assert sorted(u["username"] for u in listed) == ["alice", "bob"]


class TestDevicePicker:
    def test_devices_lists_remembered_user_without_session(self, client):
        _signup(client)
        r = _login(client, remember=True)
        client.post("/api/auth/logout")
        client.cookies.set("dailymood_device", r.cookies.get("dailymood_device"))
        listed = client.get("/api/auth/devices")
        assert listed.status_code == 200
        assert [u["username"] for u in listed.json()["users"]] == ["alice"]

    def test_devices_without_cookie_is_empty(self, client):
        assert client.get("/api/auth/devices").json() == {"users": []}

    def test_devices_never_leaks_key_material(self, client):
        _signup(client)
        r = _login(client, remember=True)
        client.post("/api/auth/logout")
        client.cookies.set("dailymood_device", r.cookies.get("dailymood_device"))
        body = client.get("/api/auth/devices").text
        assert "wrapped_uek" not in body
        assert "wrap_salt" not in body


class TestDeviceLogin:
    def test_device_login_signs_in(self, client):
        _signup(client)
        r = _login(client, remember=True)
        device_cookie = r.cookies.get("dailymood_device")
        client.post("/api/auth/logout")

        client.cookies.set("dailymood_device", device_cookie)
        r2 = client.post("/api/auth/device-login", json={"username": "alice"})
        assert r2.status_code == 200
        assert r2.json()["username"] == "alice"
        # session works
        assert client.get("/api/auth/me").json()["username"] == "alice"

    def test_device_login_unknown_user_401(self, client):
        _signup(client)
        r = _login(client, remember=True)
        client.post("/api/auth/logout")
        client.cookies.set("dailymood_device", r.cookies.get("dailymood_device"))
        assert client.post("/api/auth/device-login", json={"username": "mallory"}).status_code == 401

    def test_device_login_without_device_cookie_401(self, client):
        _signup(client)
        client.post("/api/auth/logout")
        assert client.post("/api/auth/device-login", json={"username": "alice"}).status_code == 401


class TestDevicePin:
    def _set_pin(self, client, pin="1234", require_on_device=True):
        r = client.post("/api/settings/pin", json={"pin": pin, "require_on_device": require_on_device})
        assert r.status_code == 200

    def test_pin_is_optional_by_default(self, client):
        _signup(client)
        s = client.get("/api/settings").json()
        assert s["pin_enabled"] is False
        assert s["pin_required_on_device"] is False

    def test_set_pin_and_require(self, client):
        _signup(client)
        self._set_pin(client)
        s = client.get("/api/settings").json()
        assert s["pin_enabled"] is True
        assert s["pin_required_on_device"] is True

    def test_device_login_requires_pin_when_configured(self, client):
        _signup(client)
        self._set_pin(client, require_on_device=True)
        r = _login(client, remember=True)
        device_cookie = r.cookies.get("dailymood_device")
        client.post("/api/auth/logout")
        client.cookies.set("dailymood_device", device_cookie)

        assert client.post("/api/auth/device-login", json={"username": "alice"}).status_code == 401
        assert client.post("/api/auth/device-login",
                           json={"username": "alice", "pin": "0000"}).status_code == 401
        ok = client.post("/api/auth/device-login", json={"username": "alice", "pin": "1234"})
        assert ok.status_code == 200

    def test_device_login_bypasses_pin_when_not_required(self, client):
        """Solo user: PIN exists but device tap goes straight in."""
        _signup(client)
        self._set_pin(client, require_on_device=False)
        r = _login(client, remember=True)
        device_cookie = r.cookies.get("dailymood_device")
        client.post("/api/auth/logout")
        client.cookies.set("dailymood_device", device_cookie)
        assert client.post("/api/auth/device-login", json={"username": "alice"}).status_code == 200

    def test_pin_lockout_after_repeated_failures(self, client):
        _signup(client)
        self._set_pin(client)
        r = _login(client, remember=True)
        device_cookie = r.cookies.get("dailymood_device")
        client.post("/api/auth/logout")
        client.cookies.set("dailymood_device", device_cookie)

        for _ in range(6):
            client.post("/api/auth/device-login", json={"username": "alice", "pin": "0000"})
        # even the correct PIN is rejected while locked
        assert client.post("/api/auth/device-login",
                           json={"username": "alice", "pin": "1234"}).status_code == 401

    def test_pin_login_with_password_alternative(self, client):
        """Login screen accepts PIN instead of password when enabled."""
        _signup(client)
        self._set_pin(client, require_on_device=False)
        client.post("/api/auth/logout")
        r = client.post("/api/auth/login", json={"username": "alice", "pin": "1234"})
        assert r.status_code == 200
        assert client.post("/api/auth/login",
                           json={"username": "alice", "pin": "9999"}).status_code == 401

    def test_remove_pin(self, client):
        _signup(client)
        self._set_pin(client)
        assert client.delete("/api/settings/pin").status_code == 200
        s = client.get("/api/settings").json()
        assert s["pin_enabled"] is False
        client.post("/api/auth/logout")
        assert client.post("/api/auth/login", json={"username": "alice", "pin": "1234"}).status_code == 401


class TestLogoutOptions:
    def test_logout_keeps_device_by_default(self, client):
        _signup(client)
        r = _login(client, remember=True)
        device_cookie = r.cookies.get("dailymood_device")
        client.post("/api/auth/logout")
        client.cookies.set("dailymood_device", device_cookie)
        assert [u["username"] for u in client.get("/api/auth/devices").json()["users"]] == ["alice"]

    def test_logout_forget_device(self, client):
        _signup(client)
        r = _login(client, remember=True)
        device_cookie = r.cookies.get("dailymood_device")
        client.post("/api/auth/logout", json={"forget_device": True})
        client.cookies.set("dailymood_device", device_cookie)
        assert client.get("/api/auth/devices").json() == {"users": []}


class TestRevocation:
    def test_password_reset_revokes_all_devices(self, client):
        _signup(client)
        r = _login(client, remember=True)
        device_cookie = r.cookies.get("dailymood_device")
        client.post("/api/auth/logout")
        client.cookies.set("dailymood_device", device_cookie)

        tok = client.post("/api/auth/password-reset-verify",
                          json={"username": "alice", "answer": "fluffy"}).json()["token"]
        r2 = client.post("/api/auth/password-reset-complete",
                         json={"username": "alice", "token": tok, "new_password": "NewPass123!"})
        assert r2.status_code == 200
        assert client.get("/api/auth/devices").json() == {"users": []}

    def test_password_change_revokes_all_devices(self, client):
        _signup(client)
        r = _login(client, remember=True)
        device_cookie = r.cookies.get("dailymood_device")

        r2 = client.put("/api/auth/password", json={
            "old_password": "Secret123!", "new_password": "NewPass123!",
        })
        assert r2.status_code == 200
        client.post("/api/auth/logout")
        client.cookies.set("dailymood_device", device_cookie)
        assert client.get("/api/auth/devices").json() == {"users": []}


class TestDeviceManagement:
    def test_my_devices_lists_for_current_user(self, client):
        _signup(client)
        _login(client, remember=True)
        r = client.get("/api/auth/my-devices")
        assert r.status_code == 200
        devices = r.json()["devices"]
        assert len(devices) == 1
        assert devices[0]["label"]
        assert "device_id" in devices[0]

    def test_my_devices_requires_auth(self, client):
        assert client.get("/api/auth/my-devices").status_code == 401

    def test_revoke_one_device(self, client):
        _signup(client)
        r1 = _login(client, remember=True)
        device1 = r1.cookies.get("dailymood_device")
        client.post("/api/auth/logout")
        # Simulate a second browser: no device cookie carried over
        client.cookies.delete("dailymood_device")
        r2 = _login(client, remember=True)
        device2 = r2.cookies.get("dailymood_device")
        assert device1 != device2

        listed = client.get("/api/auth/my-devices").json()["devices"]
        assert len(listed) == 2
        victim = listed[0]["device_id"] if listed[0].get("current") is False else listed[1]["device_id"]
        assert client.delete(f"/api/auth/my-devices/{victim}").status_code == 200
        assert len(client.get("/api/auth/my-devices").json()["devices"]) == 1

    def test_revoke_all_devices(self, client):
        _signup(client)
        _login(client, remember=True)
        assert client.delete("/api/auth/my-devices").status_code == 200
        assert client.get("/api/auth/my-devices").json()["devices"] == []


class TestReminderSettings:
    def test_reminders_off_by_default(self, client):
        _signup(client)
        s = client.get("/api/settings").json()
        assert s["reminder_enabled"] is False
        assert s["ntfy_url"] == ""
        assert s["ntfy_priority"] == 3

    def test_reminder_settings_roundtrip(self, client):
        _signup(client)
        r = client.put("/api/settings", json={
            "reminder_enabled": True,
            "reminder_time": "20:30",
            "reminder_timezone": "America/Sao_Paulo",
            "ntfy_url": "http://ntfy.local/journal",
            "ntfy_priority": 5,
            "ntfy_token": "tk_secret",
        })
        assert r.status_code == 200
        s = r.json()
        assert s["reminder_enabled"] is True
        assert s["reminder_time"] == "20:30"
        assert s["reminder_timezone"] == "America/Sao_Paulo"
        assert s["ntfy_url"] == "http://ntfy.local/journal"
        assert s["ntfy_priority"] == 5

    def test_ntfy_token_stored_but_not_echoed(self, client):
        """The token is a secret: stored server-side, never returned to clients."""
        _signup(client)
        client.put("/api/settings", json={"ntfy_token": "tk_secret"})
        body = client.get("/api/settings").text
        assert "tk_secret" not in body

    def test_reminder_status_endpoint(self, client):
        _signup(client)
        s = client.get("/api/reminders/status").json()
        assert s == {"has_entry_today": False, "current_streak": 0,
                     "streak_at_risk": False, "reminder_enabled": False}
