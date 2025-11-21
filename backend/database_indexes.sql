-- Database indexes for performance optimization
-- Run these SQL commands on your MySQL database to improve query performance

-- Index for the main filter condition (insuranceIsActive + insuranceName)
CREATE INDEX IF NOT EXISTS idx_insurance_active_name 
ON repair_cases(insuranceIsActive, insuranceName(50));

-- Index for sorting by lastApiUpdate (most common sort)
CREATE INDEX IF NOT EXISTS idx_last_api_update 
ON repair_cases(lastApiUpdate DESC);

-- Index for caseId lookups (primary key should already have this, but ensuring it exists)
CREATE INDEX IF NOT EXISTS idx_case_id 
ON repair_cases(caseId);

-- Composite index for common query patterns (insurance + status + date)
CREATE INDEX IF NOT EXISTS idx_insurance_status_date 
ON repair_cases(insuranceIsActive, status(50), lastApiUpdate DESC);

-- Index for search functionality (caseNumber, customerName, etc.)
-- Note: Full-text indexes might be better for search, but these help with LIKE queries
CREATE INDEX IF NOT EXISTS idx_case_number 
ON repair_cases(caseNumber(50));

CREATE INDEX IF NOT EXISTS idx_customer_name 
ON repair_cases(customerName(100));

-- Index for insurance contract number lookups
CREATE INDEX IF NOT EXISTS idx_insurance_contract 
ON repair_cases(insuranceContractNumber(50));

-- Show existing indexes (for verification)
-- SHOW INDEXES FROM repair_cases;

