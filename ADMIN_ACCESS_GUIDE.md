# Admin Page Access Control & Features Guide

## 1. Module Permission System Explained

### **"Requires MassSchedule module permission"**

This means the user must have at least **'view'** permission for the **MassSchedule** module.

#### **Who Can Access MassSchedule Tabs:**

| Role | Permissions | Can Access? |
|------|-------------|-------------|
| **Admin** | view, create, edit, delete, approve, manage | ✅ **Full Access** |
| **ParishPriest** | view, create, edit, delete, approve, manage | ✅ **Full Access** |
| **Secretary** | view, create, edit, delete, approve, manage | ✅ **Full Access** |
| **Bookkeeper** | view only | ✅ **View Only** |
| **Staff** | view, edit | ✅ **Limited Access** (cannot create or delete) |

#### **Tabs that require MassSchedule permission:**
- **Schedule** - Service schedule management
- **Mass Schedule** - Mass times and locations
- **Mass Intentions** - Mass intention booking

---

### **"Requires ServiceRequest module permission"**

This means the user must have at least **'view'** permission for the **ServiceRequest** module.

#### **Who Can Access ServiceRequest Tabs:**

| Role | Permissions | Can Access? |
|------|-------------|-------------|
| **Admin** | view, create, edit, delete, approve, manage | ✅ **Full Access** |
| **ParishPriest** | view, create, edit, delete, approve, manage | ✅ **Full Access** |
| **Secretary** | view, create, edit, delete, approve, manage | ✅ **Full Access** |
| **Bookkeeper** | *(no permissions)* | ❌ **No Access** |
| **Staff** | view, create, edit, delete, approve, manage | ✅ **Manage service requests** |

#### **Tabs that require ServiceRequest permission:**
- **Applications** - Detailed service request management
- **Service Requests** - View and process booking requests
- **Certificate Appointments** - Certificate issuance requests
- **Booking Form Fields** - Customize booking forms (Admin, ParishPriest, and Secretary only)

### Other role-specific access

| Role | Prayer requests | Financial data | Staff roles and accounts |
|------|-----------------|----------------|--------------------------|
| **Admin** | Full access | Full access | Full user management, all role assignments, audit review |
| **ParishPriest** | View, approve, and delete | View and manage entries; approve or reject submissions | Assign/revoke operational roles only; cannot assign Admin |
| **Secretary** | View, approve, and delete | View and manage entries; approve or reject submissions | Assign/revoke operational roles only; cannot assign Admin |
| **Bookkeeper** | No access | Manage entries, reports, submit and reconcile; cannot approve | No access |
| **Staff** | View only | Aggregate financial summaries only | No access |

Only Admin users can create or delete staff accounts, change email addresses or passwords, assign the Admin role, or review user-management audit history.

---

## 2. Finance Workflow Error Explained

### **Error: "Cannot move a 'Draft' entry to 'Submitted'. Follow the Draft, Submitted, Approved, Reconciled workflow."**

This error appears when someone tries to **skip steps** in the financial entry approval process.

### **The Financial Entry State Machine:**

```
┌─────────┐   submit   ┌───────────┐   approve   ┌──────────┐   reconcile   ┌────────────┐
│  Draft  │ ─────────> │ Submitted │ ──────────> │ Approved │ ────────────> │ Reconciled │
└─────────┘            └───────────┘             └──────────┘               └────────────┘
    │                         │                        │                          │
    │ edit/delete             │ reject                 │                          │
    │ allowed                 ▼                        │                          │
    │                    ┌──────────┐                  │                          │
    └────────────────────│ Rejected │                  │                          │
                         └──────────┘                  │                          │
                              │                        └──> NO EDITS ALLOWED      │
                              │ edit                                              │
                              └─> back to Draft                                   │
                                                                                   │
                                                                         TERMINAL STATE
                                                                         (Cannot change)
```

### **Allowed Transitions:**

