# Production Out - GFU Out Sheet Integration

## Overview

The Production Out module now saves dispatch records to **two sheets**:
1. **Stores Out** - Updates existing row with dispatch information
2. **GFU Out** - Creates new row with dispatch details

---

## Data Flow

### When User Dispatches an Item

```
User scans QR: "8"
Item found: PO 147248, Sprinter, Lime, Size 45
User enters: 50 units
User clicks: Submit
```

**System performs TWO operations:**

### 1. Update Stores Out Sheet (PATCH)
Updates the existing row where QR_Code matches

| Column | Field Name | Value |
|--------|------------|-------|
| P | Production Out | "Dispatched" |
| Q | Dispatched Qty | 50 |
| R | Dispatched User | "Chamika" |
| S | Dispatched Date | "21/08/2026" |
| T | Dispatched Time | "14:32:15" |

**API Call:**
```
PATCH {SHEETBEST_STORESOUT_URL}/QR_Code/147248
```

### 2. Add to GFU Out Sheet (POST)
Creates a new row with dispatch information

| Column | Field Name | Value | Description |
|--------|------------|-------|-------------|
| A | QR Code | "8" | Scanned QR number |
| B | PO | "147248" | Purchase Order |
| C | Model | "Sprinter" | Shoe model |
| D | Outsole Colour | "Lime" | Outsole color |
| E | Size | 45 | EU size |
| F | QTY | 50 | Dispatched quantity |
| G | Date | "21/08/2026" | Dispatch date |
| H | Time | "14:32:15" | Dispatch time |

**API Call:**
```
POST {SHEETBEST_GFUOUT_URL}
```

---

## Implementation Details

### Configuration Update

**File:** `assets/js/config.js`

Added new configuration:
```javascript
SHEETBEST_GFUOUT_URL: 'https://api.sheetbest.com/sheets/.../tabs/GFU Out'
```

### Code Changes

**File:** `assets/js/production-out.js`

**Function:** `poSubmitDispatch()`

#### Previous Logic (1 operation)
```javascript
// Update Stores Out only
PATCH /Storse Out/QR_Code/{qrCode}
```

#### New Logic (2 operations)
```javascript
try {
  // 1. Update Stores Out
  PATCH /Storse Out/QR_Code/{qrCode}
  
  // 2. Add to GFU Out
  POST /GFU Out
  
  // Success
} catch {
  // Error handling
}
```

---

## Payload Details

### Stores Out PATCH Payload
```javascript
{
  "Production Out": "Dispatched",
  "Dispatched Qty": 50,
  "Dispatched User": "Chamika",
  "Dispatched Date": "21/08/2026",
  "Dispatched Time": "14:32:15"
}
```

### GFU Out POST Payload
```javascript
{
  "QR Code": "8",
  "PO": "147248",
  "Model": "Sprinter",
  "Outsole Colour": "Lime",
  "Size": 45,
  "QTY": 50,
  "Date": "21/08/2026",
  "Time": "14:32:15"
}
```

---

## GFU Out Sheet Structure

### Column Mapping

| Col | Header | Data Type | Source | Example |
|-----|--------|-----------|--------|---------|
| A | QR Code | Text | Scanned QR number (PO.qrResult) | "8" |
| B | PO | Text | From Stores Out row | "147248" |
| C | Model | Text | From Stores Out row | "Sprinter" |
| D | Outsole Colour | Text | From Stores Out row | "Lime" |
| E | Size | Number | From Stores Out row | 45 |
| F | QTY | Number | User input | 50 |
| G | Date | Date String | Current date (DD/MM/YYYY) | "21/08/2026" |
| H | Time | Time String | Current time (HH:MM:SS) | "14:32:15" |

### Sheet Requirements
- **Name**: "GFU Out" (exact match, space included)
- **Headers**: Row 1 must contain exact column names
- **Format**: Case-sensitive headers
- **Append**: New rows are appended (POST operation)

---

## Data Flow Diagram

