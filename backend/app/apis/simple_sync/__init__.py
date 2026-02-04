from fastapi import APIRouter, BackgroundTasks, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
import requests
import json
import os
import asyncio
import uuid
from app.libs.database_management import get_mysql_connection, get_db_connection
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import threading
from typing import Optional, List
from slowapi import Limiter
from slowapi.util import get_remote_address

router = APIRouter()
limiter = Limiter(key_func=get_remote_address)


# =====================================================
# SYNC SESSION PERSISTENCE
# =====================================================

def _create_sync_session(sync_type: str, user_id: str = None) -> Optional[str]:
    """
    Creates a new sync session record in the database.
    Returns the session_id or None if creation failed.
    """
    _lazy_init()  # Ensure table exists
    session_id = str(uuid.uuid4())
    try:
        with get_db_connection() as cnx:
            cursor = cnx.cursor()
            cursor.execute("""
                INSERT INTO sync_sessions (session_id, sync_type, status, started_by, created_at)
                VALUES (%s, %s, 'pending', %s, %s)
            """, (session_id, sync_type, user_id, datetime.now(timezone.utc)))
            cnx.commit()
            cursor.close()
            print(f"[Sync Session] Created session {session_id} for {sync_type}")
            return session_id
    except Exception as e:
        print(f"[Sync Session] Failed to create session: {e}")
        return None


def _update_sync_session(session_id: str, **kwargs) -> bool:
    """
    Updates a sync session record in the database.
    Accepts any combination of: status, started_at, completed_at, total_cases,
    processed, upserted, skipped_no_change, skipped_not_insurance, marked_inactive, errors, error_message
    """
    if not session_id:
        return False

    valid_fields = {
        'status', 'started_at', 'completed_at', 'total_cases', 'processed',
        'upserted', 'skipped_no_change', 'skipped_not_insurance', 'marked_inactive',
        'errors', 'error_message'
    }

    updates = {k: v for k, v in kwargs.items() if k in valid_fields}
    if not updates:
        return True

    try:
        with get_db_connection() as cnx:
            set_clause = ", ".join([f"{k} = %s" for k in updates.keys()])
            values = list(updates.values())
            values.append(session_id)

            cursor = cnx.cursor()
            cursor.execute(f"""
                UPDATE sync_sessions SET {set_clause}, updated_at = NOW()
                WHERE session_id = %s
            """, values)
            cnx.commit()
            cursor.close()
            return True
    except Exception as e:
        print(f"[Sync Session] Failed to update session {session_id}: {e}")
        return False


def _recover_interrupted_sessions():
    """
    Called on startup to mark any 'running' or 'pending' sessions as 'failed'.
    This handles cases where the server crashed during a sync.
    """
    try:
        with get_db_connection() as cnx:
            cursor = cnx.cursor()
            cursor.execute("""
                UPDATE sync_sessions
                SET status = 'failed', error_message = 'Server restarted during sync', completed_at = NOW()
                WHERE status IN ('pending', 'running')
            """)
            affected = cursor.rowcount
            cnx.commit()
            cursor.close()
            if affected > 0:
                print(f"[Sync Session] Recovered {affected} interrupted sessions")
    except Exception as e:
        print(f"[Sync Session] Failed to recover interrupted sessions: {e}")


