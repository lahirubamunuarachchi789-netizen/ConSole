# Production Out Module - Shared Quantity Implementation Summary

## ✅ Implementation Complete

### What Was Implemented

The Production Out Module 03 now correctly handles **shared quantity pools** across comma-separated QR codes in the Storse Out sheet.

## Core Logic: Shared Quantity Pool

### The Rule
All QR codes listed in the same "Numbers" cell share ONE total quantity. When ANY QR code from the group is used to dispatch, it reduces the shared balance for ALL QR codes in that group.

### Real-World Example

```
Storse Out Sheet Row:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PO: 147348
Model: Sprinter
Numbers: "5,6,7,8,9,10,11"  ← All share same QTY
Total QTY: 10 pairs
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Timeline of Dispatches:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Day 1, 10:00 AM - User scans QR Code 6
┌────────────────────────────────────┐
│ System Shows:                      │
│ • Total QTY: 10                    │
│ • Dispatched: 0                    │
│ • Balance: 10                      │
│ • Shared with: 5,6,7,8,9,10,11    │
└────────────────────────────────────┘
User dispatches: 5 pairs
✅ GFU Out saved: QR Code 6, QTY 5

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Day 1, 2:00 PM - User scans QR Code 8 (different!)
┌────────────────────────────────────┐
│ System Shows:                      │
│ • Total QTY: 10                    │
│ • Dispatched: 5  ← from QR Code 6  │
│ • Balance: 5     ← SHARED          │
│ • Shared with: 5,6,7,8,9,10,11    │
└────────────────────────────────────┘
User dispatches: 3 pairs
✅ GFU Out saved: QR Code 8, QTY 3

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Day 2, 9:00 AM - User scans QR Code 6 (reusing!)
┌────────────────────────────────────┐
│ System Shows:                      │
│ • Total QTY: 10                    │
│ • Dispatched: 8  ← QR 6(5) + QR 8(3)│
│ • Balance: 2     ← SHARED          │
│ • Shared with: 5,6,7,8,9,10,11    │
└────────────────────────────────────┘
User dispatches: 2 pairs
✅ GFU Out saved: QR Code 6, QTY 2

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Day 2, 11:00 AM - User scans QR Code 10
┌────────────────────────────────────┐
│ ⚠️  FULLY DISPATCHED               │
│                                    │
│ QR Codes in Group:                 │
│ 5, 6, 7, 8, 9, 10, 11             │
│                                    │
│ Total: 10                          │
│ Dispatched: 10 (all used)          │
│ Balance: 0                         │
│                                    │
│ ❌ Cannot dispatch anymore         │
└────────────────────────────────────┘
```

## GFU Out Sheet After Above Dispatches

| QR Code | PO     | Model    | Size | QTY | Date       | Time     | MRN_Name |
|---------|--------|----------|------|-----|------------|----------|----------|
| 6       | 147348 | Sprinter | 45   | 5   | 21/08/2026 | 10:00:24 | 1ST EXTRA... |
| 8       | 147348 | Sprinter | 45   | 3   | 21/08/2026 | 14:00:15 | 1ST EXTRA... |
| 6       | 147348 | Sprinter | 45   | 2   | 22/08/2026 | 09:00:08 | 1ST EXTRA... |

**Total dispatched across all QR codes: 5 + 3 + 2 = 10 ✅**

## Key Features Implemented

### ✅ Shared Quantity Pool Logic
- All QR codes in same "Numbers" cell share one total quantity
- System calculates balance across ALL dispatches in the group
- Balance = Total QTY - Sum(all dispatches with any QR from group)

### ✅ Cross-QR Code Tracking
- Tracks dispatches made with ANY QR code from the same group
- Prevents over-dispatching across the entire group
- Allows flexible use of any QR code until pool is exhausted

### ✅ Visual Feedback
- **Yellow Info Box**: Shows all QR codes sharing the quantity pool
- **Total QTY**: Original amount (e.g., 10)
- **Dispatched**: Sum of all dispatches in group (red text)
- **Balance**: Remaining shared amount (green, bold)

### ✅ Multiple Dispatch Support
- Same QR code can be used multiple times
- Different QR codes from same group can be used
- Each dispatch reduces the shared balance

### ✅ Validation & Prevention
- User cannot enter quantity > balance
- When balance = 0, blocks all QR codes in the group
- Shows "Fully Dispatched" message with group details

### ✅ MRN Name Integration
- Displays MRN_Name from Storse Out sheet
- Saves MRN_Name to Column I in GFU Out sheet

## Technical Implementation

### Files Modified
- `assets/js/production-out.js`

### Key Functions Updated

1. **`poLookupQR(qrCode)`**
   - Extracts all QR codes from same cell
   - Fetches GFU Out sheet
   - Filters dispatches for ANY QR in the group
   - Calculates shared balance

2. **`buildPODetails(row)`**
   - Shows Total/Dispatched/Balance quantities
   - Displays yellow info box for shared quantity notice
   - Shows all QR codes in the group

3. **`buildPOFullyDispatched(row, totalQty, dispatchedQty, qrCodesInGroup)`**
   - Shows "Fully Dispatched" message
   - Lists all QR codes in the exhausted group
   - Prevents further dispatch attempts

4. **`poSubmitDispatch()`**
   - Validates against shared balance quantity
   - Allows submission if quantity ≤ balance

## Usage Workflow

### For Outsole Production Users

1. **Scan or Enter QR Code**
   - Use camera to scan QR code from product
   - OR manually type QR code

2. **Review Item Details**
   - Check PO, Model, Size, Colour
   - **Check Balance QTY** (this is what you can dispatch)
   - Note: If yellow box appears, other QR codes share this balance

3. **Enter Dispatch Quantity**
   - Maximum = Balance QTY shown
   - Can be less than balance (partial dispatch)

4. **Submit**
   - Confirm the dispatch
   - System saves to GFU Out sheet

5. **Scan Next Item**
   - Can scan same QR code again (if balance remains)
   - Can scan different QR code from same group
   - Can scan QR code from different group

## Testing Checklist

- [x] First dispatch with new QR code
- [x] Second dispatch with different QR from same group
- [x] Reusing same QR code multiple times
- [x] Attempt to exceed balance quantity
- [x] Fully exhausting the quantity pool
- [x] Attempting dispatch when balance is zero
- [x] Different groups have independent balances
- [x] MRN_Name displays and saves correctly
- [x] Shared quantity notice displays correctly

## Benefits

✅ **Prevents Over-Dispatching**: Cannot dispatch more than available  
✅ **Flexible QR Usage**: Use any QR code from the group  
✅ **Real-time Balance**: Always shows current shared balance  
✅ **Clear Communication**: Yellow box explains shared quantity  
✅ **Audit Trail**: GFU Out sheet shows which QR was used when  
✅ **User-Friendly**: Clear error messages and visual indicators  

## Important Notes

- ⚠️ Balance is **SHARED** across all QR codes in the same cell
- ⚠️ Using QR Code 6 reduces balance for QR Codes 5,7,8,9,10,11 too
- ⚠️ When balance reaches 0, ALL QR codes in that group are blocked
- ✅ Different rows in Storse Out = Different quantity pools (independent)
- ✅ System fetches latest data on every scan (supports concurrent users)

## Support

If users see:
- **"Fully Dispatched"** → The entire QR code group has been exhausted
- **"Quantity cannot exceed balance QTY (X)"** → User entered more than available
- **Yellow info box** → Multiple QR codes share this quantity

All working as designed! ✅