| Current Status | Action | Next Status | Notes |
|---------------|--------|-------------|-------|
| **Draft** | `submit` | Submitted | Initial submission for review |
| **Draft** | `edit` | Draft | Can edit freely |
| **Draft** | `delete` | Deleted | Can delete drafts |
| **Submitted** | `approve` | Approved | Manager/priest approval |
| **Submitted** | `reject` | Rejected | Sent back for corrections |
| **Submitted** | ~~edit~~ | ❌ NULL | **BLOCKED** - Cannot edit submitted entries |
| **Submitted** | ~~delete~~ | ❌ NULL | **BLOCKED** - Cannot delete submitted entries |
| **Approved** | `reconcile` | Reconciled | Final bookkeeping confirmation |
| **Approved** | ~~edit~~ | ❌ NULL | **BLOCKED** - Cannot edit approved entries |
| **Approved** | ~~delete~~ | ❌ NULL | **BLOCKED** - Cannot delete approved entries |
| **Rejected** | `edit` | Draft | Fix issues and return to draft |
| **Rejected** | `delete` | Deleted | Can delete rejected entries |
| **Rejected** | `submit` | Submitted | Resubmit after corrections |
| **Reconciled** | ~~any~~ | ❌ NULL | **BLOCKED** - Terminal state, fully locked |

### **Why This Error Happens:**

The system prevents:
1. **Skipping approval** - You cannot go directly from Draft to Approved
2. **Editing locked records** - Once submitted, only approve/reject actions are allowed
3. **Deleting submitted work** - Prevents accidental data loss
4. **Changing reconciled entries** - Final records are immutable for audit compliance

### **How to Fix:**

If you get this error, follow the proper workflow:

```javascript
// WRONG ❌
Draft → Approved (BLOCKED!)

// CORRECT ✅
Draft → Submit → Wait for Approval → Approved → Reconcile

// If rejected:
Draft → Submit → Rejected → Edit (back to Draft) → Submit again
```

### **Code Implementation:**

The workflow is enforced in `server-rules.js`:

```javascript
export function financeTransition(currentStatus, action) {
  const transitions = {
    Draft: { submit: 'Submitted', edit: 'Draft', delete: 'Deleted' },
    Submitted: { approve: 'Approved', reject: 'Rejected', edit: null, delete: null },
    Approved: { reconcile: 'Reconciled', edit: null, delete: null },
    Rejected: { edit: 'Draft', delete: 'Deleted', submit: 'Submitted' },
    Reconciled: { edit: null, delete: null, approve: null, reject: null },
  };
  return transitions[currentStatus]?.[action] ?? null;
}
```

When the function returns `null`, the action is **blocked** and you get the error.

---

## 3. Stats & Demographics Data Sources

### **Where the Data Comes From:**

The **Stats & Demographics** report pulls data from **four main sacramental record tables** in your SQL Server database:

#### **Database Tables Used:**

1. **`dbo.BaptismRecords`** - All baptism records
2. **`dbo.ConfirmationRecords`** - All confirmation records  
3. **`dbo.MarriageRecords`** - All marriage records
4. **`dbo.DeathRecords`** - All death/funeral records

### **How Data is Gathered:**

When you click "Generate Report" for a specific year, the system runs **three parallel SQL queries**:

---

#### **Query 1: Summary Totals**

```sql
SELECT 
  (SELECT COUNT(*) FROM dbo.BaptismRecords WHERE YEAR(DateOfBaptism) = @year) AS totalBaptisms,
  (SELECT COUNT(*) FROM dbo.ConfirmationRecords WHERE YEAR(DateOfConfirmation) = @year) AS totalConfirmations,
  (SELECT COUNT(*) FROM dbo.MarriageRecords WHERE YEAR(DateOfMarriage) = @year) AS totalMarriages,
  (SELECT COUNT(*) FROM dbo.DeathRecords WHERE YEAR(DateOfDeath) = @year) AS totalDeaths
```

**This produces:** The four summary cards at the top showing total counts for the year.

---

#### **Query 2: Monthly Breakdown**

