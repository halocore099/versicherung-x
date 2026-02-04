import mysql.connector
from mysql.connector import pooling
from contextlib import contextmanager
import os

# Global connection pool
_connection_pool = None
_pool_lock = None

def _init_pool():
    """Initialize the connection pool if not already initialized."""
    global _connection_pool, _pool_lock

    if _pool_lock is None:
        import threading
        _pool_lock = threading.Lock()

    with _pool_lock:
        if _connection_pool is None:
            try:
                _connection_pool = pooling.MySQLConnectionPool(
                    pool_name="versicherung_pool",
                    pool_size=15,  # MAX_WORKERS(10) + buffer for other operations
                    pool_reset_session=True,
                    host=os.getenv("MYSQL_HOST"),
                    user=os.getenv("MYSQL_USER"),
                    password=os.getenv("MYSQL_PASSWORD"),
                    database=os.getenv("MYSQL_DATABASE"),
                )
                print(f"[DB Pool] Initialized connection pool with size 15")
            except mysql.connector.Error as err:
                print(f"[DB Pool] Failed to initialize connection pool: {err}")
                raise

    return _connection_pool


@contextmanager
def get_db_connection():
    """
    Context manager for getting a pooled database connection.
    Ensures the connection is properly returned to the pool after use.

    Usage:
        with get_db_connection() as cnx:
            cursor = cnx.cursor()
            cursor.execute(...)
            cnx.commit()
    """
    cnx = None
    try:
        pool = _init_pool()
        cnx = pool.get_connection()
        yield cnx
    except pooling.PoolError as e:
        print(f"[DB Pool] Pool error: {e}")
        raise
    except mysql.connector.Error as err:
        print(f"[DB Pool] Connection error: {err}")
        raise
    finally:
        if cnx and cnx.is_connected():
            cnx.close()  # Returns connection to pool


def get_mysql_connection():
    """
    Establishes and returns a MySQL database connection from the pool.

    NOTE: Caller is responsible for closing the connection when done.
    For better resource management, prefer using get_db_connection() context manager.
    """
    try:
        pool = _init_pool()
        return pool.get_connection()
    except pooling.PoolError as e:
        print(f"[DB Pool] Pool error getting connection: {e}")
        return None
    except mysql.connector.Error as err:
        print(f"An unexpected error occurred during DB connection: {err}")
        return None
    except Exception as e:
        print(f"A general error occurred: {e}")
        return None
