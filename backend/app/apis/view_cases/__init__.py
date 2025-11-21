from fastapi import APIRouter, HTTPException, Depends, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional, Annotated  # Added Annotated
import datetime
import json
import pandas as pd
import io

# Import the corrected database utility
from app.libs.database_management import get_mysql_connection

import mysql.connector  # For Error

router = APIRouter()


# Pydantic model representing a repair case from the database
class RepairCaseDB(BaseModel):
    caseId: str
    caseNumber: Optional[str] = None
    customerName: Optional[str] = None
    customerEmail: Optional[str] = None
    customerCity: Optional[str] = None
    productName: Optional[str] = None
    manufacturer: Optional[str] = None
    symptoms: Optional[str] = None
    storeName: Optional[str] = None
    status: Optional[str] = None
    warranty: Optional[str] = None  # Assuming string, adjust if boolean in DB
    serviceType: Optional[str] = None
    currency: Optional[str] = None
    fetchedAt: Optional[datetime.datetime] = None
    lastApiUpdate: Optional[datetime.datetime] = None
    rawApiDetail: str | dict | None = None  # JSON string
    insuranceContractNumber: Optional[str] = None
    insuranceIsActive: Optional[bool] = None
    insuranceName: Optional[str] = None
    insuranceDeductible: Optional[float] = None
    insuranceSettlementAmount: Optional[float] = None
    customerCompanyName: Optional[str] = None
    customerNumber: Optional[str] = None
    customerFirstName: Optional[str] = None
    customerLastName: Optional[str] = None
    customerPhoneMain: Optional[str] = None
    customerZipCode: Optional[str] = None
    productSerialNumber: Optional[str] = None
    totalRepairCost: Optional[float] = None

    class Config:
        from_attributes = True  # Replaced orm_mode for Pydantic v2 compatibility
        json_encoders = {datetime.datetime: lambda v: v.isoformat() if v else None}


class FilteredRepairCasesResponse(BaseModel):
    cases: List[RepairCaseDB]
    total_count: int
    page: int
    limit: int
    total_pages: int


