# Production Out Module - Visual Guide

## 📊 Understanding Shared Quantity Pools

### Storse Out Sheet Structure

```
┌──────────────────────────────────────────────────────────────────────────┐
│                         STORSE OUT SHEET                                 │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  Row 1: QR_Code: 91  │  PO: 147348  │  Model: Sprinter  │  Size: 45   │
│         Numbers: "5,6,7,8,9,10,11"                                      │
│         QTY: 10  ← SHARED POOL FOR ALL QR CODES                         │
│                                                                          │
│  Row 2: QR_Code: 87  │  PO: 147254  │  Model: Elite     │  Size: 41   │
│         Numbers: "1,2,3,4"                                              │
│         QTY: 20  ← DIFFERENT POOL (INDEPENDENT)                         │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

## 🔄 Flow Example: Row 1 (QR Codes: 5,6,7,8,9,10,11)

### Initial State
```
╔══════════════════════════════════════════════════════════════╗
║                   QUANTITY POOL: 10 pairs                    ║
╠══════════════════════════════════════════════════════════════╣
║  Available QR Codes: 5, 6, 7, 8, 9, 10, 11                  ║
║  Any of these can be used to dispatch                        ║
╚══════════════════════════════════════════════════════════════╝
```

### Step 1: User Scans QR Code 6

```
┌──────────────────────────────────────────────────────────────┐
│  🔍 SCANNING QR CODE: 6                                      │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  📊 SYSTEM DISPLAYS:                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  PO: 147348                                                  │
│  Model: Sprinter                                             │
│  Size: 45                                                    │
│                                                              │
│  Total QTY:      10                                          │
│  Dispatched:      0  (nothing used yet)                      │
│  Balance QTY:    10  ← Can dispatch up to this              │
│                                                              │
│  ⚠️  Shared with: 5,6,7,8,9,10,11                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                              │
│  Enter Quantity: [  5  ]                                     │
│  [Submit]                                                    │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  ✅ DISPATCHED: 5 pairs using QR Code 6                     │
└──────────────────────────────────────────────────────────────┘
                         ↓
╔══════════════════════════════════════════════════════════════╗
║             UPDATED QUANTITY POOL: 5 pairs left              ║
╠══════════════════════════════════════════════════════════════╣
║  QR Code 6 used 5 → Balance now 5 for ALL QR codes          ║
╚══════════════════════════════════════════════════════════════╝
```

### GFU Out Sheet After Step 1
```
┌──────────────────────────────────────────────────────────────┐
│  QR Code │ PO     │ Model    │ QTY │ Date       │ Time      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  6       │ 147348 │ Sprinter │ 5   │ 21/08/2026 │ 10:00:24  │
└──────────────────────────────────────────────────────────────┘
```

---

### Step 2: User Scans QR Code 8 (Different QR, Same Group)

```
┌──────────────────────────────────────────────────────────────┐
│  🔍 SCANNING QR CODE: 8  (different from 6!)                │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  📊 SYSTEM DISPLAYS:                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  PO: 147348                                                  │
│  Model: Sprinter                                             │
│  Size: 45                                                    │
│                                                              │
│  Total QTY:      10                                          │
│  Dispatched:      5  ← from QR Code 6!                       │
│  Balance QTY:     5  ← Shared balance                        │
│                                                              │
│  ⚠️  Shared with: 5,6,7,8,9,10,11                           │
│      (QR Code 6 already used 5 from the pool)               │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                              │
│  Enter Quantity: [  3  ]                                     │
│  [Submit]                                                    │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  ✅ DISPATCHED: 3 pairs using QR Code 8                     │
└──────────────────────────────────────────────────────────────┘
                         ↓
╔══════════════════════════════════════════════════════════════╗
║             UPDATED QUANTITY POOL: 2 pairs left              ║
╠══════════════════════════════════════════════════════════════╣
║  Used: QR 6 (5) + QR 8 (3) = 8 total                        ║
║  Balance: 10 - 8 = 2 remaining for ALL QR codes             ║
╚══════════════════════════════════════════════════════════════╝
```

### GFU Out Sheet After Step 2
```
┌──────────────────────────────────────────────────────────────┐
│  QR Code │ PO     │ Model    │ QTY │ Date       │ Time      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  6       │ 147348 │ Sprinter │ 5   │ 21/08/2026 │ 10:00:24  │
│  8       │ 147348 │ Sprinter │ 3   │ 21/08/2026 │ 14:00:15  │
└──────────────────────────────────────────────────────────────┘
```

---

### Step 3: User Scans QR Code 6 Again (Reusing!)

```
┌──────────────────────────────────────────────────────────────┐
│  🔍 SCANNING QR CODE: 6  (reusing QR Code 6!)               │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  📊 SYSTEM DISPLAYS:                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  PO: 147348                                                  │
│  Model: Sprinter                                             │
│  Size: 45                                                    │
│                                                              │
│  Total QTY:      10                                          │
│  Dispatched:      8  ← QR 6(5) + QR 8(3)                     │
│  Balance QTY:     2  ← Only 2 left!                          │
│                                                              │
│  ⚠️  Shared with: 5,6,7,8,9,10,11                           │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                              │
│  Enter Quantity: [  2  ]                                     │
│  [Submit]                                                    │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  ✅ DISPATCHED: 2 pairs using QR Code 6 (second time!)      │
└──────────────────────────────────────────────────────────────┘
                         ↓
