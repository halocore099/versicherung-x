from fastapi import APIRouter, BackgroundTasks, HTTPException
import requests
import json
import os
from app.libs.database_management import get_mysql_connection
from datetime import datetime, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed
import time
import threading
from typing import Optional

router = APIRouter()

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


def _process_single_case(case_id: int, start_time_utc: datetime):
    """
    Fetches, parses, and saves a single insurance case.
    Creates its own database connection for thread safety.
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
            return "error_fetch_failed"
        
        print(f"[{case_id}] Fetched raw API data.")

        # 2. Check if it's an insurance case
        insurance_data = case_data.get('Insurance') # Can be None
        if not (insurance_data and insurance_data.get('InsuranceIsActivated')):
            print(f"[{case_id}] Is not an insurance case or Insurance object is null/inactive. Skipping.")
            return "skipped_not_insurance"
        
        print(f"[{case_id}] Is an insurance case. Proceeding.")

        # 3. Compare with existing data to see if an update is needed
        cursor = cnx.cursor(dictionary=True)
        cursor.execute("SELECT `rawApiDetail` FROM `repair_cases` WHERE `caseId` = %s", (case_id,))
        existing_record = cursor.fetchone()
        cursor.close()

        new_raw_detail_json = json.dumps(case_data, sort_keys=True)

        if existing_record:
            try:
                existing_raw_detail = existing_record.get('rawApiDetail', '{}')
                if isinstance(existing_raw_detail, bytes):
                    existing_raw_detail = existing_raw_detail.decode('utf-8')
                
                normalized_existing = json.dumps(json.loads(existing_raw_detail), sort_keys=True)
                
                if normalized_existing == new_raw_detail_json:
                    print(f"[{case_id}] Data is identical to DB record. Skipping update.")
                    return "skipped_no_change"
            except (json.JSONDecodeError, TypeError) as json_err:
                print(f"[{case_id}] Warning: Could not compare JSON. Proceeding with update. Error: {json_err}")
        
        # 4. Robust Data Mapping
        print(f"[{case_id}] Data has changed or is new. Mapping fields for upsert.")
        
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
            'lastApiUpdate': start_time_utc,
            'isPresentInLastApiSync': 1,
        }

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
        elapsed_total = time.time() - start_time
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


# Global flag to prevent multiple simultaneous syncs (thread-safe)
_sync_in_progress = False
_sync_lock = threading.Lock()

@router.post("/sync-insurance-cases")
async def trigger_sync(background_tasks: BackgroundTasks):
    """
    Triggers the simple insurance case sync process in the background.
    Prevents multiple simultaneous syncs using thread-safe locking.
    """
    global _sync_in_progress
    
    with _sync_lock:
        if _sync_in_progress:
            raise HTTPException(
                status_code=409,
                detail="A sync is already in progress. Please wait for it to complete."
            )
        _sync_in_progress = True
    
    print("Received request to trigger simple insurance case sync.")
    
    def sync_with_cleanup():
        try:
            sync_insurance_cases_task()
        finally:
            global _sync_in_progress
            with _sync_lock:
                _sync_in_progress = False
    
    background_tasks.add_task(sync_with_cleanup)
    return {"message": "Simple insurance case sync process started in the background."}


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
