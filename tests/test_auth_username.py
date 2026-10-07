"""Tests for username whitespace handling in the auth module.

Behavior under test:
- Leading/trailing whitespace in a submitted username is ignored
  (login, signup, password-reset lookups).
- Usernames with interior spaces are rejected at signup.
- Legacy accounts whose stored key contains whitespace keep working
  (backward compatibility — users.json is the source of truth).
"""

import pytest


@pytest.fixture
def client():
    from fastapi.testclient import TestClient
    from backend.main import app
    with TestClient(app) as c:
        yield c


def _signup(client, username="alice"):
    r = client.post("/api/auth/signup", json={
        "username": username,
        "password": "Secret123!",
        "security_question": "pet?",
        "security_answer": "fluffy",
    })
    return r


def _login(client, username, password="Secret123!"):
    return client.post("/api/auth/login", json={
        "username": username,
        "password": password,
    })


class TestLoginTrimming:
    def test_login_trims_leading_and_trailing_spaces(self, client):
        assert _signup(client, "alice").status_code == 200
        client.post("/api/auth/logout")
        r = _login(client, "  alice  ")
        assert r.status_code == 200
        assert r.json()["username"] == "alice"

    def test_login_trims_tabs_and_newlines(self, client):
        assert _signup(client, "alice").status_code == 200
        client.post("/api/auth/logout")
        r = _login(client, "\t alice \n")
        assert r.status_code == 200

    def test_login_still_works_without_spaces(self, client):
        assert _signup(client, "alice").status_code == 200
        client.post("/api/auth/logout")
        assert _login(client, "alice").status_code == 200

    def test_login_whitespace_only_username_is_401(self, client):
        assert _signup(client, "alice").status_code == 200
        client.post("/api/auth/logout")
        r = _login(client, "   ")
        assert r.status_code == 401

    def test_login_unknown_user_still_401(self, client):
        r = _login(client, "  nobody  ")
        assert r.status_code == 401


class TestSignupTrimming:
    def test_signup_trims_username_before_storing(self, client):
        r = _signup(client, "  bob  ")
        assert r.status_code == 200
        assert r.json()["username"] == "bob"

        from backend.config import load_users
        assert "bob" in load_users()

    def test_signup_rejects_interior_spaces(self, client):
        r = _signup(client, "bo b")
        assert r.status_code == 400

    def test_signup_conflict_detected_after_trim(self, client):
        assert _signup(client, "alice").status_code == 200
        client.post("/api/auth/logout")
        r = _signup(client, "  alice  ")
        assert r.status_code == 409

    def test_trimmed_signup_can_login(self, client):
        assert _signup(client, "  bob  ").status_code == 200
        client.post("/api/auth/logout")
        assert _login(client, "bob").status_code == 200


class TestLegacyUsernames:
    """Users.json is the source of truth: an existing account whose stored
    key contains whitespace must keep working after this change."""

    def _make_legacy_user(self, username_in_store):
        """Sign up normally, then rewrite the stored key to a whitespacey form."""
        assert _signup(self.client, "legacy").status_code == 200
        self.client.post("/api/auth/logout")
        from backend.config import load_users, save_users
        users = load_users()
        users[username_in_store] = users.pop("legacy")
        save_users(users)

    def test_legacy_key_with_spaces_can_login(self, client):
        self.client = client
        self._make_legacy_user("  legacy  ")
        r = _login(client, "  legacy  ")
        assert r.status_code == 200
        # Session must carry the actual stored key so entries resolve
        assert r.json()["username"] == "  legacy  "

    def test_legacy_key_with_spaces_can_login_trimmed(self, client):
        """Typing the name without stray spaces must also find the legacy key."""
        self.client = client
        self._make_legacy_user(" legacy ")
        r = _login(client, "legacy")
        assert r.status_code == 200
        assert r.json()["username"] == " legacy "


class TestPasswordResetTrimming:
    def test_reset_request_trims_username(self, client):
        assert _signup(client, "alice").status_code == 200
        client.post("/api/auth/logout")
        r = client.post("/api/auth/password-reset-request",
                        json={"username": "  alice  "})
        assert r.status_code == 200
        assert r.json()["question"] == "pet?"

    def test_reset_verify_trims_username(self, client):
        assert _signup(client, "alice").status_code == 200
        client.post("/api/auth/logout")
        r = client.post("/api/auth/password-reset-verify",
                        json={"username": "\t alice", "answer": "fluffy"})
        assert r.status_code == 200
        assert r.json()["token"]
