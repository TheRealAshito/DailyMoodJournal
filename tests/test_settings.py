"""Tests for backend.config — date_format setting."""

import os
from backend.config import (
    get_user_settings,
    save_user_settings,
    load_users,
    save_users,
    KNOWN_SETTINGS,
    DATE_FORMAT_OPTIONS,
)


class TestDateFormatSetting:
    def test_default_date_format(self, isolated_data_dir):
        """New users should get YYYY-MM-DD as default date format."""
        # Create a minimal user first
        users = {"testuser": {"password_hash": "x", "salt": "y"}}
        save_users(users)

        settings = get_user_settings("testuser")
        assert settings["date_format"] == "YYYY-MM-DD"

    def test_save_and_load_date_format(self, isolated_data_dir):
        """Should persist date_format correctly."""
        users = {"testuser": {"password_hash": "x", "salt": "y"}}
        save_users(users)

        save_user_settings("testuser", {"date_format": "DD-MM-YYYY"})
        settings = get_user_settings("testuser")
        assert settings["date_format"] == "DD-MM-YYYY"

    def test_change_date_format(self, isolated_data_dir):
        """Should be able to change date format multiple times."""
        users = {"testuser": {"password_hash": "x", "salt": "y"}}
        save_users(users)

        save_user_settings("testuser", {"date_format": "MM-DD-YYYY"})
        assert get_user_settings("testuser")["date_format"] == "MM-DD-YYYY"

        save_user_settings("testuser", {"date_format": "YYYY-MM-DD"})
        assert get_user_settings("testuser")["date_format"] == "YYYY-MM-DD"

    def test_old_user_without_date_format_gets_default(self, isolated_data_dir):
        """Existing users without date_format should get the default."""
        # Simulate an old user record without date_format
        users = {"olduser": {"password_hash": "x", "salt": "y", "theme": "dark"}}
        save_users(users)

        settings = get_user_settings("olduser")
        assert settings["date_format"] == "YYYY-MM-DD"
        assert settings["theme"] == "dark"  # Other settings preserved

    def test_date_format_in_known_settings(self):
        """date_format should be in KNOWN_SETTINGS."""
        assert "date_format" in KNOWN_SETTINGS

    def test_date_format_options_exist(self):
        """DATE_FORMAT_OPTIONS should have all three formats."""
        assert "YYYY-MM-DD" in DATE_FORMAT_OPTIONS
        assert "DD-MM-YYYY" in DATE_FORMAT_OPTIONS
        assert "MM-DD-YYYY" in DATE_FORMAT_OPTIONS
