import mysql.connector
import os

def get_mysql_connection():
    """Establishes and returns a MySQL database connection."""
    try:
        # Get credentials from environment variables
        host = os.getenv("MYSQL_HOST")
        user = os.getenv("MYSQL_USER")
        password = os.getenv("MYSQL_PASSWORD")
        database = os.getenv("MYSQL_DATABASE")
        
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
