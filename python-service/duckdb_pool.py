"""
DuckDB Connection Pool for Oreo.io

This module provides a singleton DuckDB connection with the Delta extension pre-loaded.
It eliminates the ~2-3s overhead of INSTALL/LOAD delta on every request.

Usage:
    from duckdb_pool import get_connection
    
    con = get_connection()
    result = con.execute("SELECT * FROM delta_scan('/path/to/delta')").fetch_arrow_table()
"""

import duckdb
import threading
import logging
from typing import Optional

logger = logging.getLogger(__name__)

# Thread-safe singleton connection
_connection: Optional[duckdb.DuckDBPyConnection] = None
_lock = threading.Lock()
_initialized = False


def get_connection() -> duckdb.DuckDBPyConnection:
    """
    Get or create the global DuckDB connection with Delta extension loaded.
    
    This connection is thread-safe and reused across all requests to avoid
    the ~2-3s overhead of loading the Delta extension on each request.
    
    Returns:
        duckdb.DuckDBPyConnection: A DuckDB connection with Delta extension loaded
    """
    global _connection, _initialized
    
    if _connection is not None and _initialized:
        return _connection
    
    with _lock:
        # Double-check after acquiring lock
        if _connection is not None and _initialized:
            return _connection
        
        logger.info("[DuckDB Pool] Initializing global connection with Delta extension...")
        
        # Create new connection
        _connection = duckdb.connect()
        
        # Install and load Delta extension (the expensive operation)
        _connection.execute("INSTALL delta;")
        _connection.execute("LOAD delta;")
        
        _initialized = True
        logger.info("[DuckDB Pool] Global connection ready")
        
        return _connection


def get_new_connection() -> duckdb.DuckDBPyConnection:
    """
    Create a new DuckDB connection with Delta extension loaded.
    
    Use this when you need a separate connection (e.g., for writes or
    operations that modify connection state).
    
    Note: This still has the INSTALL/LOAD overhead, but the extension
    should be cached after first install.
    
    Returns:
        duckdb.DuckDBPyConnection: A new DuckDB connection with Delta extension loaded
    """
    con = duckdb.connect()
    con.execute("INSTALL delta;")
    con.execute("LOAD delta;")
    return con


def close_connection():
    """Close the global connection (for cleanup/testing)."""
    global _connection, _initialized
    
    with _lock:
        if _connection is not None:
            try:
                _connection.close()
            except Exception:
                pass
            _connection = None
            _initialized = False
            logger.info("[DuckDB Pool] Global connection closed")


def is_initialized() -> bool:
    """Check if the global connection is initialized."""
    return _initialized


def health_check() -> dict:
    """
    Perform a health check on the DuckDB connection.
    
    Returns:
        dict: Health status with 'ok', 'message', and 'version' fields
    """
    try:
        con = get_connection()
        result = con.execute("SELECT version()").fetchone()
        version = result[0] if result else "unknown"
        return {
            "ok": True,
            "message": "healthy",
            "version": version,
            "initialized": _initialized
        }
    except Exception as e:
        return {
            "ok": False,
            "message": str(e),
            "version": None,
            "initialized": _initialized
        }
