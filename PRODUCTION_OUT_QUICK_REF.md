# Production Out Module - Quick Reference Card

## 🎯 One Rule to Remember

```
╔═══════════════════════════════════════════════════════════════╗
║  QR codes in the same cell = SHARE the same quantity pool    ║
╚═══════════════════════════════════════════════════════════════╝
```

## 📋 Quick Example

```
Row in Storse Out:
Numbers: "5,6,7,8"
QTY: 10

✅ Use QR 5 → Dispatch 3 → Balance: 7 (for ALL: 5,6,7,8)
✅ Use QR 7 → Dispatch 4 → Balance: 3 (for ALL: 5,6,7,8)
✅ Use QR 5 → Dispatch 3 → Balance: 0 (for ALL: 5,6,7,8)
❌ Use QR 8 → BLOCKED: Pool empty
```

## 🔢 What Numbers Mean

| Label | Meaning |
|-------|---------|
| **Total QTY** | Original amount in Storse Out |
| **Dispatched** | Sum of all dispatches with ANY QR from group |
| **Balance QTY** | What's left to dispatch (shared) |

## ✅ Allowed Actions

- ✅ Use any QR from the group
- ✅ Use same QR multiple times
- ✅ Dispatch partial quantities
- ✅ Mix QR codes from same group

## ❌ Blocked Actions

- ❌ Exceed balance quantity
- ❌ Use group when balance = 0
- ❌ Ignore shared pool limits

## 🚦 Status Indicators

| Color | Meaning |
|-------|---------|
| 🟢 Green Bold | Balance QTY (what you can dispatch) |
| 🔴 Red | Already dispatched amount |
| 🟡 Yellow Box | Shared quantity notice |
| ⚠️ Orange Icon | Warning or info message |
| ❌ Red Icon | Error or blocked |

## 📊 Screen Elements

### When Scanning
```
┌─────────────────────────────┐
│ PO: 147348                  │
│ Model: Sprinter             │
│ Size: 45                    │
│                             │
│ Total QTY:    10            │
│ Dispatched:    5 (red)      │
│ Balance QTY:   5 (green)    │ ← MAX you can enter
│                             │
│ ⚠️ Shared with: 5,6,7,8    │
└─────────────────────────────┘
```

### When Entering Quantity
```
Max = Balance QTY shown above
```

### After Submit
```
✅ Dispatched successfully!
[Scan Next Item]
```

### When Pool Empty
```
❌ Fully Dispatched
Cannot use ANY QR from this group
[Scan Another]
```

## 🔍 Error Messages

| Message | Action |
|---------|--------|
| "Cannot exceed balance QTY (X)" | Enter ≤ X |
| "Fully Dispatched" | Scan different group |
| "Not verified" | Complete Production In first |

## 💾 What Gets Saved (GFU Out Sheet)

| Column | Data |
|--------|------|
| QR Code | The QR you scanned |
| PO | Purchase order |
| Model | Shoe model |
| Size | Shoe size |
| QTY | Amount YOU dispatched |
| Date/Time | When dispatched |
| MRN_Name | Material receipt note |

## 🎓 Training Scenarios

### Scenario A: Single Dispatch
```
1. Scan QR 6
2. See Balance: 10
3. Enter: 10
4. Submit ✅
5. Done! (Balance now 0)
```

### Scenario B: Multiple Dispatches
```
1. Scan QR 6 → Enter 4 → Submit ✅
2. Scan QR 8 → See Balance: 6 → Enter 3 → Submit ✅
3. Scan QR 6 → See Balance: 3 → Enter 3 → Submit ✅
4. Done! (Balance now 0)
```

### Scenario C: Partial Then Block
```
1. Scan QR 5 → Enter 10 → Submit ✅
2. Scan QR 7 → ❌ "Fully Dispatched"
3. Scan different QR from different row ✅
```

## 🆘 Common Questions

**Q: Can I use the same QR code twice?**  
A: Yes! As long as balance > 0

**Q: Why is balance less than total?**  
A: Another QR from the same group was used

**Q: I scanned QR 8 but it shows dispatches with QR 6?**  
A: They share the same pool (check "Shared with" box)

**Q: What if I need to dispatch more?**  
A: You can only dispatch up to the balance shown

**Q: Can I delete a dispatch?**  
A: No, contact supervisor to manually edit sheet

## 📞 Support

Check detailed documentation:
- `PRODUCTION_OUT_SHARED_QTY_SUMMARY.md` - Complete explanation
- `PRODUCTION_OUT_VISUAL_GUIDE.md` - Step-by-step with diagrams
- `PRODUCTION_OUT_BALANCE_QTY.md` - Technical details

---

**Remember:** One Numbers cell = One shared pool! 🎯