```sql
SELECT 
  m.month,
  DATENAME(month, DATEFROMPARTS(@year, m.month, 1)) AS monthName,
  (SELECT COUNT(*) FROM dbo.BaptismRecords 
   WHERE YEAR(DateOfBaptism) = @year AND MONTH(DateOfBaptism) = m.month) AS baptisms,
  (SELECT COUNT(*) FROM dbo.ConfirmationRecords 
   WHERE YEAR(DateOfConfirmation) = @year AND MONTH(DateOfConfirmation) = m.month) AS confirmations,
  (SELECT COUNT(*) FROM dbo.MarriageRecords 
   WHERE YEAR(DateOfMarriage) = @year AND MONTH(DateOfMarriage) = m.month) AS marriages,
  (SELECT COUNT(*) FROM dbo.DeathRecords 
   WHERE YEAR(DateOfDeath) = @year AND MONTH(DateOfDeath) = m.month) AS deaths
FROM (VALUES (1),(2),(3),(4),(5),(6),(7),(8),(9),(10),(11),(12)) m(month)
ORDER BY m.month
```

**This produces:** The "Monthly Sacramental Trend" table showing month-by-month counts.

---

#### **Query 3: Demographics Analysis**

```sql
SELECT 
  -- Baptism Demographics
  (SELECT COUNT(*) FROM dbo.BaptismRecords 
   WHERE YEAR(DateOfBaptism) = @year 
   AND DATEDIFF(year, DateOfBirth, DateOfBaptism) = 0) AS InfantsUnder1Yr,
   
  (SELECT COUNT(*) FROM dbo.BaptismRecords 
   WHERE YEAR(DateOfBaptism) = @year 
   AND DATEDIFF(year, DateOfBirth, DateOfBaptism) > 0) AS ChildrenOver1Yr,
  
  -- Marriage Demographics - Averages
  (SELECT AVG(CAST(GroomAge AS decimal(10,2))) 
   FROM dbo.MarriageRecords WHERE YEAR(DateOfMarriage) = @year) AS AvgGroomAge,
   
  (SELECT AVG(CAST(BrideAge AS decimal(10,2))) 
   FROM dbo.MarriageRecords WHERE YEAR(DateOfMarriage) = @year) AS AvgBrideAge,
  
  -- Marriage Demographics - Age Groups
  (SELECT COUNT(*) FROM dbo.MarriageRecords 
   WHERE YEAR(DateOfMarriage) = @year 
   AND GroomAge < 25 AND BrideAge < 25) AS Under25,
   
  (SELECT COUNT(*) FROM dbo.MarriageRecords 
   WHERE YEAR(DateOfMarriage) = @year 
   AND ((GroomAge BETWEEN 25 AND 35) OR (BrideAge BETWEEN 25 AND 35))) AS Age25To35,
   
  (SELECT COUNT(*) FROM dbo.MarriageRecords 
   WHERE YEAR(DateOfMarriage) = @year 
   AND (GroomAge > 35 OR BrideAge > 35)) AS Over35,
  
  -- Death Demographics - Average Age
  (SELECT AVG(CAST(Age AS decimal(10,2))) 
   FROM dbo.DeathRecords WHERE YEAR(DateOfDeath) = @year) AS AvgDeceasedAge,
  
  -- Death Demographics - Age Groups
  (SELECT COUNT(*) FROM dbo.DeathRecords 
   WHERE YEAR(DateOfDeath) = @year AND Age < 18) AS Under18,
   
  (SELECT COUNT(*) FROM dbo.DeathRecords 
   WHERE YEAR(DateOfDeath) = @year AND Age BETWEEN 18 AND 59) AS Age18To59,
   
  (SELECT COUNT(*) FROM dbo.DeathRecords 
   WHERE YEAR(DateOfDeath) = @year AND Age >= 60) AS Senior60Plus
```

**This produces:** 
- Infant vs. children baptism breakdown
- Average marriage ages (groom and bride)
- Marriage age distribution (Under 25, 25-35, Over 35)
- Average deceased age
- Death age distribution (Under 18, 18-59, 60+)

