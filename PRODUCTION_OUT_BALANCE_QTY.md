# Production Out Module - Shared Balance Quantity Implementation

## Overview
Updated the Production Out Module 03 to track shared quantity pools across comma-separated QR codes in the Storse Out sheet. All QR codes in the same cell share the same total quantity, and the balance is calculated across ALL dispatches made with ANY QR code from that group.

## Problem Statement
In the Storse Out sheet, the "Numbers" column contains comma-separated QR codes (e.g., "5,6,7,8,9,10,11") that all share the same total quantity. When dispatching:
- If user dispatches 5 units using QR Code 6
- Then only 5 balance units remain for ALL QR codes in that group (5,7,8,9,10,11)
- The balance is SHARED across all QR codes in the same cell

## Key Concept: Shared Quantity Pool

**Example:**
```
Storse Out Sheet Row:
- Numbers: "5,6,7,8,9,10,11"
- Total QTY: 10

Scenario:
1. User scans QR Code 6, dispatches 5 units
   → Balance becomes 5 (shared across all QR codes)

2. User scans QR Code 8 (different QR, same cell)
   → Can only dispatch max 5 units (the remaining balance)
   → NOT 10 units, because QR Code 6 already used 5

3. If user dispatches 3 units with QR Code 8
   → Balance becomes 2 (shared across all remaining QR codes)

4. User scans QR Code 10
   → Can only dispatch max 2 units
```

## Visual Representation

```
┌─────────────────────────────────────────────────────────────┐
│ Storse Out Sheet - Single Row                               │
├─────────────────────────────────────────────────────────────┤
│ Numbers: "5, 6, 7, 8, 9, 10, 11"                           │
│ Total QTY: 10 pairs                                         │
│                                                             │
│ ┌─────────────────────────────────────────────────────┐   │
│ │  SHARED QUANTITY POOL = 10 pairs                    │   │
│ └─────────────────────────────────────────────────────┘   │
│      ↓         ↓         ↓         ↓         ↓            │
│    QR:5     QR:6      QR:7      QR:8      QR:9  ...       │
│   (can use any of these QR codes to dispatch)             │
└─────────────────────────────────────────────────────────────┘

Dispatch Timeline:
─────────────────────────────────────────────────────────────
① User dispatches 5 pairs using QR Code 6
   Pool: 10 - 5 = 5 remaining
   
② User dispatches 3 pairs using QR Code 8
   Pool: 5 - 3 = 2 remaining
   
③ User dispatches 2 pairs using QR Code 6 (reusing)
   Pool: 2 - 2 = 0 remaining
   
④ User tries QR Code 10
   ❌ Blocked: Pool exhausted, no balance remaining
```

## Implementation Details

### 1. **Enhanced QR Lookup Function** (`poLookupQR`)
When a QR code is scanned:
- Finds the Storse Out row containing this QR code
- Extracts ALL QR codes from the same cell (comma-separated in Numbers column)
- Fetches GFU Out sheet
- **Filters ALL previous dispatches made with ANY QR code from the same group**
- Calculates total dispatched quantity across the entire group
- Calculates balance: `Balance = Total Available - Sum of All Dispatches in Group`

```javascript
// Get all QR codes in the same cell
const qrCodesInSameCell = match.Numbers.split(',').map(n => n.trim());

// Find dispatches for ANY QR code in the same cell
const previousDispatches = gfuOutRows.filter(r => {
  if (!r || !r['QR Code']) return false;
  const dispatchedQR = String(r['QR Code']).trim();
  return qrCodesInSameCell.includes(dispatchedQR);
});

// Sum ALL dispatches from the group
const totalDispatchedQty = previousDispatches.reduce((sum, r) => {
  return sum + parseInt(r.QTY || 0);
}, 0);

const balanceQty = totalAvailableQty - totalDispatchedQty;
```

### 2. **Updated Item Details Display** (`buildPODetails`)
Now shows comprehensive quantity information:
- **Total QTY**: Original quantity from Storse Out sheet (shared pool)
- **Dispatched**: Total quantity already dispatched by ANY QR code in the group (red color)
- **Balance QTY**: Remaining quantity available to dispatch (green, bold, shared)
- **MRN Name**: Material Receipt Note name
- **Shared Quantity Notice**: Yellow info box showing all QR codes that share this quantity pool

### 3. **Fully Dispatched Check** (`buildPOFullyDispatched`)
If balance quantity is zero or negative:
- Displays "Fully Dispatched" message
- Shows all QR codes in the same group
- Shows dispatch summary (Total/Dispatched/Remaining)
- Prevents any further dispatch attempts with ANY QR code from the group
- Allows user to scan a different item

### 4. **Quantity Validation** (`poSubmitDispatch`)
Enhanced validation checks:
1. ✅ Valid number (≥ 1)
2. ✅ **Does not exceed shared balance quantity** (NEW)
3. ✅ User confirmation
4. ✅ Successful submission to sheets

```javascript
const balanceQty = parseInt(PO.matchedRow.BalanceQTY || PO.matchedRow.QTY || 0);

if (dispatchQty > balanceQty) {
  poToast(`Quantity cannot exceed balance QTY (${balanceQty}).`, 'error');
  qtyInput.focus();
  return;
}
```

### 5. **Duplicate QR Prevention Removed**
The previous duplicate prevention logic was removed because:
- Same QR code CAN be used multiple times (until group balance = 0)
- Different QR codes in the same group CAN be used interchangeably
- Balance calculation automatically prevents over-dispatching

## Data Flow

