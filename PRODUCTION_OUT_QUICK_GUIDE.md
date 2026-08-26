# Production Out - Quick Reference Guide

## 🎯 What It Does
Production Out allows you to dispatch completed outsole items from the production floor by scanning individual QR numbers.

---

## 🚀 Quick Start (3 Steps)

### Step 1: Scan QR Number
- Open Production Out module
- Point camera at QR code
- Or switch to Manual Entry and type the number

### Step 2: Enter Quantity
- Review item details (PO, Model, Colour, Size)
- Enter how many units to dispatch
- Must be between 1 and available stock

### Step 3: Submit
- Click Submit button
- Confirm dispatch
- View success message

---

## 📋 Example Workflow

```
Your QR sticker shows: "8"

1. Scan "8" → System finds it in range "6,7,8,9,10,11,12,13"
2. Shows: PO 147248, Sprinter, Lime, Size 45, QTY 1
3. Enter: 1 unit
4. Submit → Success!
5. Sheet updated: QTY reduced, marked as "Dispatched"
```

---

## ✅ What You'll See

### When QR is Valid
```
✅ Production Item Found
QR: 8                          [Verified Badge]

PO: 147248          Model: Sprinter
Colour: Lime        Size: EU 45
Available: 1 unit

[Enter Quantity] → [Submit]
```

### After Successful Dispatch
```
✅ Dispatched Successfully!

1 units of Sprinter (QR: 8) dispatched

QR Number: 8        Dispatched: 1
Model: Sprinter     Status: ✅ Dispatched

[Scan Next Item]
```

---

## ❌ Common Errors

### "No Record Found"
**Meaning**: QR number doesn't exist in system  
**Fix**: Check if you scanned the correct number

### "Not Ready for Production Out"
**Meaning**: Item hasn't been through Production In yet  
**Fix**: Complete Production In verification first

### "Please enter a valid quantity"
**Meaning**: Quantity is 0, empty, or exceeds available stock  
**Fix**: Enter a number between 1 and the maximum shown

---

## 🔧 Tips & Tricks

### Scanning Tips
- Hold steady and keep QR code in focus
- Ensure good lighting
- Keep camera 6-12 inches from QR code
- If scanning fails, use Manual Entry

### Manual Entry
- Click "Manual Entry" tab
- Type the QR number exactly as shown
- Press Enter or click "Look Up"

### Multiple Dispatches
- After each dispatch, click "Scan Next Item"
- No need to close and reopen module
- Scanner restarts automatically

### Quantity Rules
- Minimum: 1 unit
- Maximum: Available stock
- System shows max allowed
- Partial dispatches are allowed

---

## 📱 Device Support

### On Computer
- Use rear camera (better quality)
- Can also type manually
- Larger screen = easier to view details

### On Phone/Tablet
- Hold device horizontally for best view
- Touch-friendly buttons
- Camera usually better quality
- Can switch between front/rear cameras

---

## 🔄 What Happens Behind the Scenes

When you dispatch an item:

1. ✅ **System Updates Sheet**
   - Reduces available quantity
   - Marks status as "Dispatched"
   - Records your name, date, and time

2. ✅ **Audit Trail Created**
   - Who dispatched: Your username
   - When: Current date and time
   - How much: Quantity dispatched

3. ✅ **Data Ready for Next Step**
   - Item now tracked as dispatched
   - Ready for Pack To Bin (future feature)
   - Inventory automatically updated

---

## 🆘 Need Help?

### Camera Not Working
1. Check browser permissions
2. Allow camera access when prompted
3. Try Manual Entry as backup
4. Restart browser if needed

### Can't Find QR Number
1. Verify QR number exists in system
2. Check if item was verified in Production In
3. Ensure you're scanning the correct sticker
4. Try typing manually to avoid scanning errors

### Wrong Item Displayed
1. Double-check QR number scanned
2. Verify item details match physical item
3. Click Cancel and rescan if incorrect
4. Report to supervisor if persistent

### Submit Not Working
1. Check quantity is valid (1 to max)
2. Ensure internet connection is stable
3. Wait for confirmation dialog
4. Try again if network error occurs

---

## 📊 Key Information

### QR Number Format
- Individual numbers (e.g., "8", "12", "15")
- Part of a range in system (e.g., "6,7,8,9,10")
- Scanned number must be in that range

### Item Details Shown
- **QR Number**: Individual number you scanned
- **PO Number**: Purchase order reference
- **Model**: Shoe model name
- **Colour**: Outsole colour
- **Size**: EU shoe size
- **Available QTY**: Current stock quantity
- **MRN Reference**: Material requisition reference

### Dispatch Information Recorded
- **Dispatched Qty**: How many units
- **Dispatched User**: Your username
- **Dispatched Date**: Today's date
- **Dispatched Time**: Current time
- **Status**: Marked as "Dispatched"

---

## ⚡ Keyboard Shortcuts

- **Enter**: Submit manual entry / Confirm action
- **Escape**: Close modal
- **Tab**: Move between fields

---

## 📞 Quick Support

**Issue**: Camera permission denied  
**Fix**: Browser settings → Allow camera for this site

**Issue**: QR not scanning  
**Fix**: Switch to Manual Entry tab and type number

**Issue**: "Network error"  
**Fix**: Check internet connection, try again

**Issue**: Quantity validation error  
**Fix**: Enter number between 1 and maximum shown

---

## ✨ Best Practices

### Before Starting
- ✅ Ensure item passed Production In
- ✅ Verify QR sticker is readable
- ✅ Check available quantity
- ✅ Have physical item ready

### During Dispatch
- ✅ Scan or type QR number carefully
- ✅ Verify item details match
- ✅ Enter correct dispatch quantity
- ✅ Confirm before submitting
- ✅ Wait for success message

### After Dispatch
- ✅ Note dispatch was successful
- ✅ Mark physical item as dispatched
- ✅ Move item to designated area
- ✅ Continue with next item or close module

---

## 📈 Process Flow Summary

```
Start
  ↓
Open Production Out Module
  ↓
Scan QR Number (or Manual Entry)
  ↓
System Checks:
  • QR exists in Column O? ✅
  • Item verified? ✅
  ↓
Display Item Details
  ↓
Enter Dispatch Quantity
  ↓
Validate:
  • Quantity ≥ 1? ✅
  • Quantity ≤ Available? ✅
  ↓
Click Submit
  ↓
Confirm Dispatch
  ↓
System Updates:
  • Reduce quantity
  • Mark as dispatched
  • Record user, date, time
  ↓
Success Message
  ↓
Continue with Next Item or Close
```

---

## 🎓 Training Notes

### For New Users
1. Start with Manual Entry (easier to learn)
2. Practice with test QR codes first
3. Understand validation messages
4. Learn to read item details
5. Graduate to camera scanning

### For Experienced Users
- Use camera scanning for speed
- Memorize common keyboard shortcuts
- Batch similar items together
- Note patterns in QR ranges
- Report any issues immediately

---

## 📅 Remember

- ✅ One QR number = One item record
- ✅ QR numbers are part of ranges (e.g., 6-13)
- ✅ Must be verified before dispatch
- ✅ Quantity must be valid (1 to max)
- ✅ All dispatches are tracked and recorded

---

**Need More Help?**  
Refer to: `PRODUCTION_OUT_IMPLEMENTATION.md` (detailed guide)  
Or contact: Your supervisor / System administrator

---

**Quick Reference Card v1.0**  
*Outsole Production - Production Out Module*
