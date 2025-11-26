import {
  CheckHealthData,
  CreateFirebaseUserData,
  CreateFirebaseUserError,
  CreateUserRequest,
  ExportOldCasesRequest,
  ExportOldRepairCasesExcelData,
  ExportRepairCasesCsvData,
  ExportRepairCasesCsvError,
  ExportRepairCasesCsvParams,
  ExportSpecificOldCasesFromReparlineExcelData,
  ExportSpecificOldCasesFromReparlineExcelError,
  GetCasesData,
  GetCasesError,
  GetCasesParams,
  GetRepairCaseDetailsData,
  GetRepairCaseDetailsError,
  GetRepairCaseDetailsParams,
  ListFirebaseUsersData,
  ListFirebaseUsersError,
  ListFirebaseUsersParams,
  MinimalAuthTestEndpointData,
  MinimalAuthTestEndpointError,
  MinimalAuthTestEndpointParams,
  ReadAdminMeData,
  SyncStatusData,
  TestSingleSyncData,
  TestSingleSyncError,
  TestSingleSyncParams,
  TriggerSyncData,
} from "./data-contracts";
import { ContentType, HttpClient, RequestParams } from "./http-client";

export class Brain<SecurityDataType = unknown> extends HttpClient<SecurityDataType> {
  /**
   * @description Check health of application. Returns 200 when OK, 500 when not.
   *
   * @name check_health
   * @summary Check Health
   * @request GET:/_healthz
   */
  check_health = (params: RequestParams = {}) =>
    this.request<CheckHealthData, any>({
      path: `/_healthz`,
      method: "GET",
      ...params,
    });

  /**
   * No description
   *
   * @tags dbtn/module:minimal_auth_test
   * @name minimal_auth_test_endpoint
   * @summary Minimal Auth Test Endpoint
   * @request GET:/routes/minimal-auth-works
   */
  minimal_auth_test_endpoint = (query: MinimalAuthTestEndpointParams, params: RequestParams = {}) =>
    this.request<MinimalAuthTestEndpointData, MinimalAuthTestEndpointError>({
      path: `/routes/minimal-auth-works`,
      method: "GET",
      query: query,
      ...params,
    });