@router.get("/cases", response_model=FilteredRepairCasesResponse)
async def get_cases(
    insuranceName: str | None = Query(None),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    limit: int = Query(50, ge=1, le=200, description="Number of items per page (max 200)"),
    search: str | None = Query(None, description="Search term to filter cases"),
    showActiveOnly: bool = Query(True, description="Filter out inactive/closed cases"),
    timeRangeMonths: int | None = Query(None, ge=0, description="Filter cases updated within last N months"),
    sortBy: str | None = Query("lastApiUpdate", description="Field to sort by"),
    sortDirection: str | None = Query("desc", description="Sort direction: 'asc' or 'desc'")
):
    """
    Fetches repair cases from the MySQL database with pagination and filtering.
    Core logic: (insuranceIsActive = 1 OR (insuranceIsActive = 0 AND IFNULL(LOWER(insuranceName), '') != 'wertgarantie'))
    Optionally filters by a specific insurance name if provided (ANDed with core logic).
    Supports search, active-only filter, time range filter, and sorting.
    Requires authentication.
    """
    cnx = None
    try:
        cnx = get_mysql_connection()
        cursor = cnx.cursor(dictionary=True)

        # Build WHERE clause
        core_filter_condition = "insuranceIsActive = 1 AND IFNULL(LOWER(insuranceName), '') != 'wertgarantie'"
        where_clauses = [core_filter_condition]
        query_params = []

        # Check if insuranceName is provided and is not the string 'null' (or other placeholder for 'all')
        if insuranceName and insuranceName.lower() != "null":
            if insuranceName != "_ALL_INSURANCES_":
                where_clauses.append("LOWER(insuranceName) = %s")
                query_params.append(insuranceName.lower())

        # Add active-only filter (exclude closed/inactive statuses)
        if showActiveOnly:
            inactive_statuses = [
                'abgeschlossen', 'geschlossen', 'storniert', 'abgelehnt',
                'cancelled', 'closed', 'completed', 'rejected',
                'unsachgemäßer abbruch', 'reparaturabbruch', 'gerät entsorgen'
            ]
            # Build NOT IN clause for statuses
            status_placeholders = ', '.join(['%s'] * len(inactive_statuses))
            where_clauses.append(f"LOWER(status) NOT IN ({status_placeholders})")
            query_params.extend([s.lower() for s in inactive_statuses])

        # Add time range filter
        if timeRangeMonths and timeRangeMonths > 0:
            where_clauses.append("lastApiUpdate >= DATE_SUB(NOW(), INTERVAL %s MONTH)")
            query_params.append(timeRangeMonths)

        # Add search filter
        if search and search.strip():
            search_term = f"%{search.strip().lower()}%"
            where_clauses.append("""
                (LOWER(caseNumber) LIKE %s 
                OR LOWER(customerName) LIKE %s 
                OR LOWER(productName) LIKE %s 
                OR LOWER(insuranceContractNumber) LIKE %s 
                OR LOWER(status) LIKE %s 
                OR LOWER(insuranceName) LIKE %s)
            """)
            query_params.extend([search_term] * 6)

        where_clause = " WHERE " + " AND ".join(where_clauses) if where_clauses else ""

        # First, get total count for pagination
        count_query = f"SELECT COUNT(*) as total FROM repair_cases {where_clause}"
        cursor.execute(count_query, tuple(query_params))
        total_count_result = cursor.fetchone()
        total_count = total_count_result['total'] if total_count_result else 0

        # Calculate pagination
        total_pages = (total_count + limit - 1) // limit if total_count > 0 else 0
        offset = (page - 1) * limit

        # Validate and set sort parameters
        valid_sort_fields = [
            'caseId', 'caseNumber', 'customerName', 'productName', 'status',
            'insuranceName', 'lastApiUpdate', 'insuranceContractNumber'
        ]
        sort_field = sortBy if sortBy in valid_sort_fields else 'lastApiUpdate'
        sort_dir = 'DESC' if sortDirection and sortDirection.lower() == 'desc' else 'ASC'

        # Build main query with pagination
        base_query = """
            SELECT 
                caseId, caseNumber, customerName, customerEmail, customerCity,
                productName, manufacturer, symptoms, storeName, status, warranty,
                serviceType, currency, fetchedAt, lastApiUpdate, rawApiDetail,
                insuranceContractNumber, insuranceIsActive, insuranceName,
                insuranceDeductible, insuranceSettlementAmount, customerCompanyName,
                customerNumber, customerFirstName, customerLastName, customerPhoneMain,
                customerZipCode, productSerialNumber, totalRepairCost
            FROM repair_cases 
        """

        full_query = base_query + where_clause + f" ORDER BY {sort_field} {sort_dir} LIMIT %s OFFSET %s"
        query_params_with_pagination = list(query_params) + [limit, offset]

        cursor.execute(full_query, tuple(query_params_with_pagination))
        fetched_cases_dicts = cursor.fetchall()

        validated_cases = [RepairCaseDB(**case_dict) for case_dict in fetched_cases_dicts]

        return FilteredRepairCasesResponse(
            cases=validated_cases,
            total_count=total_count,
            page=page,
            limit=limit,
            total_pages=total_pages
        )

    except mysql.connector.Error as err:
        print(f"MySQL Error: {err}")
        raise HTTPException(status_code=500, detail=f"Database error occurred: {err}")
    except Exception as e:
        print(f"General Error: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")
    finally:
        if cnx and cnx.is_connected():
            if "cursor" in locals() and cursor:
                cursor.close()
            cnx.close()
            # print("MySQL connection closed.") # For debugging


@router.get("/repair-case/{case_id}", response_model=RepairCaseDB)
async def get_repair_case_details(case_id: str):
    """
    Fetches the full details for a specific repair case by its caseId.
    """
    cnx = None
    try:
        cnx = get_mysql_connection()
        cursor = cnx.cursor(dictionary=True)

        query = """
            SELECT 
                caseId, caseNumber, customerName, customerEmail, customerCity,
                productName, manufacturer, symptoms, storeName, status, warranty,
                serviceType, currency, fetchedAt, lastApiUpdate, rawApiDetail,
                insuranceContractNumber, insuranceIsActive, insuranceName,
                insuranceDeductible, insuranceSettlementAmount, customerCompanyName,
                customerNumber, customerFirstName, customerLastName, customerPhoneMain,
                customerZipCode, productSerialNumber, totalRepairCost
            FROM repair_cases 
            WHERE caseId = %s
        """

        # print(f"DEBUG: Executing SQL Query: {query}") # For debugging
        # print(f"DEBUG: With Parameters: ({case_id},)") # For debugging
        cursor.execute(query, (case_id,))
        case_dict = cursor.fetchone()

        if not case_dict:
            raise HTTPException(status_code=404, detail="Repair case not found")

        # Attempt to parse rawApiDetail if it's a JSON string
        if case_dict.get("rawApiDetail") and isinstance(case_dict["rawApiDetail"], str):
            try:
                parsed_detail = json.loads(case_dict["rawApiDetail"])
                case_dict["rawApiDetail"] = parsed_detail
            except json.JSONDecodeError:
                print(f"Warning: rawApiDetail for caseId {case_id} is not valid JSON.")
                pass  # Pass as is for now

        return RepairCaseDB(**case_dict)

    except mysql.connector.Error as err:
        print(f"MySQL Error: {err}")
        raise HTTPException(status_code=500, detail=f"Database error occurred: {err}")
    except Exception as e:
        print(f"General Error: {e}")
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {str(e)}")
    finally:
        if cnx and cnx.is_connected():
            if "cursor" in locals() and cursor:  # Ensure cursor was defined
                cursor.close()
            cnx.close()
            # print("MySQL connection closed.") # For debugging


