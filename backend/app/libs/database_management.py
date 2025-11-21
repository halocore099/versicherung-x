import databutton as db
import mysql.connector
import os

def get_mysql_connection():
    """Establishes and returns a MySQL database connection."""
    try:
        # Try databutton secrets first, fall back to environment variables
        host = db.secrets.get("MYSQL_HOST") or os.getenv("MYSQL_HOST")
        user = db.secrets.get("MYSQL_USER") or os.getenv("MYSQL_USER")
        password = db.secrets.get("MYSQL_PASSWORD") or os.getenv("MYSQL_PASSWORD")
        database = db.secrets.get("MYSQL_DATABASE") or os.getenv("MYSQL_DATABASE")
        
        cnx = mysql.connector.connect(
            host=host,
            user=user,
            password=password,
            database=database,
        )
        return cnx
    except mysql.connector.Error as err:
        print(f"An unexpected error occurred during DB connection: {err}")
        return None
    except Exception as e:
        print(f"A general error occurred: {e}")
        return None