```
┌─────────────────────────────────────────────────────────────┐
│ USER DISPATCHES                                              │
│ • Scans QR: "8"                                             │
│ • Enters QTY: 50                                            │
│ • Clicks Submit                                             │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ SYSTEM VALIDATES                                             │
│ • QR found in Column O ✅                                    │
│ • Item verified ✅                                           │
│ • Quantity ≥ 1 ✅                                           │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ OPERATION 1: UPDATE STORES OUT                               │
│ PATCH /Storse Out/QR_Code/147248                            │
│ • Production Out: "Dispatched"                              │
│ • Dispatched Qty: 50                                        │
│ • Dispatched User: "Chamika"                                │
│ • Dispatched Date: "21/08/2026"                             │
│ • Dispatched Time: "14:32:15"                               │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ OPERATION 2: ADD TO GFU OUT                                  │
│ POST /GFU Out                                               │
│ • QR Code: "8"                                              │
│ • PO: "147248"                                              │
│ • Model: "Sprinter"                                         │
│ • Outsole Colour: "Lime"                                    │
│ • Size: 45                                                  │
│ • QTY: 50                                                   │
│ • Date: "21/08/2026"                                        │
│ • Time: "14:32:15"                                          │
└────────────────┬────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│ SUCCESS                                                      │
│ ✅ Both sheets updated                                      │
│ ✅ Success message shown                                    │
│ ✅ User can scan next item                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## Error Handling

### Scenario 1: Stores Out Update Fails
```javascript
try {
  // PATCH Stores Out
  if (!patchRes.ok) {
    throw new Error('Stores Out update failed');
  }
  // Never reaches GFU Out POST
} catch (err) {
  // Show error to user
  // Neither sheet is updated
}
```

**Result:** Nothing is saved. User can retry.

### Scenario 2: Stores Out Success, GFU Out Fails
```javascript
try {
  // PATCH Stores Out ✅ Success
  
  // POST GFU Out
  if (!postRes.ok) {
    throw new Error('GFU Out save failed');
  }
} catch (err) {
  // Show error to user
  // Stores Out IS updated ⚠️
  // GFU Out is NOT updated ⚠️
}
```

**Result:** Partial save. Stores Out updated but GFU Out missing the record.

### Scenario 3: Both Succeed
```javascript
try {
  // PATCH Stores Out ✅ Success
  // POST GFU Out ✅ Success
  
  poShowSuccess(dispatchQty);
} catch {
  // Not reached
}
```

**Result:** Complete success. Both sheets updated.

---

## Transaction Behavior

### Important Notes

⚠️ **Not Atomic**: The two operations are NOT a single transaction.

**What this means:**
1. If Stores Out succeeds but GFU Out fails, Stores Out keeps the changes
2. No automatic rollback
3. Partial state is possible

**Recommended Handling:**
- Monitor error logs for GFU Out failures
- Manually reconcile if needed
- Consider retry mechanism in future

### Sequential Execution
```
Step 1: PATCH Stores Out
  ↓ Success
Step 2: POST GFU Out
  ↓ Success or Failure