# (The existing get_filtered_repair_cases and get_repair_case_details functions would be above this)


@router.get("/export-repair-cases-csv", response_class=StreamingResponse, tags=["stream"])
async def export_repair_cases_csv(insuranceName: str | None = Query(None)):
    """
    Fetches repair cases from the MySQL database, similar to /filtered-repair-cases,
    and returns them as a CSV file download.
    """
    cnx = None
    try:
        cnx = get_mysql_connection()
        cursor = cnx.cursor(dictionary=True)

        base_query = """
            SELECT 
                caseNumber, customerName, productName, insuranceName AS VersicherungName, 
                insuranceContractNumber, status, fetchedAt
            FROM repair_cases 
        """

        core_filter_condition = "insuranceIsActive = 1 AND IFNULL(LOWER(insuranceName), '') != 'wertgarantie'"

        where_clauses = [core_filter_condition]
        query_params = []

        if insuranceName and insuranceName.lower() != "null" and insuranceName != "_ALL_INSURANCES_":
            where_clauses.append("LOWER(insuranceName) = %s")
            query_params.append(insuranceName.lower())

        full_query = base_query + " WHERE " + " AND ".join(where_clauses) + " ORDER BY lastApiUpdate DESC;"

        # print(f"DEBUG CSV Export: Executing SQL Query: {full_query}")
        # print(f"DEBUG CSV Export: With Parameters: {tuple(query_params)}")
        cursor.execute(full_query, tuple(query_params))
        fetched_cases_dicts = cursor.fetchall()

        if not fetched_cases_dicts:
            # Return an empty CSV if no data
            df = pd.DataFrame(
                columns=[
                    "Fallnummer",
                    "Kunde",
                    "Produkt",
                    "Versicherung",
                    "Versicherungsnr.",
                    "Status",
                    "Erstelldatum",
                ]
            )
            output = io.StringIO()
            df.to_csv(output, index=False)
            csv_data = output.getvalue()
            return StreamingResponse(
                iter([csv_data]),
                media_type="text/csv",
                headers={"Content-Disposition": "attachment; filename=reparaturfaelle_export_empty.csv"},
            )

        df = pd.DataFrame(fetched_cases_dicts)

        # Rename columns for CSV output and select them
        column_mapping = {
            "caseNumber": "Fallnummer",
            "customerName": "Kunde",
            "productName": "Produkt",
            "VersicherungName": "Versicherung",  # Already aliased in SQL to avoid clash if insuranceName was selected directly
            "insuranceContractNumber": "Versicherungsnr.",
            "status": "Status",
            "fetchedAt": "Erstelldatum",
        }
        df = df.rename(columns=column_mapping)

        # Ensure all desired columns are present, even if some cases have missing data for them
        desired_csv_columns = [
            "Fallnummer",
            "Kunde",
            "Produkt",
            "Versicherung",
            "Versicherungsnr.",
            "Status",
            "Erstelldatum",
        ]
        df = df.reindex(columns=desired_csv_columns)

        # Format 'Erstelldatum' (fetchedAt)
        if "Erstelldatum" in df.columns and not df["Erstelldatum"].empty:
            # Ensure the column is actually datetime before trying to format
            df["Erstelldatum"] = pd.to_datetime(df["Erstelldatum"], errors="coerce")
            df["Erstelldatum"] = df["Erstelldatum"].dt.strftime("%Y-%m-%d")

        output = io.StringIO()
        df.to_csv(output, index=False, quoting=1)  # quoting=1 means csv.QUOTE_ALL
        csv_data = output.getvalue()

        return StreamingResponse(
            iter([csv_data]),
            media_type="text/csv",
            headers={"Content-Disposition": "attachment; filename=reparaturfaelle_export.csv"},
        )

    except mysql.connector.Error as err:
        print(f"MySQL Error during CSV export: {err}")
        raise HTTPException(status_code=500, detail=f"Database error during CSV export: {err}")
    except Exception as e:
        print(f"General Error during CSV export: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"An unexpected error occurred during CSV export: {e}",
        )
    finally:
        if cnx and cnx.is_connected():
            if "cursor" in locals() and cursor:
                cursor.close()
            cnx.close()


