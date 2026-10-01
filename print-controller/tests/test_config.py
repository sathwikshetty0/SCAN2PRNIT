"""
Unit tests for config.py — load_config() exits on missing required variables.

Requirements: 13.6
"""
import importlib
import os
import sys
import pytest
from unittest.mock import patch

# Ensure the print-controller directory is on the path so 'config' is importable.
_CONTROLLER_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _CONTROLLER_DIR not in sys.path:
    sys.path.insert(0, _CONTROLLER_DIR)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

VALID_ENV = {
    'SUPABASE_URL': 'https://example.supabase.co',
    'SUPABASE_SERVICE_ROLE_KEY': 'service-role-secret',
    'PRINTER_NAME': 'HP_LaserJet',
}


def _env_without(key: str) -> dict:
    """Return a copy of VALID_ENV with one required key removed."""
    env = dict(VALID_ENV)
    del env[key]
    return env


def _call_load_config(env: dict) -> None:
    """Import (or reload) config and call load_config() under the given env."""
    import config as config_module  # noqa: PLC0415
    importlib.reload(config_module)
    config_module.load_config()


# ---------------------------------------------------------------------------
# Tests — one per missing required variable (Requirements 13.6)
# ---------------------------------------------------------------------------

def test_load_config_exits_when_supabase_url_missing():
    """load_config raises SystemExit when SUPABASE_URL is not set."""
    env = _env_without('SUPABASE_URL')
    env['PYTHON_DOTENV_DISABLED'] = 'true'
    with patch.dict(os.environ, env, clear=True):
        with pytest.raises(SystemExit):
            _call_load_config(_env_without('SUPABASE_URL'))


def test_load_config_exits_when_supabase_service_role_key_missing():
    """load_config raises SystemExit when SUPABASE_SERVICE_ROLE_KEY is not set."""
    env = _env_without('SUPABASE_SERVICE_ROLE_KEY')
    env['PYTHON_DOTENV_DISABLED'] = 'true'
    with patch.dict(os.environ, env, clear=True):
        with pytest.raises(SystemExit):
            _call_load_config(_env_without('SUPABASE_SERVICE_ROLE_KEY'))


def test_load_config_exits_when_printer_name_missing():
    """load_config raises SystemExit when PRINTER_NAME is not set."""
    env = _env_without('PRINTER_NAME')
    env['PYTHON_DOTENV_DISABLED'] = 'true'
    with patch.dict(os.environ, env, clear=True):
        with pytest.raises(SystemExit):
            _call_load_config(_env_without('PRINTER_NAME'))
