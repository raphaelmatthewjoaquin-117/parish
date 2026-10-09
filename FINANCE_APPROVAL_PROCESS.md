# Finance Approval Process - Complete Guide

## 🎯 Quick Answer

**Who can approve financial entries?**
- **ParishPriest** - Can approve submitted entries
- **Secretary** - Can approve submitted entries  
- **Bookkeeper** - Can approve submitted entries

**Who can reject financial entries?**
- **ParishPriest** - Can reject submitted entries
- **Secretary** - Can reject submitted entries

**Note**: The Bookkeeper can approve BUT cannot reject entries.

---

## 📊 Complete Finance Workflow with Roles

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    FINANCIAL ENTRY LIFECYCLE                            │
└─────────────────────────────────────────────────────────────────────────┘

                    BOOKKEEPER ONLY
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  1️⃣  CREATE DRAFT ENTRY                                            │
│      • Bookkeeper creates new financial entry                       │
│      • Status: "Draft"                                              │
│      • Can edit, delete, or submit                                  │
│                                                                     │
│      [Save Draft] button in Finance tab                             │
│                                                                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
                    BOOKKEEPER ONLY
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  2️⃣  SUBMIT FOR REVIEW                                             │
│      • Bookkeeper clicks "Submit" button                            │
│      • Status: "Draft" → "Submitted"                                │
│      • Entry is now LOCKED (cannot edit or delete)                  │
│      • Waiting for approval                                         │
│                                                                     │
│      API: POST /api/admin/operations/finance/:id/submit             │
│      Permission: requireRole(['Bookkeeper'])                        │
│                                                                     │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
                           ▼
              PRIEST, SECRETARY, OR BOOKKEEPER
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│  3️⃣  REVIEW & DECISION                                             │
│                                                                     │
│      Option A: APPROVE ✅                                           │
│      • ParishPriest clicks "Approve"                                │
│      • Secretary clicks "Approve"                                   │
│      • Bookkeeper clicks "Approve"                                  │
│      • Status: "Submitted" → "Approved"                             │
│      • Entry remains LOCKED                                         │
│      • Database records: ApprovedBy, ApprovedAt                     │
│                                                                     │
│      API: POST /api/admin/operations/finance/:id/approve            │
│      Permission: requireRole(['ParishPriest','Secretary','Bookkeeper'])│
│                                                                     │
│                  - OR -                                             │
│                                                                     │
│      Option B: REJECT ❌                                            │
│      • ParishPriest clicks "Reject"                                 │
│      • Secretary clicks "Reject"                                    │
│      • Status: "Submitted" → "Rejected"                             │
│      • Entry can now be edited again                                │
│                                                                     │
│      API: POST /api/admin/operations/finance/:id/reject             │
│      Permission: requireRole(['ParishPriest', 'Secretary'])         │
│      ⚠️  Bookkeeper CANNOT reject entries                            │
│                                                                     │
└──────────────┬───────────────────────────┬──────────────────────────┘
               │                           │
               │ If APPROVED              │ If REJECTED
               ▼                           ▼
    BOOKKEEPER ONLY              BOOKKEEPER FIXES ISSUES
