/** CreateUserRequest */
export interface CreateUserRequest {
  /** Email */
  email: string;
  /** Password */
  password: string;
}

/** CreateUserResponse */
export interface CreateUserResponse {
  /** Uid */
  uid: string;
  /** Email */
  email?: string | null;
}

/** ExportOldCasesRequest */
export interface ExportOldCasesRequest {
  /** Case Numbers */
  case_numbers: string[];
}

/** FilteredRepairCasesResponse */
export interface FilteredRepairCasesResponse {
  /** Cases */
  cases: RepairCaseDB[];
  /** Total Count */
  total_count: number;
  /** Page */
  page: number;
  /** Limit */
  limit: number;
  /** Total Pages */
  total_pages: number;
}

/** HTTPValidationError */
export interface HTTPValidationError {
  /** Detail */
  detail?: ValidationError[];
}

/** HealthResponse */
export interface HealthResponse {
  /** Status */
  status: string;
}

/** ListUsersResponse */
export interface ListUsersResponse {
  /** Users */
  users: UserDetails[];
  /** Next Page Token */
  next_page_token?: string | null;
}

/** RepairCaseDB */
export interface RepairCaseDB {
  /** Caseid */
  caseId: string;
  /** Casenumber */
  caseNumber?: string | null;
  /** Customername */
  customerName?: string | null;
  /** Customeremail */
  customerEmail?: string | null;
  /** Customercity */
  customerCity?: string | null;
  /** Productname */
  productName?: string | null;
  /** Manufacturer */
  manufacturer?: string | null;
  /** Symptoms */
  symptoms?: string | null;
  /** Storename */
  storeName?: string | null;
  /** Status */
  status?: string | null;
  /** Warranty */
  warranty?: string | null;
  /** Servicetype */
  serviceType?: string | null;
  /** Currency */
  currency?: string | null;
  /** Fetchedat */
  fetchedAt?: string | null;
  /** Lastapiupdate */
  lastApiUpdate?: string | null;
  /** Rawapidetail */
  rawApiDetail?: string | Record<string, any> | null;
  /** Insurancecontractnumber */
  insuranceContractNumber?: string | null;
  /** Insuranceisactive */
  insuranceIsActive?: boolean | null;
  /** Insurancename */
  insuranceName?: string | null;
  /** Insurancedeductible */
  insuranceDeductible?: number | null;
  /** Insurancesettlementamount */
  insuranceSettlementAmount?: number | null;
  /** Customercompanyname */
  customerCompanyName?: string | null;
  /** Customernumber */
  customerNumber?: string | null;
  /** Customerfirstname */
  customerFirstName?: string | null;
  /** Customerlastname */
  customerLastName?: string | null;
  /** Customerphonemain */
  customerPhoneMain?: string | null;
  /** Customerzipcode */
  customerZipCode?: string | null;
  /** Productserialnumber */
  productSerialNumber?: string | null;
  /** Totalrepaircost */
  totalRepairCost?: number | null;
}

/** UserDetails */
export interface UserDetails {
  /** Uid */
  uid: string;
  /** Email */
  email?: string | null;
  /** Email Verified */
  email_verified: boolean;
  /** Disabled */
  disabled: boolean;
  metadata: UserMetadata;
}

/** UserMetadata */
export interface UserMetadata {
  /** Creation Timestamp Ms */
  creation_timestamp_ms?: number | null;
  /** Last Sign In Timestamp Ms */
  last_sign_in_timestamp_ms?: number | null;
}

/** UserResponse */
export interface UserResponse {
  /** Uid */
  uid: string;
  /** Email */
  email: string | null;
  /** Message */
  message: string;
}

/** ValidationError */
export interface ValidationError {
  /** Location */
  loc: (string | number)[];
  /** Message */
  msg: string;
  /** Error Type */
  type: string;
}

export type CheckHealthData = HealthResponse;

export interface MinimalAuthTestEndpointParams {
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
}

export type MinimalAuthTestEndpointData = UserResponse;

export type MinimalAuthTestEndpointError = HTTPValidationError;

export type CreateFirebaseUserData = CreateUserResponse;

export type CreateFirebaseUserError = HTTPValidationError;

export interface ListFirebaseUsersParams {
  /** Page Token */
  page_token?: string | null;
}

export type ListFirebaseUsersData = ListUsersResponse;

export type ListFirebaseUsersError = HTTPValidationError;

/** Response Read Admin Me */
export type ReadAdminMeData = Record<string, any>;

export type ExportSpecificOldCasesFromReparlineExcelData = any;

export type ExportSpecificOldCasesFromReparlineExcelError = HTTPValidationError;

export interface GetCasesParams {
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
}

export type GetCasesData = FilteredRepairCasesResponse;

export type GetCasesError = HTTPValidationError;

export interface GetRepairCaseDetailsParams {
  /** Case Id */
  caseId: string;
}

export type GetRepairCaseDetailsData = RepairCaseDB;

export type GetRepairCaseDetailsError = HTTPValidationError;

export interface ExportRepairCasesCsvParams {
  /** Insurancename */
  insuranceName?: string | null;
}

export type ExportRepairCasesCsvData = any;

export type ExportRepairCasesCsvError = HTTPValidationError;

export type ExportOldRepairCasesExcelData = any;

export type TriggerSyncData = any;

export interface SyncStatusData {
  is_running: boolean;
  start_time: string | null;
  elapsed_seconds: number | null;
  stats: {
    total_cases: number;
    processed: number;
    upserted: number;
    skipped_no_change: number;
    skipped_not_insurance: number;
    errors: number;
  };
}

export interface TestSingleSyncParams {
  /** Case Id */
  caseId: number;
}

export type TestSingleSyncData = any;

export type TestSingleSyncError = HTTPValidationError;