  /**
   * @description Creates a new Firebase user with email and password. Only callable by the designated admin user.
   *
   * @tags Admin - User Management, dbtn/module:admin_users, dbtn/hasAuth
   * @name create_firebase_user
   * @summary Create Firebase User
   * @request POST:/routes/create-firebase-user
   */
  create_firebase_user = (data: CreateUserRequest, params: RequestParams = {}) =>
    this.request<CreateFirebaseUserData, CreateFirebaseUserError>({
      path: `/routes/create-firebase-user`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Lists Firebase users with pagination. Only callable by the admin.
   *
   * @tags Admin - User Management, dbtn/module:admin_users, dbtn/hasAuth
   * @name list_firebase_users
   * @summary List Firebase Users
   * @request GET:/routes/list-firebase-users
   */
  list_firebase_users = (query: ListFirebaseUsersParams, params: RequestParams = {}) =>
    this.request<ListFirebaseUsersData, ListFirebaseUsersError>({
      path: `/routes/list-firebase-users`,
      method: "GET",
      query: query,
      ...params,
    });

  /**
   * @description Helper endpoint to check admin user details and if their UID matches ADMIN_UIDS.
   *
   * @tags Admin - User Management, dbtn/module:admin_users, dbtn/hasAuth
   * @name read_admin_me
   * @summary Read Admin Me
   * @request GET:/routes/me-admin
   */
  read_admin_me = (params: RequestParams = {}) =>
    this.request<ReadAdminMeData, any>({
      path: `/routes/me-admin`,
      method: "GET",
      ...params,
    });

  /**
   * @description Accepts a list of old case numbers, fetches their details from Repairline API (in chunks), and returns an Excel file with specified fields. THIS ENDPOINT IS CURRENTLY CONFIGURED TO BE OPEN (NO LOGIN REQUIRED).
   *
   * @tags Repair Case Exports, stream, dbtn/module:repair_case_exports
   * @name export_specific_old_cases_from_reparline_excel
   * @summary Export Specific Old Cases From Reparline Excel
   * @request POST:/routes/export-specific-old-cases-from-reparline-excel
   */
  export_specific_old_cases_from_reparline_excel = (data: ExportOldCasesRequest, params: RequestParams = {}) =>
    this.requestStream<ExportSpecificOldCasesFromReparlineExcelData, ExportSpecificOldCasesFromReparlineExcelError>({
      path: `/routes/export-specific-old-cases-from-reparline-excel`,
      method: "POST",
      body: data,
      type: ContentType.Json,
      ...params,
    });

  /**
   * @description Fetches repair cases from the MySQL database. Core logic: (insuranceIsActive = 1 OR (insuranceIsActive = 0 AND IFNULL(LOWER(insuranceName), '') != 'wertgarantie')) Optionally filters by a specific insurance name if provided (ANDed with core logic). Orders by the last API update in descending order. Requires authentication.
   *
   * @tags dbtn/module:view_cases
   * @name get_cases
   * @summary Get Cases
   * @request GET:/routes/cases
   */
  get_cases = (query: GetCasesParams, params: RequestParams = {}) =>
    this.request<GetCasesData, GetCasesError>({
      path: `/routes/cases`,
      method: "GET",
      query: {
        ...query,
        // Ensure page and limit are numbers, not strings
        page: query.page !== undefined && query.page !== null ? Number(query.page) : undefined,
        limit: query.limit !== undefined && query.limit !== null ? Number(query.limit) : undefined,
      },
      ...params,
    });

  /**
   * @description Fetches the full details for a specific repair case by its caseId.
   *
   * @tags dbtn/module:view_cases
   * @name get_repair_case_details
   * @summary Get Repair Case Details
   * @request GET:/routes/repair-case/{case_id}
   */
  get_repair_case_details = ({ caseId, ...query }: GetRepairCaseDetailsParams, params: RequestParams = {}) =>
    this.request<GetRepairCaseDetailsData, GetRepairCaseDetailsError>({
      path: `/routes/repair-case/${caseId}`,
      method: "GET",
      ...params,
    });

  /**
   * @description Fetches repair cases from the MySQL database, similar to /filtered-repair-cases, and returns them as a CSV file download.
   *
   * @tags stream, dbtn/module:view_cases
   * @name export_repair_cases_csv
   * @summary Export Repair Cases Csv
   * @request GET:/routes/export-repair-cases-csv
   */
  export_repair_cases_csv = (query: ExportRepairCasesCsvParams, params: RequestParams = {}) =>
    this.requestStream<ExportRepairCasesCsvData, ExportRepairCasesCsvError>({
      path: `/routes/export-repair-cases-csv`,
      method: "GET",
      query: query,
      ...params,
    });

  /**
   * @description Fetches repair cases from MySQL where isPresentInLastApiSync = 0 and returns them as an Excel (XLSX) file.
   *
   * @tags View Cases, stream, dbtn/module:view_cases
   * @name export_old_repair_cases_excel
   * @summary Export Old Repair Cases Excel
   * @request GET:/routes/export-old-repair-cases-excel
   */
  export_old_repair_cases_excel = (params: RequestParams = {}) =>
    this.requestStream<ExportOldRepairCasesExcelData, any>({
      path: `/routes/export-old-repair-cases-excel`,
      method: "GET",
      ...params,
    });

  /**
   * @description Returns the current status of the insurance case sync process.
   *
   * @tags dbtn/module:simple_sync
   * @name get_sync_status
   * @summary Get Sync Status
   * @request GET:/routes/sync-status
   */
  get_sync_status = (params: RequestParams = {}) =>
    this.request<SyncStatusData, any>({
      path: `/routes/sync-status`,
      method: "GET",
      ...params,
    });

  /**
   * @description Triggers the simple insurance case sync process in the background.
   *
   * @tags dbtn/module:simple_sync
   * @name trigger_sync
   * @summary Trigger Sync
   * @request POST:/routes/sync-insurance-cases
   */
  trigger_sync = (params: RequestParams = {}) =>
    this.request<TriggerSyncData, any>({
      path: `/routes/sync-insurance-cases`,
      method: "POST",
      ...params,
    });

  /**
   * @description Triggers a sync of all insurance cases in the background. Updates all existing cases and only changes the API timestamp if there's an actual change.
   *
   * @tags dbtn/module:simple_sync
   * @name trigger_sync_all
   * @summary Trigger Sync All
   * @request POST:/routes/sync-all-insurance-cases
   */
  trigger_sync_all = (params: RequestParams = {}) =>
    this.request<TriggerSyncData, any>({
      path: `/routes/sync-all-insurance-cases`,
      method: "POST",
      ...params,
    });

  /**
   * @description Triggers a sync for a single case ID for debugging purposes.
   *
   * @tags dbtn/module:simple_sync
   * @name test_single_sync
   * @summary Test Single Sync
   * @request POST:/routes/test-single-sync/{case_id}
   */
  test_single_sync = ({ caseId, ...query }: TestSingleSyncParams, params: RequestParams = {}) =>
    this.request<TestSingleSyncData, TestSingleSyncError>({
      path: `/routes/test-single-sync/${caseId}`,
      method: "POST",
      ...params,
    });
}