┌──────────────────────┐     ┌────────────────────────────┐
│                      │     │                            │
│  4️⃣  RECONCILE      │     │  Fix & Resubmit            │
│                      │     │                            │
│  • Bookkeeper does   │     │  • Status: "Rejected"      │
│    final bookkeeping │     │  • Bookkeeper can edit     │
│  • Confirms entry    │     │  • Fix the issues          │
│    matches bank      │     │  • Submit again            │
│  • Status: "Approved"│     │  • Goes back to Step 2     │
│    → "Reconciled"    │     │                            │
│  • TERMINAL STATE    │     └────────────────────────────┘
│  • Cannot be changed │
│  • Fully immutable   │
│                      │
│  API: POST /api/admin/operations/finance/:id/reconcile  │
│  Permission: requireRole(['Bookkeeper'])                │
│                      │
└──────────────────────┘
```

---

## 👥 Role Permissions Breakdown

### **BOOKKEEPER Role**

| Action | Can Do? | API Endpoint |
|--------|---------|--------------|
| **Create** draft entry | ✅ Yes | `POST /api/admin/operations/finance` |
| **Edit** draft/rejected entry | ✅ Yes | `PUT /api/admin/operations/finance/:id` |
| **Delete** draft/rejected entry | ✅ Yes | `DELETE /api/admin/operations/finance/:id` |
| **Submit** draft for review | ✅ Yes | `POST /api/admin/operations/finance/:id/submit` |
| **Approve** submitted entry | ✅ Yes | `POST /api/admin/operations/finance/:id/approve` |
| **Reject** submitted entry | ❌ No | Cannot access |
| **Reconcile** approved entry | ✅ Yes | `POST /api/admin/operations/finance/:id/reconcile` |

**RBAC Permissions:**
```javascript
Bookkeeper: {
  Finance: ['view', 'create', 'edit', 'approve', 'manage']
}
```

---

### **PARISH PRIEST Role**

| Action | Can Do? | API Endpoint |
|--------|---------|--------------|
| **Create** draft entry | ❌ No | Bookkeeper only |
| **Edit** entry | ❌ No | Bookkeeper only |
| **Delete** entry | ❌ No | Bookkeeper only |
| **Submit** for review | ❌ No | Bookkeeper only |
| **Approve** submitted entry | ✅ Yes | `POST /api/admin/operations/finance/:id/approve` |
| **Reject** submitted entry | ✅ Yes | `POST /api/admin/operations/finance/:id/reject` |
| **Reconcile** approved entry | ❌ No | Bookkeeper only |

**RBAC Permissions:**
```javascript
ParishPriest: {
  Finance: ['view', 'approve']  // Can only view and approve/reject
}
```

---

### **SECRETARY Role**

| Action | Can Do? | API Endpoint |
|--------|---------|--------------|
| **Create** draft entry | ❌ No | Bookkeeper only |
| **Edit** entry | ❌ No | Bookkeeper only |
| **Delete** entry | ❌ No | Bookkeeper only |
| **Submit** for review | ❌ No | Bookkeeper only |
| **Approve** submitted entry | ✅ Yes | `POST /api/admin/operations/finance/:id/approve` |
| **Reject** submitted entry | ✅ Yes | `POST /api/admin/operations/finance/:id/reject` |
| **Reconcile** approved entry | ❌ No | Bookkeeper only |

**RBAC Permissions:**
```javascript
Secretary: {
  Finance: ['view', 'approve']  // Can only view and approve/reject
}
```

---

### **ADMIN Role**

| Action | Can Do? |
|--------|---------|
| **All operations** | ✅ Yes - Full access to everything |

**RBAC Permissions:**
```javascript
Admin: {
  Finance: ['view', 'create', 'edit', 'delete', 'approve', 'manage']
}
```

---

## 🔄 How Approval Happens (Step-by-Step)

### **Scenario 1: Normal Approval Flow**

1. **Monday 9:00 AM** - Bookkeeper Maria creates a finance entry
   - Entry: "Mass Offering - John Doe - $50"
   - Status: `Draft`
   - Maria clicks **"Save draft"**

2. **Monday 9:05 AM** - Maria reviews and submits
   - Maria clicks **"Submit"** button
   - Status: `Draft` → `Submitted`
   - Entry is now LOCKED (Maria cannot edit it)
   - Database records: `Status = 'Submitted'`

3. **Monday 2:00 PM** - Father John reviews entries
   - Father John (ParishPriest) logs into admin
   - Goes to Finance & Reports tab
   - Sees list of financial entries
   - Finds Maria's entry with status "Submitted"
   - Reviews the amount and description
   - Clicks **"Approve"** button
   - Status: `Submitted` → `Approved`
   - Database records: 
     ```sql
     ApprovedBy = 'Father John'
     ApprovedAt = '2026-09-30 14:00:00'
     Status = 'Approved'
     ```

4. **Monday 4:00 PM** - Maria reconciles
   - Maria sees the entry is now "Approved"
   - Maria checks it against bank statement
   - Clicks **"Reconcile"** button
   - Status: `Approved` → `Reconciled`
   - Database records:
     ```sql
     ReconciledBy = 'Maria'
     ReconciledAt = '2026-09-30 16:00:00'
     Status = 'Reconciled'
     ```
   - Entry is now **PERMANENT** - cannot be changed

---

### **Scenario 2: Rejection Flow**

1. **Tuesday 9:00 AM** - Bookkeeper creates entry with typo
   - Entry: "Stole Fee - Weeding Ceremony - $200"  ❌ (typo: "Weeding")
   - Status: `Draft`
   - Submits it → Status: `Submitted`

2. **Tuesday 10:00 AM** - Secretary notices error
   - Secretary Jane reviews the entry
   - Sees the typo "Weeding" instead of "Wedding"
   - Clicks **"Reject"** button
   - Status: `Submitted` → `Rejected`
   - Database records:
     ```sql
     Status = 'Rejected'
     ```

3. **Tuesday 10:30 AM** - Bookkeeper fixes and resubmits
   - Maria sees the entry is "Rejected"
   - Entry is now UNLOCKED - she can edit again
   - Maria clicks **"Edit"**
   - Fixes: "Weeding" → "Wedding"
   - Clicks **"Submit"** again
   - Status: `Rejected` → `Submitted`
   - Waits for approval again

4. **Tuesday 11:00 AM** - Secretary approves corrected entry
   - Jane reviews the corrected entry
   - Clicks **"Approve"**
   - Status: `Submitted` → `Approved`
   - Maria later reconciles it

---

## 🖥️ User Interface

### **In the Finance Tab - Entry List View**

Each financial entry shows different buttons based on its status:

```
┌──────────────────────────────────────────────────────────────┐
│ Financial Entries                                            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📄 Mass Offering - John Doe - $50.00                       │
│     Date: 2026-09-30  |  Status: Draft                       │
│     [Edit] [Delete] [Submit]  ← Bookkeeper sees these        │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📄 Stole Fee - Wedding - $200.00                            │
│     Date: 2026-09-29  |  Status: Submitted                   │
│     [Approve] [Reject]  ← Priest/Secretary sees these        │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📄 Donation - Parish Fund - $1,000.00                       │
│     Date: 2026-09-28  |  Status: Approved                    │
│     Approved by: Father John on 2026-09-29 10:30 AM          │
│     [Reconcile]  ← Bookkeeper sees this                      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  📄 Expense - Office Supplies - $75.00                       │
│     Date: 2026-09-27  |  Status: Reconciled  ✅              │
│     Approved by: Secretary Jane on 2026-09-27 2:00 PM        │
│     Reconciled by: Maria on 2026-09-27 4:00 PM               │
│     (No buttons - entry is locked forever)                   │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔒 Database Audit Trail