Final: Show result to user
```

**Execution Order:** Always Stores Out first, then GFU Out

---

## Data Examples

### Example 1: Single Dispatch

**User Action:**
- Scans: "8"
- Quantity: 50

**Stores Out Row (Updated):**
```
QR_Code: 147248
Numbers: 6,7,8,9,10,11,12,13
Production Out: Dispatched ← UPDATED
Dispatched Qty: 50 ← UPDATED
Dispatched User: Chamika ← UPDATED
Dispatched Date: 21/08/2026 ← UPDATED
Dispatched Time: 14:32:15 ← UPDATED
```

**GFU Out New Row (Appended):**
```
Row 2:
A: 8
B: 147248
C: Sprinter
D: Lime
E: 45
F: 50
G: 21/08/2026
H: 14:32:15
```

### Example 2: Multiple Dispatches Same QR

**User dispatches QR "8" three times:**

**Dispatch 1:** 50 units at 14:32:15  
**Dispatch 2:** 30 units at 14:45:20  
**Dispatch 3:** 20 units at 15:10:05  

**Stores Out Row:**
```
Production Out: Dispatched
Dispatched Qty: 20 ← Last dispatch
Dispatched User: Chamika
Dispatched Date: 21/08/2026
Dispatched Time: 15:10:05 ← Last dispatch time
```
*Note: Stores Out only shows the LAST dispatch*

**GFU Out Sheet:**
```
Row 2: 8 | 147248 | Sprinter | Lime | 45 | 50 | 21/08/2026 | 14:32:15
Row 3: 8 | 147248 | Sprinter | Lime | 45 | 30 | 21/08/2026 | 14:45:20
Row 4: 8 | 147248 | Sprinter | Lime | 45 | 20 | 21/08/2026 | 15:10:05
```
*Note: GFU Out has ALL dispatches as separate rows*

---

## Benefits of Dual Sheet Approach

### 1. Stores Out (Master Record)
- ✅ Shows latest dispatch status
- ✅ Links to Production In verification
- ✅ Maintains item lifecycle
- ✅ Single row per QR_Code

### 2. GFU Out (Transaction Log)
- ✅ Complete dispatch history
- ✅ One row per dispatch event
- ✅ Detailed quantity tracking
- ✅ Audit trail for all dispatches
- ✅ Easy to sum totals
- ✅ Can track multiple dispatches per QR

### 3. Combined Value
- **Stores Out**: "What's the current status?"
- **GFU Out**: "What dispatches have occurred?"
- Together: Complete picture of item movement

---

## Reporting & Analytics

### GFU Out Sheet Capabilities

**Sum Total Dispatches:**
```
=SUM(F:F)
```

**Count Dispatches Today:**
```
=COUNTIF(G:G, "21/08/2026")
```

**Dispatches by Model:**
```
=SUMIF(C:C, "Sprinter", F:F)
```

**Dispatches by QR:**
```
=SUMIF(A:A, "8", F:F)
```

**Average Dispatch Quantity:**
```
=AVERAGE(F:F)
```

---

## Testing Checklist

### Basic Functionality
- [ ] Single dispatch updates both sheets
- [ ] QR Code saved to GFU Out Column A
- [ ] PO saved to GFU Out Column B
- [ ] Model saved to GFU Out Column C
- [ ] Colour saved to GFU Out Column D
- [ ] Size saved to GFU Out Column E
- [ ] QTY saved to GFU Out Column F
- [ ] Date saved to GFU Out Column G
- [ ] Time saved to GFU Out Column H

### Multiple Dispatches
- [ ] Same QR can be dispatched multiple times
- [ ] Each creates new row in GFU Out
- [ ] Stores Out shows last dispatch only
- [ ] All GFU Out rows preserved

### Error Handling
- [ ] Network error shows message
- [ ] Stores Out failure prevents GFU Out
- [ ] GFU Out failure shows error
- [ ] User can retry after error

### Data Integrity
- [ ] No duplicate prevention (allowed)
- [ ] Data matches between sheets
- [ ] Date format consistent (DD/MM/YYYY)
- [ ] Time format consistent (HH:MM:SS)

---

## Sheet Setup Requirements

### GFU Out Sheet Must Have:

1. **Tab Name:** Exactly "GFU Out" (with space)
2. **Headers in Row 1:**
   - A1: "QR Code"
   - B1: "PO"
   - C1: "Model"
   - D1: "Outsole Colour"
   - E1: "Size"
   - F1: "QTY"
   - G1: "Date"
   - H1: "Time"

3. **Case Sensitivity:** Headers must match exactly
4. **No Extra Columns:** Columns A-H only (others ignored)
5. **Permissions:** SheetBest must have write access

---

## Troubleshooting

### Issue: "GFU Out save failed"

**Possible Causes:**
1. Sheet name is wrong (check spelling, spaces)
2. Headers don't match exactly
3. SheetBest URL is incorrect
4. API rate limit reached
5. Network error

**Solution:**
1. Verify sheet name is "GFU Out"
2. Check headers match exactly (case-sensitive)
3. Verify CONFIG.SHEETBEST_GFUOUT_URL
4. Wait and retry
5. Check internet connection

### Issue: Data in wrong columns

**Cause:** Header names don't match payload fields

**Solution:** Ensure headers match exactly:
- "QR Code" (not "QRCode" or "QR_Code")
- "Outsole Colour" (not "Outsole Color")
- etc.

### Issue: Stores Out updated but GFU Out empty

**Cause:** GFU Out POST failed after Stores Out success

**Solution:** 
1. Check GFU Out sheet manually
2. Verify error in browser console
3. Retry dispatch if needed
4. Monitor logs for patterns

---

## API Endpoints

### Stores Out (Update)
```
URL: {SHEETBEST_URL}/tabs/Storse Out/QR_Code/{qrCode}
Method: PATCH
Purpose: Update existing row with dispatch info
```

### GFU Out (Append)
```
URL: {SHEETBEST_URL}/tabs/GFU Out
Method: POST
Purpose: Add new row with dispatch details
```

---

## Future Enhancements

Potential improvements:
1. **Transaction Rollback**: If GFU Out fails, rollback Stores Out
2. **Batch Dispatch**: Dispatch multiple QRs at once
3. **Retry Logic**: Automatic retry on GFU Out failure
4. **Queue System**: Queue GFU Out writes for reliability
5. **Sync Validation**: Verify both sheets after save
6. **Offline Support**: Queue dispatches when offline
7. **Export**: Download GFU Out data as CSV/Excel

---

## Summary

The Production Out module now maintains **two independent records**:

✅ **Stores Out**: Current status of each QR_Code  
✅ **GFU Out**: Historical log of all dispatch events  

**Data Saved to GFU Out:**
- Column A: QR Code (scanned number)
- Column B: PO
- Column C: Model
- Column D: Outsole Colour
- Column E: Size
- Column F: QTY (dispatch quantity)
- Column G: Date (DD/MM/YYYY)
- Column H: Time (HH:MM:SS)

**Files Modified:**
- `assets/js/config.js` - Added SHEETBEST_GFUOUT_URL
- `assets/js/production-out.js` - Added GFU Out POST operation

**Status:** ✅ Ready for Testing