@router.get("/export-old-repair-cases-excel", tags=["View Cases", "stream"])
async def export_old_repair_cases_excel():
    """
    Fetches repair cases from MySQL where isPresentInLastApiSync = 0
    and returns them as an Excel (XLSX) file.
    """
    cnx = None
    cursor = None
    try:
        # Use the imported get_mysql_connection_and_ensure_table function
        cnx = get_mysql_connection()
        if not cnx:
            # This path might not be hit if get_mysql_connection_and_ensure_table raises on failure
            raise HTTPException(status_code=500, detail="Failed to connect to database for export.")

        cursor = cnx.cursor(dictionary=True)  # Fetch as dictionaries

        # Fetch all columns for old cases
        query = """
            SELECT 
                id, caseId, caseNumber, customerName, customerEmail, customerCity, 
                productName, manufacturer, symptoms, insuranceStatus_old, storeName, 
                status, warranty, serviceType, currency, rawApiDetail, fetchedAt, 
                lastApiUpdate, insuranceContractNumber, insuranceIsActive, insuranceName, 
                insuranceDeductible, insuranceSettlementAmount, customerCompanyName, 
                customerNumber, customerFirstName, customerLastName, customerPhoneMain, 
                customerZipCode, productSerialNumber, totalRepairCost, 
                isPresentInLastApiSync, sourceType
            FROM repair_cases
            WHERE isPresentInLastApiSync = 0;
        """
        print(f"Executing query for old cases export (Excel): {query}")
        cursor.execute(query)
        old_cases = cursor.fetchall()
        print(f"Fetched {len(old_cases)} old cases for Excel export.")

        if not old_cases:
            # If no old cases, return an empty Excel file or a message.
            # For consistency with file download expectations, an empty Excel is better.
            df_empty = pd.DataFrame()  # Create an empty DataFrame
            output_empty = io.BytesIO()
            with pd.ExcelWriter(output_empty, engine="openpyxl") as writer_empty:
                df_empty.to_excel(writer_empty, sheet_name="Old Repair Cases", index=False)
            output_empty.seek(0)
            headers_empty = {"Content-Disposition": 'attachment; filename="old_repair_cases_empty.xlsx"'}
            return StreamingResponse(
                output_empty,
                media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                headers=headers_empty,
            )

        # Convert to pandas DataFrame
        df = pd.DataFrame(old_cases)

        # Handle potential JSON in rawApiDetail for Excel compatibility
        if "rawApiDetail" in df.columns:
            df["rawApiDetail"] = df["rawApiDetail"].apply(
                lambda x: (json.dumps(x) if x is not None and not isinstance(x, str) else x)
            )

        # Create Excel file in memory
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="Old Repair Cases", index=False)

        output.seek(0)

        headers = {"Content-Disposition": 'attachment; filename="old_repair_cases.xlsx"'}
        return StreamingResponse(
            output,
            media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            headers=headers,
        )

    except mysql.connector.Error as err:
        print(f"MySQL Error during old cases Excel export: {err}")
        raise HTTPException(status_code=500, detail=f"Database error during Excel export: {err}")
    except Exception as e:
        print(f"Unexpected error during old cases Excel export: {e}")
        import traceback

        traceback.print_exc()  # Log the full traceback for better debugging
        raise HTTPException(status_code=500, detail=f"An unexpected error occurred: {e}")
    finally:
        if cursor:  # Check if cursor was successfully created
            cursor.close()
        if cnx and cnx.is_connected():
            cnx.close()


# @router.get("/test-auth-in-view-cases", response_model=dict)
# async def test_auth_dependency_in_view_cases(current_user: Annotated[AuthorizedUser, Depends()]) -> dict:
#     print(f"User accessing /test-auth-in-view-cases: UID {current_user.sub}, Email {current_user.email if hasattr(current_user, 'email') else 'N/A'}")
#     return {"uid": current_user.sub, "email": current_user.email if hasattr(current_user, 'email') else 'N/A', "message": "Access granted to /test-auth-in-view-cases"}