╔══════════════════════════════════════════════════════════════╗
║          ⚠️  QUANTITY POOL: 0 pairs left (EMPTY!)           ║
╠══════════════════════════════════════════════════════════════╣
║  Used: QR 6 (5+2) + QR 8 (3) = 10 total                     ║
║  Balance: 10 - 10 = 0                                        ║
║  Status: FULLY DISPATCHED                                    ║
╚══════════════════════════════════════════════════════════════╝
```

### GFU Out Sheet After Step 3
```
┌──────────────────────────────────────────────────────────────┐
│  QR Code │ PO     │ Model    │ QTY │ Date       │ Time      │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│  6       │ 147348 │ Sprinter │ 5   │ 21/08/2026 │ 10:00:24  │
│  8       │ 147348 │ Sprinter │ 3   │ 21/08/2026 │ 14:00:15  │
│  6       │ 147348 │ Sprinter │ 2   │ 22/08/2026 │ 09:00:08  │ ← Same QR!
└──────────────────────────────────────────────────────────────┘
```

---

### Step 4: User Tries QR Code 10 (From Same Group)

```
┌──────────────────────────────────────────────────────────────┐
│  🔍 SCANNING QR CODE: 10                                     │
└──────────────────────────────────────────────────────────────┘
                         ↓
┌──────────────────────────────────────────────────────────────┐
│  ❌ FULLY DISPATCHED                                         │
│  ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━  │
│                                                              │
│  QR code "10" belongs to a group that has been              │
│  fully dispatched.                                           │
│                                                              │
│  QR Codes in Same Group:                                     │
│  5, 6, 7, 8, 9, 10, 11                                      │
│                                                              │
│  Dispatch Summary:                                           │
│  Total Available: 10                                         │
│  Already Dispatched: 10                                      │
│  Remaining Balance: 0                                        │
│                                                              │
│  No more quantity can be dispatched for any                  │
│  QR code in this group.                                      │
│                                                              │
│  [Scan Another]                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## 🎯 Key Takeaways

### ✅ What You CAN Do
- Use any QR code from the group (5,6,7,8,9,10,11)
- Use the same QR code multiple times
- Dispatch partial quantities
- Mix different QR codes from same group

### ❌ What You CANNOT Do
- Dispatch more than the shared balance
- Use any QR from the group when balance = 0
- Dispatch from one QR without affecting others in the group

### 💡 Remember
```
┌────────────────────────────────────────────────────────────┐
│  One cell in "Numbers" = One shared quantity pool          │
│                                                            │
│  If Numbers = "5,6,7,8,9,10,11"                           │
│  And QTY = 10                                              │
│                                                            │
│  Then:                                                     │
│  → ALL these QR codes share the 10 pairs                   │
│  → Using QR 6 reduces balance for QR 8, 9, 10, etc.       │
│  → When balance = 0, ALL QR codes are blocked             │
└────────────────────────────────────────────────────────────┘
```

## 📱 User Interface Elements

### Info Box (Yellow)
```
┌────────────────────────────────────────────────────────────┐
│ ℹ️  Shared Quantity:                                       │
│                                                            │
│ This QR code shares the total quantity with other         │
│ QR codes: 5, 6, 7, 8, 9, 10, 11                          │
│                                                            │
│ The balance shown (5) is shared across all these          │
│ QR codes.                                                  │
└────────────────────────────────────────────────────────────┘
```

### Quantity Display
```
Total QTY:      10  ← Original amount
Dispatched:      5  ← Used by any QR from group (red)
Balance QTY:     5  ← Remaining for all QRs (green, bold)
```

### Validation Message
```
❌ Quantity cannot exceed balance QTY (5).
   (When user tries to enter 6 or more)
```

---

## 🔍 Troubleshooting

| Scenario | What User Sees | Why |
|----------|----------------|-----|
| Scans QR 8 after QR 6 was used | Balance less than Total | They share the same pool |
| Tries to enter 10 when balance is 5 | Error: "Cannot exceed balance" | Previous dispatches used 5 |
| Scans any QR from group when pool empty | "Fully Dispatched" message | All 10 units already dispatched |
| Yellow info box appears | Lists all QR codes | Showing which QRs share the pool |

---

**Need Help?** Check the documentation: `PRODUCTION_OUT_SHARED_QTY_SUMMARY.md`
