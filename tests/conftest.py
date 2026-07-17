import os
import sys
import pytest
import tempfile
import shutil

# Ensure the project root is on sys.path so `backend.*` imports work
PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


@pytest.fixture(autouse=True)
def isolated_data_dir(tmp_path, monkeypatch):
    """Redirect all data/entries paths to a temp directory per test.

    This prevents tests from touching the real project data directory
    and ensures complete isolation between tests.
    """
    entries_dir = str(tmp_path / "entries")
    data_dir = str(tmp_path / "data")
    os.makedirs(entries_dir, exist_ok=True)
    os.makedirs(data_dir, exist_ok=True)

    import backend.config as config
    import backend.utils as utils
    import backend.index as index_mod
    monkeypatch.setattr(config, "ENTRIES_DIR", entries_dir)
    monkeypatch.setattr(config, "DATA_DIR", data_dir)
    monkeypatch.setattr(config, "USERS_FILE", os.path.join(data_dir, "users.json"))
    monkeypatch.setattr(config, "MASTER_KEY_FILE", os.path.join(data_dir, "master.key"))
    # Also patch the local bindings in modules that do `from config import X`
    monkeypatch.setattr(utils, "ENTRIES_DIR", entries_dir)
    monkeypatch.setattr(index_mod, "DATA_DIR", data_dir)

    yield tmp_path


@pytest.fixture
def user_key():
    """A fresh 256-bit AES key for testing."""
    from backend.crypto import generate_user_key
    return generate_user_key()


@pytest.fixture
def sample_entry_data():
    """Standard entry data dict used across tests."""
    return {
        "title": "Test Entry",
        "date": "2025-03-15T10:30:00",
        "mood": 4,
        "tags": ["Happy", "Work"],
        "body": "This is a test journal entry body.\nWith multiple lines.",
    }
