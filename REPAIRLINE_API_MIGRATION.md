# Repairline API Migration Guide

Migration from the old v2 API to the new v1 API.

---

## Base URL

| | URL |
|---|---|
| **Old** | `http://api.system.repairline.de/v2/` |
| **New (prod)** | `https://sunriseapi.repairline.de/` |
| **New (test)** | `https://sunriseapitest.repairline.de/` |

Authentication is unchanged: **HTTP Basic Auth** with your API username and password.

---

## Endpoint Changes

### List Cases

**Old**
```
GET /v2/cases
```
Response: `[{ "CaseId": 123, "CaseNumber": "SV-001" }, ...]`

**New**
```
GET /CaseExport/GetCaseNumbersWithStatusOfOpenCases
```
Response: `[{ "CaseId": 123, "CaseNumber": "SV-001", "StatusId": 5, "Status": "In Repair", "StatusKey": "in_repair", "Store": "Berlin" }, ...]`

> The new list endpoint only returns **open** cases (not all cases). It also includes the current status and store, saving you from fetching individual cases just to check status.

**Other useful list endpoints:**
```
GET /CaseExport/GetCaseNumbersOfOpenCases
```
Returns just an array of case number strings.

```
GET /CaseExport/GetCaseNumbersOfCasesBookedRecently?minutes=60
```
Returns cases that had a status booking in the last N minutes — useful for incremental syncs.

```
GET /CaseExport/GetCasesByStatus?statusKey=in_repair
```
Filter by a specific status key.

---

### Get Single Case Detail

**Old** — fetched by integer case ID:
```
GET /v2/cases/{caseId}
```

**New** — fetched by case number string:
```
GET /Cases/{caseNumber}
```

Example: `GET /Cases/SV-2024-001`

---

## Response Schema Changes

### Servicecase (case detail response)

#### Top-level fields

| Field | Old | New |
|---|---|---|
| `CaseId` | ✅ int | ✅ int |
| `CaseNumber` | ✅ string | ✅ string |
| `Warranty` | ✅ string | ✅ string |
| `Currency` | ✅ string | ✅ string |
| `Status` | ✅ top-level string | ❌ **removed** — read from `Bookings[-1].Status` |

#### Customer

All previous fields are present. New fields added:

| Field | Old | New |
|---|---|---|
| `FirstName` | ✅ | ✅ |
| `LastName` | ✅ | ✅ |
| `Email` | ✅ | ✅ |
| `City` | ✅ | ✅ |
| `ZipCode` | ✅ | ✅ |
| `CompanyName` | ✅ | ✅ |
| `CustomerNumber` | ✅ | ✅ |
| `PhoneMain` | ✅ | ✅ |
| `CustomerId` | ❌ | ✅ new |
| `PhoneMobile` | ❌ | ✅ new |
| `Street` | ❌ | ✅ new |
| `Country` | ❌ | ✅ new |

#### Product (`Product` → `ServiceProduct`)

| Field | Old | New |
|---|---|---|
| `ProductName` | ✅ | ✅ |
| `SerialNumber` | ✅ | ✅ |
| `Manufacturer` | ✅ | ✅ |
| `ProductId` | ❌ | ✅ new |
| `ProductArticleNumber` | ❌ | ✅ new |
| `SecondSerialNumber` | ❌ | ✅ new |
| `EanCode` | ❌ | ✅ new |
| `Businessunit` | ❌ | ✅ new |

#### Insurance (`Insurance` → `ServiceInsurance`)

| Field | Old | New |
|---|---|---|
| `Name` | ✅ | ✅ |
| `InsuranceIsActivated` | ✅ bool | ✅ bool |
| `ContractNumber` | ✅ | ✅ |
| `Retention` | ✅ float | ✅ float |
| `SettlementAmount` | ✅ float | ✅ float |
| `ClaimNumber` | ❌ | ✅ new |
| `AuthorizationNumber` | ❌ | ✅ new |
| `ExpiryDate` | ❌ | ✅ new (datetime) |
| `StreetPrice` | ❌ | ✅ new float |
| `StreetPriceCurrency` | ❌ | ✅ new |
| `RetentionAccepted` | ❌ | ✅ new bool |
| `RetentionCurrency` | ❌ | ✅ new |
| `InsuranceNote` | ❌ | ✅ new |

