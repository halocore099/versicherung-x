import io
import pandas as pd
import requests
import asyncio # Added for asyncio.sleep
from requests.auth import HTTPBasicAuth
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Dict, Any

import databutton as db
from app.auth import AuthorizedUser # Assuming endpoint might be protected

router = APIRouter(tags=["Repair Case Exports"])

REPAIRLINE_API_BASE_URL = "http://api.system.repairline.de/"

# --- Pydantic Models ---
class ExportOldCasesRequest(BaseModel):
    case_numbers: List[str]

# --- Helper Functions ---
async def fetch_case_details_from_reparline(case_number: str) -> Dict[str, Any] | None:
    """Fetches case details for a single case number from Repairline API using Basic Auth."""
    username = db.secrets.get("REPAIRLINE_API_USERNAME")
    password = db.secrets.get("REPAIRLINE_API_PASSWORD")

    if not username or not password:
        print("Error: Repairline API username or password not configured in secrets.")
        raise HTTPException(status_code=500, detail="Repairline API authentication not configured.")
    
    # DEBUG: Log retrieved credentials (REMOVE AFTER DEBUGGING)
    print(f"DEBUG: Using Repairline Username: {username}")
    if password and len(password) > 1:
        print(f"DEBUG: Using Repairline Password (ends with): ...{password[-1:]}\n")
    elif password:
        print(f"DEBUG: Using Repairline Password (single char): {password}\n")
    else:
        print("DEBUG: Repairline Password is None or empty after fetching from secrets.\n")
    # END DEBUG

    auth = HTTPBasicAuth(username, password)
    headers = {
        "Accept": "application/json"
    }
    try:
        # Ensure case_number is stripped of whitespace before using in URL
        response = requests.get(f"{REPAIRLINE_API_BASE_URL}Cases/{case_number.strip()}", auth=auth, headers=headers)
        response.raise_for_status() 
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error fetching case {case_number} from Repairline: {e}")
        if isinstance(e, requests.exceptions.HTTPError) and e.response.status_code == 404:
            print(f"Case {case_number} not found in Repairline.")
            return None 
        return None 

# --- API Endpoint ---
@router.post("/export-specific-old-cases-from-reparline-excel", tags=["stream"])
async def export_specific_old_cases_from_reparline_excel(request_body: ExportOldCasesRequest):
    """
    Accepts a list of old case numbers, fetches their details from Repairline API (in chunks),
    and returns an Excel file with specified fields.
    THIS ENDPOINT IS CURRENTLY CONFIGURED TO BE OPEN (NO LOGIN REQUIRED).
    """
    CHUNK_SIZE = 100  # Number of cases to process per internal batch
    PAUSE_BETWEEN_CHUNKS_SECONDS = 2  # Pause duration between chunks

    # The API key/password is now fetched inside fetch_case_details_from_reparline

    print(f"Open export endpoint hit for {len(request_body.case_numbers)} case numbers.")

    all_cases_data = []
    not_found_cases = []
    processed_count = 0
    total_cases = len(request_body.case_numbers)
    num_chunks = (total_cases + CHUNK_SIZE - 1) // CHUNK_SIZE # Calculate total number of chunks

    for i in range(0, total_cases, CHUNK_SIZE):
        chunk_number = (i // CHUNK_SIZE) + 1
        chunk = request_body.case_numbers[i:i + CHUNK_SIZE]
        print(f"Processing chunk {chunk_number} of {num_chunks}. Cases {i+1}-{min(i+CHUNK_SIZE, total_cases)} of {total_cases}.")
        
        for case_number in chunk:
            if not case_number or not case_number.strip():
                print(f"Skipping empty case number.")
                processed_count += 1
                continue
            
            # print(f"Fetching details for case: {case_number}") # Less verbose logging for many cases
            case_data = await fetch_case_details_from_reparline(case_number.strip())
            processed_count += 1
            
            if case_data:
                extracted_info = {
                    "caseNumber": case_data.get("caseNumber"),
                    "customerName": case_data.get("customerName"), 
                    "productName": case_data.get("productName"),
                    "manufacturer": case_data.get("manufacturer"),
                    "serialNumber": case_data.get("serialNumber"), 
                    "status": case_data.get("status"),
                    "storeName": case_data.get("storeName"),
                    "insuranceName": case_data.get("insuranceName"),
                    "insuranceContractNumber": case_data.get("insuranceContractNumber"),
                    "totalRepairCost": case_data.get("totalRepairCost"), 
                    "creationDate": case_data.get("creationDate"), 
                    "lastStatusDate": case_data.get("lastStatusDate") 
                }
                all_cases_data.append(extracted_info)
            else: 
                not_found_cases.append(case_number.strip())
        
        print(f"Finished processing chunk {chunk_number}. Fetched {len(all_cases_data)} cases so far. {len(not_found_cases)} not found.")

        if chunk_number < num_chunks: # Pause if it's not the last chunk
            print(f"Pausing for {PAUSE_BETWEEN_CHUNKS_SECONDS} seconds before next chunk...")
            await asyncio.sleep(PAUSE_BETWEEN_CHUNKS_SECONDS)
        
    if not all_cases_data:
        detail_message = "No data found for the provided case numbers."
        if not_found_cases:
            detail_message += f" Cases not found or error fetching: {', '.join(not_found_cases)}."
        raise HTTPException(status_code=404, detail=detail_message)

    print(f"Consolidating data for {len(all_cases_data)} cases into Excel file.")
    df = pd.DataFrame(all_cases_data)
    
    df.rename(columns={
        "caseNumber": "Servicefall-Nr.",
        "customerName": "Kundenname",
        "productName": "Produktbezeichnung",
        "manufacturer": "Hersteller",
        "serialNumber": "Seriennummer",
        "status": "Status",
        "storeName": "Filialname",
        "insuranceName": "Versicherungsname",
        "insuranceContractNumber": "Versicherungsscheinnummer",
        "totalRepairCost": "Reparaturkosten",
        "creationDate": "Erstellungsdatum",
        "lastStatusDate": "Letzte Statusänderung"
    }, inplace=True)

    excel_columns_ordered = [
        "Servicefall-Nr.", "Kundenname", "Produktbezeichnung", "Hersteller", 
        "Seriennummer", "Status", "Filialname", "Versicherungsname", 
        "Versicherungsscheinnummer", "Reparaturkosten", "Erstellungsdatum", "Letzte Statusänderung"
    ]
    df = df.reindex(columns=excel_columns_ordered)

    excel_buffer = io.BytesIO()
    df.to_excel(excel_buffer, index=False, sheet_name="Alte Servicefälle")
    excel_buffer.seek(0)

    headers = {
        'Content-Disposition': 'attachment; filename="alte_servicefaelle_export.xlsx"'
    }
    
    print(f"Successfully prepared Excel export for {len(all_cases_data)} cases. Not found/error: {len(not_found_cases)}.")

    return StreamingResponse(
        excel_buffer, 
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers=headers
    )

