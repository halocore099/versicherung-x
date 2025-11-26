import {
  CheckHealthData,
  CreateFirebaseUserData,
  CreateUserRequest,
  ExportOldCasesRequest,
  ExportOldRepairCasesExcelData,
  ExportRepairCasesCsvData,
  ExportSpecificOldCasesFromReparlineExcelData,
  GetCasesData,
  GetRepairCaseDetailsData,
  ListFirebaseUsersData,
  MinimalAuthTestEndpointData,
  ReadAdminMeData,
  SyncStatusData,
  TestSingleSyncData,
  TriggerSyncData,
} from "./data-contracts";

export namespace Brain {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  export namespace check_health {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = CheckHealthData;
  }

  /**
   * No description
   * @tags dbtn/module:minimal_auth_test
   * @name minimal_auth_test_endpoint
   * @summary Minimal Auth Test Endpoint
   * @request GET:/routes/minimal-auth-works
   */
  export namespace minimal_auth_test_endpoint {
    export type RequestParams = {};
    export type RequestQuery = {
      /** Sub */
      sub: string;
      /** User Id */
      user_id?: string | null;
      /** Name */
      name?: string | null;
      /** Picture */
      picture?: string | null;
      /** Email */
      email?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = MinimalAuthTestEndpointData;
  }

  /**
   * @description Creates a new Firebase user with email and password. Only callable by the designated admin user.
   * @tags Admin - User Management, dbtn/module:admin_users, dbtn/hasAuth
   * @name create_firebase_user
   * @summary Create Firebase User
   * @request POST:/routes/create-firebase-user
   */
  export namespace create_firebase_user {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = CreateUserRequest;
    export type RequestHeaders = {};
    export type ResponseBody = CreateFirebaseUserData;
  }

  /**
   * @description Lists Firebase users with pagination. Only callable by the admin.
   * @tags Admin - User Management, dbtn/module:admin_users, dbtn/hasAuth
   * @name list_firebase_users
   * @summary List Firebase Users
   * @request GET:/routes/list-firebase-users
   */
  export namespace list_firebase_users {
    export type RequestParams = {};
    export type RequestQuery = {
      /** Page Token */
      page_token?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ListFirebaseUsersData;
  }

  /**
   * @description Helper endpoint to check admin user details and if their UID matches ADMIN_UIDS.
   * @tags Admin - User Management, dbtn/module:admin_users, dbtn/hasAuth
   * @name read_admin_me
   * @summary Read Admin Me
   * @request GET:/routes/me-admin
   */
  export namespace read_admin_me {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ReadAdminMeData;
  }

  /**
   * @description Accepts a list of old case numbers, fetches their details from Repairline API (in chunks), and returns an Excel file with specified fields. THIS ENDPOINT IS CURRENTLY CONFIGURED TO BE OPEN (NO LOGIN REQUIRED).
   * @tags Repair Case Exports, stream, dbtn/module:repair_case_exports
   * @name export_specific_old_cases_from_reparline_excel
   * @summary Export Specific Old Cases From Reparline Excel
   * @request POST:/routes/export-specific-old-cases-from-reparline-excel
   */
  export namespace export_specific_old_cases_from_reparline_excel {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = ExportOldCasesRequest;
    export type RequestHeaders = {};
    export type ResponseBody = ExportSpecificOldCasesFromReparlineExcelData;
  }

  /**
   * @description Fetches repair cases from the MySQL database. Core logic: (insuranceIsActive = 1 OR (insuranceIsActive = 0 AND IFNULL(LOWER(insuranceName), '') != 'wertgarantie')) Optionally filters by a specific insurance name if provided (ANDed with core logic). Orders by the last API update in descending order. Requires authentication.
   * @tags dbtn/module:view_cases
   * @name get_cases
   * @summary Get Cases
   * @request GET:/routes/cases
   */
  export namespace get_cases {
    export type RequestParams = {};
    export type RequestQuery = {
      /** Insurancename */
      insuranceName?: string | null;
      /** Page number (1-indexed) */
      page?: number | null;
      /** Number of items per page (max 200) */
      limit?: number | null;
      /** Search term to filter cases */
      search?: string | null;
      /** Filter out inactive/closed cases */
      showActiveOnly?: boolean | null;
      /** Filter cases updated within last N months */
      timeRangeMonths?: number | null;
      /** Field to sort by */
      sortBy?: string | null;
      /** Sort direction: 'asc' or 'desc' */
      sortDirection?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetCasesData;
  }

  /**
   * @description Fetches the full details for a specific repair case by its caseId.
   * @tags dbtn/module:view_cases
   * @name get_repair_case_details
   * @summary Get Repair Case Details
   * @request GET:/routes/repair-case/{case_id}
   */
  export namespace get_repair_case_details {
    export type RequestParams = {
      /** Case Id */
      caseId: string;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = GetRepairCaseDetailsData;
  }

  /**
   * @description Fetches repair cases from the MySQL database, similar to /filtered-repair-cases, and returns them as a CSV file download.
   * @tags stream, dbtn/module:view_cases
   * @name export_repair_cases_csv
   * @summary Export Repair Cases Csv
   * @request GET:/routes/export-repair-cases-csv
   */
  export namespace export_repair_cases_csv {
    export type RequestParams = {};
    export type RequestQuery = {
      /** Insurancename */
      insuranceName?: string | null;
    };
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ExportRepairCasesCsvData;
  }

  /**
   * @description Fetches repair cases from MySQL where isPresentInLastApiSync = 0 and returns them as an Excel (XLSX) file.
   * @tags View Cases, stream, dbtn/module:view_cases
   * @name export_old_repair_cases_excel
   * @summary Export Old Repair Cases Excel
   * @request GET:/routes/export-old-repair-cases-excel
   */
  export namespace export_old_repair_cases_excel {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = ExportOldRepairCasesExcelData;
  }

  /**
   * @description Returns the current status of the insurance case sync process.
   * @tags dbtn/module:simple_sync
   * @name get_sync_status
   * @summary Get Sync Status
   * @request GET:/routes/sync-status
   */
  export namespace get_sync_status {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = SyncStatusData;
  }

  /**
   * @description Triggers the simple insurance case sync process in the background.
   * @tags dbtn/module:simple_sync
   * @name trigger_sync
   * @summary Trigger Sync
   * @request POST:/routes/sync-insurance-cases
   */
  export namespace trigger_sync {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = TriggerSyncData;
  }

  /**
   * @description Triggers a sync of all insurance cases in the background. Updates all existing cases and only changes the API timestamp if there's an actual change.
   * @tags dbtn/module:simple_sync
   * @name trigger_sync_all
   * @summary Trigger Sync All
   * @request POST:/routes/sync-all-insurance-cases
   */
  export namespace trigger_sync_all {
    export type RequestParams = {};
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = TriggerSyncData;
  }

  /**
   * @description Triggers a sync for a single case ID for debugging purposes.
   * @tags dbtn/module:simple_sync
   * @name test_single_sync
   * @summary Test Single Sync
   * @request POST:/routes/test-single-sync/{case_id}
   */
  export namespace test_single_sync {
    export type RequestParams = {
      /** Case Id */
      caseId: number;
    };
    export type RequestQuery = {};
    export type RequestBody = never;
    export type RequestHeaders = {};
    export type ResponseBody = TestSingleSyncData;
  }
}