Every action is recorded in the `FinancialEntryAudit` table:

```sql
-- Example audit entries for one financial record

FinancialEntryId | ActionName  | ChangedBy       | ChangedAt           | Details
-----------------|-------------|-----------------|---------------------|------------------
42               | Create      | Maria           | 2026-09-30 09:00:00 | Initial draft
42               | Edit        | Maria           | 2026-09-30 09:03:00 | {"amount": "50.00"}
42               | Submitted   | Maria           | 2026-09-30 09:05:00 | Submitted
42               | Approved    | Father John     | 2026-09-30 14:00:00 | Approved
42               | Reconciled  | Maria           | 2026-09-30 16:00:00 | Reconciled
```

This creates a **complete, tamper-proof audit trail** showing:
- Who did what
- When they did it
- What was changed

---

## ⚠️ Important Rules

### **Why can Bookkeeper approve but not reject?**

This is by design for **separation of duties**:

1. **Bookkeeper can approve** - They understand the financial context and can fast-track routine entries when needed
2. **Bookkeeper cannot reject** - This ensures that at least ONE supervisory role (Priest or Secretary) must review and decide if something is wrong
3. **Priest/Secretary must reject** - This provides oversight and prevents a single person from controlling the entire finance workflow

### **State Transition Rules**

```javascript
// From server-rules.js line 75-85

const transitions = {
  Draft:      { submit: 'Submitted', edit: 'Draft', delete: 'Deleted' },
  Submitted:  { approve: 'Approved', reject: 'Rejected', edit: null, delete: null },
  Approved:   { reconcile: 'Reconciled', edit: null, delete: null },
  Rejected:   { edit: 'Draft', delete: 'Deleted', submit: 'Submitted' },
  Reconciled: { edit: null, delete: null, approve: null, reject: null }
}
```

**null = BLOCKED** - The system will return an error if you try an illegal transition.

---

## 📝 API Reference

### **Approve Entry**
```http
POST /api/admin/operations/finance/:id/approve
Authorization: x-admin-token: <token>
Roles: ParishPriest, Secretary, Bookkeeper

Response:
{
  "message": "Entry approved."
}
```

### **Reject Entry**
```http
POST /api/admin/operations/finance/:id/reject
Authorization: x-admin-token: <token>
Roles: ParishPriest, Secretary

Response:
{
  "message": "Entry rejected."
}
```

### **Submit Entry**
```http
POST /api/admin/operations/finance/:id/submit
Authorization: x-admin-token: <token>
Roles: Bookkeeper

Response:
{
  "message": "Entry submitted."
}
```

### **Reconcile Entry**
```http
POST /api/admin/operations/finance/:id/reconcile
Authorization: x-admin-token: <token>
Roles: Bookkeeper

Response:
{
  "message": "Entry reconciled."
}
```

---

## 🎓 Summary

**The approval process requires at least TWO people:**

1. **Bookkeeper** - Creates, submits, and reconciles entries
2. **Priest or Secretary** - Reviews and approves/rejects entries

This creates a **checks and balances system** where no single person can create and approve their own financial entries without oversight.

**The workflow is strictly enforced** by the backend to ensure compliance with financial audit standards and prevent fraud or errors.