def _ensure_sync_sessions_table():
    """
    Ensures the sync_sessions table exists. Creates it if not.
    """
    try:
        with get_db_connection() as cnx:
            cursor = cnx.cursor()
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS sync_sessions (
                    id INT AUTO_INCREMENT PRIMARY KEY,
                    session_id VARCHAR(36) NOT NULL UNIQUE,
                    sync_type ENUM('sync', 'sync_all') NOT NULL,
                    status ENUM('pending', 'running', 'completed', 'failed', 'cancelled') DEFAULT 'pending',
                    started_at DATETIME NULL,
                    completed_at DATETIME NULL,
                    started_by VARCHAR(255) NULL,
                    total_cases INT DEFAULT 0,
                    processed INT DEFAULT 0,
                    upserted INT DEFAULT 0,
                    skipped_no_change INT DEFAULT 0,
                    skipped_not_insurance INT DEFAULT 0,
                    marked_inactive INT DEFAULT 0,
                    errors INT DEFAULT 0,
                    error_message TEXT NULL,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                    INDEX idx_status (status),
                    INDEX idx_started_at (started_at DESC)
                )
            """)
            cnx.commit()
            cursor.close()
            print("[Sync Session] Ensured sync_sessions table exists")
    except Exception as e:
        print(f"[Sync Session] Failed to ensure table: {e}")


# Defer initialization to avoid blocking app startup
_initialization_done = False

def _lazy_init():
    """Initialize sync session table lazily on first use."""
    global _initialization_done
    if _initialization_done:
        return
    _initialization_done = True
    try:
        _ensure_sync_sessions_table()
        _recover_interrupted_sessions()
    except Exception as e:
        print(f"[Sync Session] Initialization failed (will retry on next use): {e}")


# =====================================================
# MANUAL SYNC REQUEST/RESPONSE MODELS
# =====================================================

class ManualSyncRequest(BaseModel):
    identifiers: List[str]


class ManualSyncDetail(BaseModel):
    identifier: str
    status: str
    message: str


class ManualSyncResponse(BaseModel):
    successful: int
    failed: int
    details: List[str]

# Get credentials from environment variables
REPAIRLINE_API_USERNAME = os.getenv("REPAIRLINE_API_USERNAME")
REPAIRLINE_API_PASSWORD = os.getenv("REPAIRLINE_API_PASSWORD")
REPAIRLINE_API_BASE_URL = "http://api.system.repairline.de/v2/"

# Configuration
MAX_WORKERS = 10  # Number of parallel requests
REQUEST_TIMEOUT = 30  # Reduced from 60 seconds
MAX_RETRIES = 3  # Number of retries for failed requests
RETRY_DELAY = 1  # Seconds to wait between retries


def _fetch_case_with_retry(case_id: int, max_retries: int = MAX_RETRIES) -> Optional[dict]:
    """
    Fetches case data from API with retry logic.
    Returns the case data dict or None if all retries failed.
    """
    headers = {'User-Agent': 'Mozilla/5.0'}
    
    for attempt in range(max_retries):
        try:
            detail_response = requests.get(
                f"{REPAIRLINE_API_BASE_URL}cases/{case_id}",
                auth=(REPAIRLINE_API_USERNAME, REPAIRLINE_API_PASSWORD),
                headers=headers,
                timeout=REQUEST_TIMEOUT,
            )
            detail_response.raise_for_status()
            return detail_response.json()
        except requests.exceptions.Timeout:
            if attempt < max_retries - 1:
                print(f"[{case_id}] Request timeout (attempt {attempt + 1}/{max_retries}), retrying...")
                time.sleep(RETRY_DELAY * (attempt + 1))  # Exponential backoff
            else:
                print(f"[{case_id}] Request timeout after {max_retries} attempts.")
                return None
        except requests.exceptions.RequestException as e:
            if attempt < max_retries - 1:
                print(f"[{case_id}] Request error (attempt {attempt + 1}/{max_retries}): {e}, retrying...")
                time.sleep(RETRY_DELAY * (attempt + 1))
            else:
                print(f"[{case_id}] Request failed after {max_retries} attempts: {e}")
                return None
    
    return None


def _mark_case_inactive(case_id: int, start_time_utc: datetime, reason: str = "not_in_api") -> str:
    """
    Marks a case as inactive in the database.
    Used when a case is no longer in the API or no longer has active insurance.
    """
    cnx = get_mysql_connection()
    if not cnx:
        print(f"[{case_id}] Failed to get database connection for marking inactive.")
        return "error_db_connection"

    try:
        cursor = cnx.cursor()
        cursor.execute(
            "UPDATE repair_cases SET insuranceIsActive = 0, lastApiUpdate = %s WHERE caseId = %s",
            (start_time_utc, case_id)
        )
        cursor.close()
        cnx.commit()
        print(f"[{case_id}] Marked as INACTIVE (reason: {reason})")
        return "marked_inactive"
    except Exception as e:
        print(f"[{case_id}] Error marking case inactive: {e}")
        if cnx:
            cnx.rollback()
        return "error_marking_inactive"
    finally:
        if cnx and cnx.is_connected():
            cnx.close()


def _process_single_case(case_id: int, start_time_utc: datetime, mark_inactive_if_not_insurance: bool = False):
    """
    Fetches, parses, and saves a single insurance case.
    Creates its own database connection for thread safety.

    Args:
        case_id: The case ID to process
        start_time_utc: Timestamp for the sync
        mark_inactive_if_not_insurance: If True, marks the case as inactive if it's not an insurance case.
                                        Used by Sync All to handle cases that lost their insurance status.
    """
    # Create a new database connection for this thread
    cnx = get_mysql_connection()
    if not cnx:
        print(f"[{case_id}] Failed to get database connection.")
        return "error_db_connection"

    try:
        # 1. Fetch detailed data with retry logic
        case_data = _fetch_case_with_retry(case_id)
        if not case_data:
            # If we can't fetch and we're in Sync All mode, mark as inactive
            if mark_inactive_if_not_insurance:
                cnx.close()  # Close this connection before calling mark function
                return _mark_case_inactive(case_id, start_time_utc, "api_fetch_failed")
            return "error_fetch_failed"

        print(f"[{case_id}] Fetched raw API data.")

        # 2. Check if it's an insurance case
        insurance_data = case_data.get('Insurance') # Can be None
        if not (insurance_data and insurance_data.get('InsuranceIsActivated')):
            print(f"[{case_id}] Is not an insurance case or Insurance object is null/inactive.")
            # If in Sync All mode, mark as inactive since insurance is no longer active
            if mark_inactive_if_not_insurance:
                cnx.close()  # Close this connection before calling mark function
                return _mark_case_inactive(case_id, start_time_utc, "insurance_deactivated")
            return "skipped_not_insurance"

        print(f"[{case_id}] Is an insurance case. Proceeding.")

        # 3. Compare with existing data to see if an update is needed
        cursor = cnx.cursor(dictionary=True)
        cursor.execute("SELECT `rawApiDetail` FROM `repair_cases` WHERE `caseId` = %s", (case_id,))
        existing_record = cursor.fetchone()
        cursor.close()

        new_raw_detail_json = json.dumps(case_data, sort_keys=True)
        
        # Track if this is a new case or if data has changed
        is_new_case = existing_record is None
        data_changed = False

        if existing_record:
            try:
                existing_raw_detail = existing_record.get('rawApiDetail', '{}')
                if isinstance(existing_raw_detail, bytes):
                    existing_raw_detail = existing_raw_detail.decode('utf-8')
                
                normalized_existing = json.dumps(json.loads(existing_raw_detail), sort_keys=True)
                
                if normalized_existing == new_raw_detail_json:
                    print(f"[{case_id}] Data is identical to DB record. Skipping update.")
                    return "skipped_no_change"
                else:
                    data_changed = True
                    print(f"[{case_id}] Data has changed. Proceeding with update.")
            except (json.JSONDecodeError, TypeError) as json_err:
                print(f"[{case_id}] Warning: Could not compare JSON. Proceeding with update. Error: {json_err}")
                data_changed = True
        else:
            print(f"[{case_id}] New case. Proceeding with insert.")
            data_changed = True
        
        # 4. Robust Data Mapping
        print(f"[{case_id}] Mapping fields for upsert.")
        
        # Safer access to bookings
        bookings = case_data.get('Bookings') or []
        latest_status = bookings[-1].get('Status') if bookings and len(bookings) > 0 else None
        if not latest_status:
            latest_status = case_data.get('Status')  # Fallback to top-level status

        # Safer access to nested objects, providing default empty dicts
        customer_data = case_data.get('Customer') or {}
        product_data = case_data.get('Product') or {}
        insurance_data = case_data.get('Insurance') or {}
        symptoms_data = case_data.get('Symptoms') or {}
        store_data = case_data.get('Store') or {}
        service_data = case_data.get('Service') or {}
        
        # Helper function to convert empty strings to None
        def clean_value(value):
            if value is None:
                return None
            if isinstance(value, str):
                return value.strip() if value.strip() else None
            return value
        
        # Build customer name from first and last name
        first_name = clean_value(customer_data.get('FirstName'))
        last_name = clean_value(customer_data.get('LastName'))
        customer_name = None
        if first_name and last_name:
            customer_name = f"{first_name} {last_name}"
        elif first_name:
            customer_name = first_name
        elif last_name:
            customer_name = last_name
        
        # Calculate total repair cost
        positions = case_data.get('Positions') or []
        total_repair_cost = None
        if positions:
            try:
                total_repair_cost = sum(float(pos.get('PriceGross', 0.0) or 0.0) for pos in positions)
                if total_repair_cost == 0.0:
                    total_repair_cost = None
            except (ValueError, TypeError):
                total_repair_cost = None

        # Build complete data dictionary - include ALL fields that exist in the database, even if None
        # This ensures NULL fields in DB get updated properly
        # Based on the actual database schema from view_cases/__init__.py
        # IMPORTANT: Only update lastApiUpdate if this is a new case or data has changed
        db_data = {
            'caseId': case_data.get('CaseId'),
            'caseNumber': clean_value(case_data.get('CaseNumber')),
            'customerName': customer_name,
            'customerEmail': clean_value(customer_data.get('Email')),
            'customerCity': clean_value(customer_data.get('City')),
            'productName': clean_value(product_data.get('ProductName')),
            'manufacturer': clean_value(product_data.get('Manufacturer')),
            'symptoms': clean_value(symptoms_data.get('Comment')),
            'storeName': clean_value(store_data.get('Current')),
            'status': clean_value(latest_status),
            'warranty': clean_value(case_data.get('Warranty')),
            'serviceType': clean_value(service_data.get('Servicetype')),
            'currency': clean_value(case_data.get('Currency')),
            'insuranceContractNumber': clean_value(insurance_data.get('ContractNumber')),
            'insuranceIsActive': 1,
            'insuranceName': clean_value(insurance_data.get('Name')),
            'insuranceDeductible': insurance_data.get('Retention') if insurance_data.get('Retention') is not None else None,
            'insuranceSettlementAmount': insurance_data.get('SettlementAmount') if insurance_data.get('SettlementAmount') is not None else None,
            'customerCompanyName': clean_value(customer_data.get('CompanyName')),
            'customerNumber': clean_value(customer_data.get('CustomerNumber')),
            'customerFirstName': first_name,
            'customerLastName': last_name,
            'customerPhoneMain': clean_value(customer_data.get('PhoneMain')),
            'customerZipCode': clean_value(customer_data.get('ZipCode')),
            'productSerialNumber': clean_value(product_data.get('SerialNumber')),
            'totalRepairCost': total_repair_cost,
            'rawApiDetail': new_raw_detail_json,
            'isPresentInLastApiSync': 1,
        }
        
        # Only update lastApiUpdate timestamp if this is a new case or data has changed
        if is_new_case or data_changed:
            db_data['lastApiUpdate'] = start_time_utc

        # 5. Get existing columns from database to filter out non-existent columns
        # This allows the code to work even if some columns don't exist yet
        cursor = cnx.cursor()
        cursor.execute("SHOW COLUMNS FROM repair_cases")
        existing_columns = {row[0] for row in cursor.fetchall()}
        cursor.close()
        
        # Filter db_data to only include columns that exist in the database
        filtered_db_data = {k: v for k, v in db_data.items() if k in existing_columns}
        
        if not filtered_db_data:
            print(f"[{case_id}] Warning: No valid columns found for database insert.")
            return "error_no_columns"
        
        # Log any fields that were filtered out (for debugging)
        missing_columns = set(db_data.keys()) - existing_columns
        if missing_columns:
            print(f"[{case_id}] Note: {len(missing_columns)} fields not in database schema (will be skipped): {', '.join(sorted(missing_columns))}")
    
        # 6. Upsert to Database - include ALL fields in update clause, even NULL ones
        # This ensures that fields that were previously NULL get updated properly
        columns = ", ".join(f"`{k}`" for k in filtered_db_data.keys())
        placeholders = ", ".join(["%s"] * len(filtered_db_data))
        # Update ALL fields, including NULL values
        update_clause = ", ".join([f"`{key}` = VALUES(`{key}`)" for key in filtered_db_data.keys()])
        sql = f"INSERT INTO repair_cases ({columns}) VALUES ({placeholders}) ON DUPLICATE KEY UPDATE {update_clause}"
        
        print(f"[{case_id}] Executing SQL upsert with {len(filtered_db_data)} fields.")
        cursor = cnx.cursor()
        cursor.execute(sql, list(filtered_db_data.values()))
        cursor.close()
        cnx.commit()
        
        return "upserted"
    except Exception as e:
        print(f"[{case_id}] Error in _process_single_case: {e}")
        if cnx:
            cnx.rollback()
        return "error_processing"
    finally:
        if cnx and cnx.is_connected():
            cnx.close()


def sync_insurance_cases_task():
    """
    The main background task to fetch, filter, and save insurance cases.
    """
    print("Starting simple insurance case sync...")
    start_time_utc = datetime.now(timezone.utc)

    try:
        # Step 1: Fetch all cases from the Repairline API
        print("Fetching all cases from Repairline API...")
        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(
            f"{REPAIRLINE_API_BASE_URL}cases",
            auth=(REPAIRLINE_API_USERNAME, REPAIRLINE_API_PASSWORD),
            headers=headers,
            timeout=300,  # Generous timeout for a potentially large response
        )
        response.raise_for_status()
        all_cases = response.json()
        print(f"Fetched {len(all_cases)} total cases from the API.")

        # The initial list from the API doesn't contain the detailed insurance flag.
        # We must fetch details for each case to check if it's an insurance case.
        case_ids_to_process = [case['CaseId'] for case in all_cases]
        print(f"Found {len(case_ids_to_process)} total cases to check for details.")

        if not case_ids_to_process:
            print("No cases found in API response. Task finished.")
            return

        # Step 4: Fetch details and save each insurance case using parallel processing
        global _sync_stats
        with _sync_lock:
            _sync_stats["total_cases"] = len(case_ids_to_process)
        
        upsert_count = 0
        skipped_no_change_count = 0
        skipped_not_insurance_count = 0
        error_count = 0
        
        print(f"Starting parallel processing with {MAX_WORKERS} workers...")
        start_time = time.time()
        
        # Use ThreadPoolExecutor for parallel processing
        # Note: Each thread creates its own DB connection for thread safety
        with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
            # Submit all tasks
            future_to_case_id = {
                executor.submit(_process_single_case, case_id, start_time_utc): case_id
                for case_id in case_ids_to_process
            }
            
            # Process completed tasks
            completed = 0
            for future in as_completed(future_to_case_id):
                case_id = future_to_case_id[future]
                completed += 1
                
                if completed % 50 == 0 or completed == len(case_ids_to_process):
                    elapsed = time.time() - start_time
                    rate = completed / elapsed if elapsed > 0 else 0
                    remaining = len(case_ids_to_process) - completed
                    eta = remaining / rate if rate > 0 else 0
                    print(f"Progress: {completed}/{len(case_ids_to_process)} cases processed "
                          f"({rate:.1f} cases/sec, ETA: {eta:.0f}s)")
                    # Update stats
                    with _sync_lock:
                        _sync_stats["processed"] = completed

                try:
                    result = future.result()
                    if result == "upserted":
                        upsert_count += 1
                    elif result == "skipped_no_change":
                        skipped_no_change_count += 1
                    elif result == "skipped_not_insurance":
                        skipped_not_insurance_count += 1
                    elif result in ["error_fetch_failed", "error_db_connection", "error_processing"]:
                        error_count += 1
                except Exception as detail_err:
                    print(f"Error processing case {case_id}: {detail_err}")
                    error_count += 1
                    
                # Update stats periodically
                if completed % 50 == 0:
                    with _sync_lock:
                        _sync_stats["upserted"] = upsert_count
                        _sync_stats["skipped_no_change"] = skipped_no_change_count
                        _sync_stats["skipped_not_insurance"] = skipped_not_insurance_count
                        _sync_stats["errors"] = error_count
                    # Persist to database
                    if _sync_session_id:
                        _update_sync_session(
                            _sync_session_id,
                            processed=completed,
                            upserted=upsert_count,
                            skipped_no_change=skipped_no_change_count,
                            skipped_not_insurance=skipped_not_insurance_count,
                            errors=error_count
                        )

        elapsed_total = time.time() - start_time
        
        # Final stats update
        with _sync_lock:
            _sync_stats["upserted"] = upsert_count
            _sync_stats["skipped_no_change"] = skipped_no_change_count
            _sync_stats["skipped_not_insurance"] = skipped_not_insurance_count
            _sync_stats["errors"] = error_count
            _sync_stats["processed"] = len(case_ids_to_process)
        
        print(f"Sync finished in {elapsed_total:.1f}s. "
              f"Upserted: {upsert_count}, "
              f"Skipped (no change): {skipped_no_change_count}, "
              f"Skipped (not insurance): {skipped_not_insurance_count}, "
              f"Errors: {error_count}")

    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch case list from Repairline API: {e}")
    except Exception as e:
        import traceback
        print(f"An unexpected error occurred during the sync process: {e}")
        print(traceback.format_exc())
    
    print("Simple insurance case sync finished.")


def sync_all_cases_task():
    """
    Sync All: DB-first approach.
    1. First, get all caseIds from DB where insuranceIsActive=1
    2. For each DB case, fetch from API and update. Mark as inactive if no longer valid.
    3. Then, fetch API /cases list to find NEW cases not yet in DB
    4. Add those new cases
    """
    print("Starting SYNC ALL (DB-first) insurance case sync...")
    start_time_utc = datetime.now(timezone.utc)

    try:
        # =====================================================
        # PHASE 1: Update existing DB cases (and mark inactive if needed)
        # =====================================================
        print("PHASE 1: Checking existing DB cases for updates...")

        # Get all active insurance case IDs from the database
        cnx = get_mysql_connection()
        if not cnx:
            print("Failed to connect to database. Aborting sync.")
            return

        cursor = cnx.cursor()
        cursor.execute("SELECT caseId FROM repair_cases WHERE insuranceIsActive = 1")
        db_case_ids = [row[0] for row in cursor.fetchall()]
        cursor.close()
        cnx.close()

        print(f"Found {len(db_case_ids)} active insurance cases in database.")

        global _sync_stats
        with _sync_lock:
            _sync_stats["total_cases"] = len(db_case_ids)

        upsert_count = 0
        skipped_no_change_count = 0
        marked_inactive_count = 0
        error_count = 0

        if db_case_ids:
            print(f"Starting parallel processing of existing DB cases with {MAX_WORKERS} workers...")
            start_time = time.time()

            with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                # Process with mark_inactive_if_not_insurance=True
                future_to_case_id = {
                    executor.submit(_process_single_case, case_id, start_time_utc, True): case_id
                    for case_id in db_case_ids
                }

                completed = 0
                for future in as_completed(future_to_case_id):
                    case_id = future_to_case_id[future]
                    completed += 1

                    if completed % 50 == 0 or completed == len(db_case_ids):
                        elapsed = time.time() - start_time
                        rate = completed / elapsed if elapsed > 0 else 0
                        remaining = len(db_case_ids) - completed
                        eta = remaining / rate if rate > 0 else 0
                        print(f"Phase 1 Progress: {completed}/{len(db_case_ids)} cases "
                              f"({rate:.1f}/sec, ETA: {eta:.0f}s)")
                        with _sync_lock:
                            _sync_stats["processed"] = completed

                    try:
                        result = future.result()
                        if result == "upserted":
                            upsert_count += 1
                        elif result == "skipped_no_change":
                            skipped_no_change_count += 1
                        elif result == "marked_inactive":
                            marked_inactive_count += 1
                        elif result in ["error_fetch_failed", "error_db_connection", "error_processing", "error_marking_inactive"]:
                            error_count += 1
                    except Exception as detail_err:
                        print(f"Error processing case {case_id}: {detail_err}")
                        error_count += 1

                    if completed % 50 == 0:
                        with _sync_lock:
                            _sync_stats["upserted"] = upsert_count
                            _sync_stats["skipped_no_change"] = skipped_no_change_count
                            _sync_stats["marked_inactive"] = marked_inactive_count
                            _sync_stats["errors"] = error_count
                        # Persist to database
                        if _sync_session_id:
                            _update_sync_session(
                                _sync_session_id,
                                processed=completed,
                                upserted=upsert_count,
                                skipped_no_change=skipped_no_change_count,
                                marked_inactive=marked_inactive_count,
                                errors=error_count
                            )

            print(f"Phase 1 complete. Updated: {upsert_count}, No change: {skipped_no_change_count}, "
                  f"Marked inactive: {marked_inactive_count}, Errors: {error_count}")

        # =====================================================
        # PHASE 2: Check API for NEW cases not in DB
        # =====================================================
        print("PHASE 2: Checking API for new cases...")

        headers = {'User-Agent': 'Mozilla/5.0'}
        response = requests.get(
            f"{REPAIRLINE_API_BASE_URL}cases",
            auth=(REPAIRLINE_API_USERNAME, REPAIRLINE_API_PASSWORD),
            headers=headers,
            timeout=300,
        )
        response.raise_for_status()
        api_cases = response.json()
        api_case_ids = {case['CaseId'] for case in api_cases}
        print(f"Fetched {len(api_case_ids)} cases from API.")

        # Get current DB case IDs (including newly inactive ones)
        cnx = get_mysql_connection()
        if not cnx:
            print("Failed to connect to database for phase 2. Skipping new case check.")
        else:
            cursor = cnx.cursor()
            cursor.execute("SELECT caseId FROM repair_cases")
            existing_db_ids = {row[0] for row in cursor.fetchall()}
            cursor.close()
            cnx.close()

            # Find cases in API that are NOT in DB yet
            new_case_ids = api_case_ids - existing_db_ids
            print(f"Found {len(new_case_ids)} new cases in API not yet in DB.")

            if new_case_ids:
                # Update total count for progress tracking
                with _sync_lock:
                    _sync_stats["total_cases"] = len(db_case_ids) + len(new_case_ids)

                print(f"Processing {len(new_case_ids)} new cases...")
                start_time = time.time()

                with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
                    # Process new cases (don't mark inactive, they're new)
                    future_to_case_id = {
                        executor.submit(_process_single_case, case_id, start_time_utc, False): case_id
                        for case_id in new_case_ids
                    }

                    completed_phase2 = 0
                    for future in as_completed(future_to_case_id):
                        case_id = future_to_case_id[future]
                        completed_phase2 += 1

                        if completed_phase2 % 50 == 0 or completed_phase2 == len(new_case_ids):
                            elapsed = time.time() - start_time
                            rate = completed_phase2 / elapsed if elapsed > 0 else 0
                            print(f"Phase 2 Progress: {completed_phase2}/{len(new_case_ids)} new cases "
                                  f"({rate:.1f}/sec)")
                            with _sync_lock:
                                _sync_stats["processed"] = len(db_case_ids) + completed_phase2

                        try:
                            result = future.result()
                            if result == "upserted":
                                upsert_count += 1
                            elif result == "skipped_no_change":
                                skipped_no_change_count += 1
                            elif result == "skipped_not_insurance":
                                pass  # Expected for non-insurance cases
                            elif result in ["error_fetch_failed", "error_db_connection", "error_processing"]:
                                error_count += 1
                        except Exception as detail_err:
                            print(f"Error processing new case {case_id}: {detail_err}")
                            error_count += 1

        # Final stats update
        with _sync_lock:
            _sync_stats["upserted"] = upsert_count
            _sync_stats["skipped_no_change"] = skipped_no_change_count
            _sync_stats["marked_inactive"] = marked_inactive_count
            _sync_stats["errors"] = error_count
            _sync_stats["processed"] = len(db_case_ids) + len(new_case_ids) if 'new_case_ids' in locals() else len(db_case_ids)

        print(f"SYNC ALL finished. "
              f"Updated: {upsert_count}, "
              f"No change: {skipped_no_change_count}, "
              f"Marked inactive: {marked_inactive_count}, "
              f"Errors: {error_count}")

    except requests.exceptions.RequestException as e:
        print(f"Failed to fetch case list from Repairline API: {e}")
    except Exception as e:
        import traceback
        print(f"An unexpected error occurred during sync all: {e}")
        print(traceback.format_exc())

    print("SYNC ALL task finished.")


# Global flag to prevent multiple simultaneous syncs (thread-safe)
_sync_in_progress = False
_sync_lock = threading.Lock()
_sync_start_time = None
_sync_type = None  # Track which sync type is running: 'sync' or 'sync_all'
_sync_session_id = None  # Track current session ID for DB persistence
_sync_stats = {
    "total_cases": 0,
    "processed": 0,
    "upserted": 0,
    "skipped_no_change": 0,
    "skipped_not_insurance": 0,
    "marked_inactive": 0,
    "errors": 0
}


def get_current_sync_status() -> dict:
    """
    Returns the current sync status as a dictionary.
    Used by both the REST endpoint and SSE stream.
    """
    global _sync_in_progress, _sync_start_time, _sync_stats, _sync_type, _sync_session_id

    with _sync_lock:
        is_running = _sync_in_progress
        start_time = _sync_start_time
        stats = _sync_stats.copy()
        sync_type = _sync_type
        session_id = _sync_session_id

    if is_running and start_time:
        elapsed = (datetime.now(timezone.utc) - start_time).total_seconds()
    else:
        elapsed = None

    return {
        "is_running": is_running,
        "sync_type": sync_type,
        "session_id": session_id,
        "start_time": start_time.isoformat() if start_time else None,
        "elapsed_seconds": elapsed,
        "stats": stats
    }


@router.get("/sync-status")
async def get_sync_status():
    """
    Returns the current sync status.
    """
    return get_current_sync_status()


@router.get("/sync-status-stream")
async def sync_status_stream(request: Request):
    """
    Server-Sent Events (SSE) endpoint for real-time sync status updates.
    Streams status updates every 0.5 seconds while sync is running.
    Automatically closes when sync completes.
    """
    async def event_generator():
        try:
            while True:
                # Check if client disconnected
                if await request.is_disconnected():
                    print("[SSE] Client disconnected")
                    break

                status = get_current_sync_status()
                # Format as SSE event
                yield f"data: {json.dumps(status)}\n\n"

                # Stop streaming when sync is not running
                if not status["is_running"]:
                    # Send one final status and close
                    yield f"data: {json.dumps(status)}\n\n"
                    break

                await asyncio.sleep(0.5)
        except asyncio.CancelledError:
            print("[SSE] Stream cancelled")
        except Exception as e:
            print(f"[SSE] Error in event generator: {e}")
            error_event = {"error": str(e), "is_running": False}
            yield f"data: {json.dumps(error_event)}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",  # Disable nginx buffering
        }
    )

@router.post("/sync-insurance-cases")
@limiter.limit("5/minute")
async def trigger_sync(request: Request, background_tasks: BackgroundTasks):
    """
    Triggers the regular insurance case sync process in the background.
    This sync fetches active cases from the API and adds/updates them.
    It does NOT mark cases as inactive - use Sync All for that.
    Prevents multiple simultaneous syncs using thread-safe locking.
    """
    global _sync_in_progress, _sync_start_time, _sync_stats, _sync_type, _sync_session_id

    with _sync_lock:
        if _sync_in_progress:
            raise HTTPException(
                status_code=409,
                detail="A sync is already in progress. Please wait for it to complete."
            )
        _sync_in_progress = True
        _sync_start_time = datetime.now(timezone.utc)
        _sync_type = "sync"
        _sync_session_id = _create_sync_session("sync")
        _sync_stats = {
            "total_cases": 0,
            "processed": 0,
            "upserted": 0,
            "skipped_no_change": 0,
            "skipped_not_insurance": 0,
            "marked_inactive": 0,
            "errors": 0
        }

    print("Received request to trigger regular insurance case sync (API-first).")

    # Update session to running status
    if _sync_session_id:
        _update_sync_session(_sync_session_id, status="running", started_at=_sync_start_time)

    def sync_with_cleanup():
        global _sync_in_progress, _sync_start_time, _sync_type, _sync_session_id
        session_id = _sync_session_id
        try:
            sync_insurance_cases_task()
            # Mark session as completed
            if session_id:
                with _sync_lock:
                    final_stats = _sync_stats.copy()
                _update_sync_session(
                    session_id,
                    status="completed",
                    completed_at=datetime.now(timezone.utc),
                    **final_stats
                )
        except Exception as e:
            # Mark session as failed
            if session_id:
                _update_sync_session(
                    session_id,
                    status="failed",
                    completed_at=datetime.now(timezone.utc),
                    error_message=str(e)
                )
            raise
        finally:
            with _sync_lock:
                _sync_in_progress = False
                _sync_start_time = None
                _sync_type = None
                _sync_session_id = None

    background_tasks.add_task(sync_with_cleanup)
    return {"message": "Regular sync started. Fetching active cases from API."}


@router.post("/sync-all-insurance-cases")
@limiter.limit("5/minute")
async def trigger_sync_all(request: Request, background_tasks: BackgroundTasks):
    """
    Triggers SYNC ALL: DB-first approach.
    1. First updates all existing DB cases (insuranceIsActive=1)
    2. Marks cases as INACTIVE if they're no longer in the API or lost insurance status
    3. Then checks API for new cases and adds them

    This is the comprehensive sync that cleans up stale data.
    Prevents multiple simultaneous syncs using thread-safe locking.
    """
    global _sync_in_progress, _sync_start_time, _sync_stats, _sync_type, _sync_session_id

    with _sync_lock:
        if _sync_in_progress:
            raise HTTPException(
                status_code=409,
                detail="A sync is already in progress. Please wait for it to complete."
            )
        _sync_in_progress = True
        _sync_start_time = datetime.now(timezone.utc)
        _sync_type = "sync_all"
        _sync_session_id = _create_sync_session("sync_all")
        _sync_stats = {
            "total_cases": 0,
            "processed": 0,
            "upserted": 0,
            "skipped_no_change": 0,
            "skipped_not_insurance": 0,
            "marked_inactive": 0,
            "errors": 0
        }

    print("Received request to trigger SYNC ALL (DB-first) insurance case sync.")

    # Update session to running status
    if _sync_session_id:
        _update_sync_session(_sync_session_id, status="running", started_at=_sync_start_time)

    def sync_all_with_cleanup():
        global _sync_in_progress, _sync_start_time, _sync_type, _sync_session_id
        session_id = _sync_session_id
        try:
            sync_all_cases_task()
            # Mark session as completed
            if session_id:
                with _sync_lock:
                    final_stats = _sync_stats.copy()
                _update_sync_session(
                    session_id,
                    status="completed",
                    completed_at=datetime.now(timezone.utc),
                    **final_stats
                )
        except Exception as e:
            # Mark session as failed
            if session_id:
                _update_sync_session(
                    session_id,
                    status="failed",
                    completed_at=datetime.now(timezone.utc),
                    error_message=str(e)
                )
            raise
        finally:
            with _sync_lock:
                _sync_in_progress = False
                _sync_start_time = None
                _sync_type = None
                _sync_session_id = None

    background_tasks.add_task(sync_all_with_cleanup)
    return {"message": "Sync All started. Checking existing DB cases first, then looking for new cases."}


@router.post("/test-single-sync/{case_id}")
async def test_single_sync(case_id: int):
    """
    Triggers a sync for a single case ID for debugging purposes.
    """
    print(f"Received request to test sync for single case ID: {case_id}")
    try:
        start_time_utc = datetime.now(timezone.utc)
        result = _process_single_case(case_id, start_time_utc)

        return {"message": f"Sync test for case {case_id} completed.", "result": result}
    except Exception as e:
        import traceback
        print(f"An error occurred during the single case sync test: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/manual-sync")
@limiter.limit("10/minute")
async def manual_sync(request: Request, body: ManualSyncRequest):
    """
    Manually sync specific cases by their identifiers (case ID or case number).
    Processes each identifier and returns results.
    """
    print(f"[Manual Sync] Received request to sync {len(body.identifiers)} cases")

    if not body.identifiers:
        raise HTTPException(status_code=400, detail="No identifiers provided")

    if len(body.identifiers) > 100:
        raise HTTPException(status_code=400, detail="Maximum 100 identifiers per request")

    start_time_utc = datetime.now(timezone.utc)
    successful = 0
    failed = 0
    details = []

    for identifier in body.identifiers:
        identifier = identifier.strip()
        if not identifier:
            continue

        try:
            # Try to parse as case ID first
            case_id = None
            if identifier.isdigit():
                case_id = int(identifier)
            else:
                # Look up by case number in database
                try:
                    with get_db_connection() as cnx:
                        cursor = cnx.cursor(dictionary=True)
                        cursor.execute(
                            "SELECT caseId FROM repair_cases WHERE caseNumber = %s",
                            (identifier,)
                        )
                        row = cursor.fetchone()
                        cursor.close()
                        if row:
                            case_id = row['caseId']
                except Exception as e:
                    print(f"[Manual Sync] Error looking up case number {identifier}: {e}")

            if case_id is None:
                details.append(f"{identifier}: Not found in database")
                failed += 1
                continue

            # Process the case
            result = _process_single_case(case_id, start_time_utc, mark_inactive_if_not_insurance=False)

            if result == "upserted":
                details.append(f"{identifier}: Synced successfully")
                successful += 1
            elif result == "skipped_no_change":
                details.append(f"{identifier}: No changes detected")
                successful += 1  # Count as success since it's up to date
            elif result == "skipped_not_insurance":
                details.append(f"{identifier}: Not an insurance case")
                failed += 1
            elif result == "marked_inactive":
                details.append(f"{identifier}: Marked as inactive")
                successful += 1
            else:
                details.append(f"{identifier}: {result}")
                failed += 1

        except Exception as e:
            print(f"[Manual Sync] Error processing {identifier}: {e}")
            details.append(f"{identifier}: Error - {str(e)}")
            failed += 1

    print(f"[Manual Sync] Completed: {successful} successful, {failed} failed")

    return ManualSyncResponse(
        successful=successful,
        failed=failed,
        details=details
    )