#### Bookings

| Field | Old | New |
|---|---|---|
| `Status` | ✅ | ✅ |
| `StatusKey` | ❌ | ✅ new |
| `StatusReason` | ❌ | ✅ new |
| `Store` | ❌ | ✅ new |
| `BookedBy` | ❌ | ✅ new |
| `BookingDate` | ❌ | ✅ new |
| `Comment` | ❌ | ✅ new |

#### Positions (repair cost line items)

| Field | Old | New |
|---|---|---|
| `PriceGross` | ✅ **float** | ✅ **string** ⚠️ |
| `PriceNet` | ❌ | ✅ string |
| `PaymentType` | ❌ | ✅ |
| `DefectPart` | ❌ | ✅ |
| `MountedPart` | ❌ | ✅ |
| `Quantity` | ❌ | ✅ int |
| `Comment` | ❌ | ✅ |

> ⚠️ **`PriceGross` is now a string** — always parse to float before doing arithmetic.
> ```python
> float(pos.get("PriceGross") or 0)   # Python
> parseFloat(pos.PriceGross || "0")    // JavaScript
> decimal.Parse(pos.PriceGross ?? "0") // C#
> ```

#### New top-level fields on Servicecase

These didn't exist before:
- `DeliveryAddress` — object
- `BillingAddress` — object
- `Messages[]` — internal comments
- `Accessories[]`
- `PreviousServices[]`
- `References[]`
- `Attributes[]`
- `CurrentUser` — string
- `Pricelist` — string

#### Service (unchanged)
```json
{ "Servicetype": "...", "ServicetypeKey": "...", "Priority": "..." }
```

#### Store (unchanged)
```json
{ "Start": "...", "Current": "..." }
```

#### Symptoms (unchanged)
```json
{ "Comment": "...", "Symptom": [...] }
```

---

## Migration Checklist

For each project integrating with the Repairline API:

- [ ] Update base URL to `https://sunriseapi.repairline.de/`
- [ ] Change list endpoint from `GET /v2/cases` → `GET /CaseExport/GetCaseNumbersWithStatusOfOpenCases`
- [ ] Change detail endpoint from `GET /v2/cases/{id}` (int) → `GET /Cases/{caseNumber}` (string)
- [ ] Remove any code reading top-level `Status` field — use `Bookings[-1].Status` instead
- [ ] Fix `PriceGross` parsing — it's now a **string**, parse to float before arithmetic
- [ ] Update any type definitions / interfaces / models for the new fields

---

## Quick Reference — Minimal Fetch (any language)

```
# List open cases
GET https://sunriseapi.repairline.de/CaseExport/GetCaseNumbersWithStatusOfOpenCases
Authorization: Basic base64(username:password)

# Get case detail
GET https://sunriseapi.repairline.de/Cases/{caseNumber}
Authorization: Basic base64(username:password)
```

Response for case detail — fields you most likely care about:
```json
{
  "CaseId": 123,
  "CaseNumber": "SV-2024-001",
  "Warranty": "No",
  "Currency": "EUR",
  "Customer": {
    "FirstName": "Max",
    "LastName": "Mustermann",
    "Email": "max@example.com",
    "PhoneMain": "+49...",
    "City": "Berlin",
    "ZipCode": "10115"
  },
  "Product": {
    "ProductName": "iPhone 14",
    "Manufacturer": "Apple",
    "SerialNumber": "ABC123"
  },
  "Insurance": {
    "InsuranceIsActivated": true,
    "Name": "Wertgarantie",
    "ContractNumber": "WG-123456",
    "Retention": 50.00,
    "SettlementAmount": 250.00
  },
  "Symptoms": {
    "Comment": "Display broken"
  },
  "Store": {
    "Current": "Berlin Mitte"
  },
  "Service": {
    "Servicetype": "Repair"
  },
  "Bookings": [
    {
      "Status": "In Repair",
      "StatusKey": "in_repair",
      "BookingDate": "2024-03-01T10:00:00"
    }
  ],
  "Positions": [
    {
      "PriceGross": "299.00",
      "NameMountedPart": "Display assembly"
    }
  ]
}
```