---

### **Data Flow Diagram:**

```
┌──────────────────────────────────────────────────────────────┐
│  Admin clicks "Generate Report" for Year 2026                │
└───────────────────────────┬──────────────────────────────────┘
                            │
                            ▼
        ┌───────────────────────────────────────┐
        │  Frontend: AdminOperationsPage.tsx    │
        │  loadStats(2026)                      │
        └──────────────┬────────────────────────┘
                       │
                       ▼
        ┌────────────────────────────────────────┐
        │  API Call: GET /api/admin/operations/  │
        │            statistics?year=2026         │
        └──────────────┬─────────────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────────────┐
        │  Backend: server.js                     │
        │  Route Handler (line 1889-1902)         │
        └──────────────┬──────────────────────────┘
                       │
                       ├──> Query 1: Summary Totals
                       │    (BaptismRecords, ConfirmationRecords,
                       │     MarriageRecords, DeathRecords)
                       │
                       ├──> Query 2: Monthly Breakdown
                       │    (Counts per month for each sacrament)
                       │
                       └──> Query 3: Demographics
                            (Age distributions, averages)
                       
                       │
                       ▼
        ┌─────────────────────────────────────────┐
        │  SQL Server Database                    │
        │  Tables:                                │
        │  • dbo.BaptismRecords                   │
        │  • dbo.ConfirmationRecords              │
        │  • dbo.MarriageRecords                  │
        │  • dbo.DeathRecords                     │
        └──────────────┬──────────────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────────────┐
        │  Response JSON sent to frontend         │
        │  {                                      │
        │    targetYear: 2026,                    │
        │    summary: { totalBaptisms, ... },     │
        │    monthlyBreakdown: [...],             │
        │    demographics: {                      │
        │      baptisms: {...},                   │
        │      marriages: {...},                  │
        │      deaths: {...}                      │
        │    }                                    │
        │  }                                      │
        └──────────────┬──────────────────────────┘
                       │
                       ▼
        ┌─────────────────────────────────────────┐
        │  Frontend renders:                      │
        │  • Summary cards                        │
        │  • Monthly trend table                  │
        │  • Demographic bar charts               │
        └─────────────────────────────────────────┘
```

---

### **Key Database Fields Used:**

#### **BaptismRecords Table:**
- `DateOfBaptism` - When the baptism occurred
- `DateOfBirth` - Child's birth date (used to calculate infant vs. child)

#### **ConfirmationRecords Table:**
- `DateOfConfirmation` - When the confirmation occurred

#### **MarriageRecords Table:**
- `DateOfMarriage` - Wedding date
- `GroomAge` - Groom's age at marriage
- `BrideAge` - Bride's age at marriage

#### **DeathRecords Table:**
- `DateOfDeath` - Date of death/funeral
- `Age` - Deceased person's age

---

### **Data Entry Points:**

The data in these tables comes from:

1. **Sacramental Ledger Tab** - ParishPriest, Secretary, and Admin users enter or update records; Staff can view records only
2. **Service Requests** - When confirmed bookings are completed, they may create records
3. **Direct database imports** - Historical records can be imported from old systems
4. **Sacramental Record Forms** - Digital forms for entering baptism, confirmation, marriage, death details

---

### **Report Access Control:**

The statistics report requires:
- **Module:** `SacramentalRecords`
- **Permission:** `view`
- **Allowed Roles:** Admin, ParishPriest, Secretary

**Bookkeeper and Staff cannot access** this report as they lack the required permissions.

---

## Summary

1. **MassSchedule permission** = Access to Mass times, schedules, and intentions (most staff roles have this)
2. **ServiceRequest permission** = Access to booking requests, applications, certificates (Bookkeeper is excluded)
3. **Finance workflow** = Strict Draft → Submit → Approve → Reconcile process to maintain audit compliance
4. **Stats data** = Real-time queries from sacramental record tables (baptisms, confirmations, marriages, deaths)

All permissions are defined in `/src/utils/rbac.ts` and enforced on both frontend and backend.