### Scenario 1: First Dispatch with QR Code 6
```
Storse Out Sheet:
- Numbers: "5,6,7,8,9,10,11"
- QTY: 10

User scans QR: 6
System shows:
- Total QTY: 10
- Dispatched: 0
- Balance QTY: 10
- Shared with: 5,6,7,8,9,10,11

User enters: 5
Result: Dispatched 5 using QR Code 6
→ Balance becomes 5 (shared across ALL QR codes)
```

### Scenario 2: Second Dispatch with Different QR Code 8
```
User scans QR: 8 (different QR, same group)
System checks GFU Out sheet:
- Previous dispatch with QR 6: 5 units

System shows:
- Total QTY: 10
- Dispatched: 5 (from QR Code 6)
- Balance QTY: 5 (shared)
- Shared with: 5,6,7,8,9,10,11

User enters: 3
Result: Dispatched 3 using QR Code 8
→ Balance becomes 2 (shared)
```

### Scenario 3: Third Dispatch with QR Code 6 Again
```
User scans QR: 6 (same as first, but allowed)
System checks GFU Out sheet:
- Previous dispatches: QR 6 (5) + QR 8 (3) = 8 total

System shows:
- Total QTY: 10
- Dispatched: 8
- Balance QTY: 2
- Shared with: 5,6,7,8,9,10,11

User enters: 2
Result: Dispatched 2 using QR Code 6 again
→ Balance becomes 0
```

### Scenario 4: Fourth Dispatch Attempt (Fully Dispatched)
```
User scans QR: 10 (or any QR from the group)
System checks GFU Out sheet:
- Total dispatched: 5 + 3 + 2 = 10

System shows:
❌ "Fully Dispatched" message
❌ Shows all QR codes in group: 5,6,7,8,9,10,11
❌ Cannot dispatch anymore with ANY QR from this group
✅ Can scan different item from different group
```

## Sheet Structure

### Storse Out Sheet
| Column | Field | Description |
|--------|-------|-------------|
| A | QR_Code | Unique identifier for the row |
| B | PO | Purchase Order number |
| C | Model | Shoe model |
| D | Outsole_Colour | Color of outsole |
| E | Size | Shoe size |
| F | QTY | Total available quantity |
| J | MRN_Name | Material Receipt Note name |
| O | Numbers | Comma-separated QR codes (e.g., "5,6,7,8,9") |

### GFU Out Sheet
| Column | Field | Description |
|--------|-------|-------------|
| A | QR Code | Individual QR code from scan |
| B | PO | Purchase Order number |
| C | Model | Shoe model |
| D | Outsole Colour | Color of outsole |
| E | Size | Shoe size |
| F | QTY | Dispatched quantity |
| G | Date | Dispatch date |
| H | Time | Dispatch time |
| I | MRN_Name | Material Receipt Note name |

## Key Features

✅ **Shared Quantity Pool**: All QR codes in the same cell share one total quantity  
✅ **Cross-QR Balance Tracking**: Tracks dispatches across ALL QR codes in the group  
✅ **Multiple QR Usage**: Can use any QR code from the group until balance is exhausted  
✅ **Visual Indicators**: Color-coded display (red for dispatched, green for balance)  
✅ **Shared Quantity Notice**: Yellow info box showing all QR codes sharing the pool  
✅ **Over-Dispatch Prevention**: Validates quantity doesn't exceed shared balance  
✅ **Fully Dispatched Detection**: Prevents dispatch when group balance is zero  
✅ **MRN Name Integration**: Includes MRN_Name in all displays and GFU Out sheet  
✅ **Real-time Calculation**: Fetches latest data on every scan  

## User Experience

### Success Flow
1. User scans any QR code from a group (e.g., QR Code 8)
2. System shows item details with shared balance information
3. System displays yellow notice about other QR codes in the group
4. User enters quantity (≤ shared balance)
5. User confirms dispatch
6. System saves to GFU Out sheet with the scanned QR code
7. Success message displayed
8. User can scan ANY other QR from the same or different group

### Error Flows

**Over Quantity**
- Error: "Quantity cannot exceed balance QTY (X)."
- Input field is refocused
- User can correct the quantity

**Fully Dispatched Group**
- Warning: "Fully Dispatched" with group details
- Shows all QR codes in the group
- Button: "Scan Another"
- Cannot proceed with ANY QR code from this group

## Testing Scenarios

1. ✅ First dispatch with QR Code 6 from group
2. ✅ Second dispatch with different QR Code 8 from same group
3. ✅ Third dispatch with QR Code 6 again (reusing same QR)
4. ✅ Dispatch exact balance quantity with any QR from group
5. ✅ Attempt to dispatch more than shared balance
6. ✅ Attempt to dispatch when group balance is zero
7. ✅ Different QR codes from different groups (independent balances)
8. ✅ MRN_Name is saved correctly
9. ✅ Visual display shows shared quantity notice

## Files Modified

- `assets/js/production-out.js` - Main implementation file

## Dependencies

- SheetBest API (CONFIG.SHEETBEST_STORESOUT_URL)
- SheetBest API (CONFIG.SHEETBEST_GFUOUT_URL)
- Html5Qrcode library (QR scanner)

## Notes

- **Balance quantity is shared across ALL QR codes in the same cell**
- Balance quantity is calculated in real-time on each lookup
- Supports concurrent dispatches (fetches latest data each time)
- All QR codes in the same "Numbers" cell share the same total quantity pool
- Each QR code can be used multiple times until the shared pool is exhausted
- Different QR code groups have independent quantity pools
- Example: If Numbers = "5,6,7,8,9", all these QR codes share one quantity
- When any QR from the group is used, it reduces the shared balance for ALL QRs in that group
