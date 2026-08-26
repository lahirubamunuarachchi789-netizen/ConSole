# Production Out Module - Test Plan

## Test Environment Setup

### Prerequisites
- ✅ Modern web browser (Chrome, Firefox, Safari, Edge)
- ✅ Camera-enabled device (for QR scanning tests)
- ✅ Internet connection
- ✅ Valid user session (Outsole Production department)
- ✅ Test QR codes from Stores Out sheet
- ✅ Items that have been verified through Production In

### Test Data Required
1. **Valid QR Code** - Item that has been verified (Vrification column populated)
2. **Unverified QR Code** - Item that exists but not verified yet
3. **Invalid QR Code** - Code that doesn't exist in sheet
4. **Various Quantities** - Test with different available quantities

---

## 🧪 Test Cases

### TC-01: Module Access
**Objective**: Verify Production Out module can be accessed

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Log in as Outsole Production user | Login successful | ⬜ |
| 2 | Navigate to Outsole dashboard | Dashboard loads | ⬜ |
| 3 | Locate Production Out card (orange, #03) | Card visible | ⬜ |
| 4 | Click Production Out card | Modal opens | ⬜ |
| 5 | Verify modal styling | Orange theme applied | ⬜ |
| 6 | Check header content | "Production Out" title visible | ⬜ |

---

### TC-02: QR Scanner Initialization
**Objective**: Verify QR scanner starts correctly

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Open Production Out module | Modal opens | ⬜ |
| 2 | Check Scan tab active by default | Scan tab highlighted | ⬜ |
| 3 | Verify camera permission prompt | Browser requests camera access | ⬜ |
| 4 | Grant camera permission | Permission granted | ⬜ |
| 5 | Check QR viewport | Camera feed appears | ⬜ |
| 6 | Verify scanning line | Orange line animates up/down | ⬜ |
| 7 | Check status strip | "Camera active" message shown | ⬜ |
| 8 | Verify corner markers | Orange corners visible | ⬜ |

---

### TC-03: QR Code Scanning - Valid Item
**Objective**: Verify scanning a valid, verified QR code

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Open Production Out module | Scanner active | ⬜ |
| 2 | Point camera at valid QR code | Code automatically detected | ⬜ |
| 3 | Check scanning stops | Camera feed stops | ⬜ |
| 4 | Verify result badge appears | QR badge shows captured code | ⬜ |
| 5 | Check toast notification | "QR code captured!" shown | ⬜ |
| 6 | Wait for lookup | "Looking up QR code…" shown | ⬜ |
| 7 | Verify item details appear | Details card displays | ⬜ |
| 8 | Check verification badge | Green "Verified" badge shown | ⬜ |
| 9 | Verify all fields populated | PO, Model, Colour, Size, QTY shown | ⬜ |
| 10 | Check quantity highlighted | Available QTY in orange | ⬜ |

---

### TC-04: Camera Toggle
**Objective**: Verify switching between cameras

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Open Production Out module | Scanner active | ⬜ |
| 2 | Click "Switch Camera" button | Status shows "Switching camera…" | ⬜ |
| 3 | Wait for switch | Camera switches to front | ⬜ |
| 4 | Verify status update | "Camera switched" message | ⬜ |
| 5 | Click "Switch Camera" again | Switches back to rear | ⬜ |
| 6 | Verify functionality | Can scan with both cameras | ⬜ |

---

### TC-05: Manual QR Entry
**Objective**: Verify manual QR code entry

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Open Production Out module | Modal opens | ⬜ |
| 2 | Click "Manual Entry" tab | Tab switches | ⬜ |
| 3 | Verify camera stops | Camera feed stops | ⬜ |
| 4 | Check manual panel visible | Input field shown | ⬜ |
| 5 | Type valid QR code | Text appears in field | ⬜ |
| 6 | Press Enter key | Lookup triggered | ⬜ |
| 7 | Verify result badge | QR badge appears | ⬜ |
| 8 | Check item details | Details card displays | ⬜ |
| 9 | Clear and try "Look Up" button | Same behavior | ⬜ |

---

### TC-06: QR Clear Function
**Objective**: Verify clearing captured QR code

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Scan or enter QR code | Details displayed | ⬜ |
| 2 | Click X button in result badge | Badge disappears | ⬜ |
| 3 | Verify details cleared | Details card removed | ⬜ |
| 4 | Check scanner restarts | Camera activates (if in Scan tab) | ⬜ |
| 5 | Verify scanning line | Animation resumes | ⬜ |

---

### TC-07: Quantity Input - Valid
**Objective**: Verify valid quantity input

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Scan valid QR code | Details displayed | ⬜ |
| 2 | Note available quantity (e.g., 150) | Quantity shown | ⬜ |
| 3 | Enter quantity: 50 | Input accepted | ⬜ |
| 4 | Click Submit | Confirmation dialog appears | ⬜ |
| 5 | Verify confirmation message | Shows quantity and model | ⬜ |
| 6 | Click Cancel in dialog | Dialog closes, no action | ⬜ |
| 7 | Click Submit again | Dialog appears again | ⬜ |
| 8 | Click OK/Confirm | Submission proceeds | ⬜ |

---

### TC-08: Quantity Validation - Below Minimum
**Objective**: Verify minimum quantity validation

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Scan valid QR code | Details displayed | ⬜ |
| 2 | Enter quantity: 0 | Input accepted | ⬜ |
| 3 | Click Submit | Validation error | ⬜ |
| 4 | Check error message | "Please enter a valid quantity" | ⬜ |
| 5 | Enter quantity: -5 | Input accepted | ⬜ |
| 6 | Click Submit | Same validation error | ⬜ |
| 7 | Verify no submission | Sheet not updated | ⬜ |

---

### TC-09: Quantity Validation - Above Maximum
**Objective**: Verify maximum quantity validation

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Scan QR with available qty 100 | Details displayed | ⬜ |
| 2 | Note max hint | "Maximum: 100 units" shown | ⬜ |
| 3 | Enter quantity: 150 | Input accepted | ⬜ |
| 4 | Click Submit | Validation error | ⬜ |
| 5 | Check error message | "Cannot exceed available stock (100)" | ⬜ |
| 6 | Verify focus returned | Focus on quantity input | ⬜ |
| 7 | Verify no submission | Sheet not updated | ⬜ |

---

### TC-10: Quantity Validation - Non-numeric
**Objective**: Verify non-numeric input handling

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Scan valid QR code | Details displayed | ⬜ |
| 2 | Enter text: "abc" | Input field rejects | ⬜ |
| 3 | Try empty input | Field empty | ⬜ |
| 4 | Click Submit | Validation error | ⬜ |
| 5 | Check error message | "Please enter a valid quantity" | ⬜ |

---

### TC-11: Successful Dispatch
**Objective**: Verify successful dispatch flow

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Scan valid QR code | Details displayed | ⬜ |
| 2 | Note available quantity (e.g., 100) | Quantity shown | ⬜ |
| 3 | Enter quantity: 25 | Input accepted | ⬜ |
| 4 | Click Submit | Confirmation dialog | ⬜ |
| 5 | Confirm dispatch | Button shows "Submitting…" | ⬜ |
| 6 | Wait for completion | Success screen appears | ⬜ |
| 7 | Verify success icon | Green checkmark with bounce | ⬜ |
| 8 | Check message | "Dispatched Successfully!" | ⬜ |
| 9 | Verify summary grid | QR, Qty, Model, Status shown | ⬜ |
| 10 | Check dispatched qty | Shows 25 in orange | ⬜ |
| 11 | Verify status | "Dispatched" in green | ⬜ |
| 12 | Check toast | "Item dispatched successfully!" | ⬜ |

---

### TC-12: Sheet Update Verification
**Objective**: Verify Google Sheet is updated correctly

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Before test, note QTY in sheet | Original quantity recorded | ⬜ |
| 2 | Dispatch 20 units from QR | Dispatch successful | ⬜ |
| 3 | Open Stores Out sheet | Sheet loads | ⬜ |
| 4 | Find the QR code row | Row located | ⬜ |
| 5 | Check QTY (Column G) | Reduced by 20 | ⬜ |
| 6 | Check Production Out (Column P) | "Dispatched" | ⬜ |
| 7 | Check Dispatched Qty (Column Q) | Shows 20 | ⬜ |
| 8 | Check Dispatched User (Column R) | Current user name | ⬜ |
| 9 | Check Dispatched Date (Column S) | Today's date (DD/MM/YYYY) | ⬜ |
| 10 | Check Dispatched Time (Column T) | Current time (HH:MM:SS) | ⬜ |

---

### TC-13: Scan Next Item
**Objective**: Verify continuing to next item

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Complete a dispatch | Success screen shown | ⬜ |
| 2 | Click "Scan Next Item" button | Success screen clears | ⬜ |
| 3 | Verify scanner restarts | Camera activates | ⬜ |
| 4 | Check clean state | No previous data shown | ⬜ |
| 5 | Scan another QR code | New item lookup starts | ⬜ |
| 6 | Verify independent | Previous dispatch not affected | ⬜ |

---

### TC-14: Error - QR Not Found
**Objective**: Verify handling of non-existent QR code

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Open Production Out module | Scanner active | ⬜ |
| 2 | Enter invalid QR: "INVALID-123" | Lookup starts | ⬜ |
| 3 | Wait for result | Error card displays | ⬜ |
| 4 | Check error icon | Red X icon shown | ⬜ |
| 5 | Verify error title | "No Record Found" | ⬜ |
| 6 | Check error message | Shows invalid QR code | ⬜ |
| 7 | Verify action button | "Try Again" button shown | ⬜ |
| 8 | Click "Try Again" | Clears and restarts scanner | ⬜ |

---

### TC-15: Error - Item Not Verified
**Objective**: Verify handling of unverified items

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Identify unverified QR code | Find item without Vrification | ⬜ |
| 2 | Scan or enter that QR code | Lookup completes | ⬜ |
| 3 | Check error card | Warning card displays | ⬜ |
| 4 | Verify warning icon | Yellow warning icon | ⬜ |
| 5 | Check error title | "Not Ready for Production Out" | ⬜ |
| 6 | Verify message | Mentions Production In required | ⬜ |
| 7 | Check action button | "Scan Another" button shown | ⬜ |
| 8 | Click "Scan Another" | Clears and restarts | ⬜ |

---

### TC-16: Error - Network Failure
**Objective**: Verify handling of network errors

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Open Production Out module | Modal opens | ⬜ |
| 2 | Disable network connection | Network offline | ⬜ |
| 3 | Scan or enter valid QR code | Lookup attempts | ⬜ |
| 4 | Wait for timeout | Error card displays | ⬜ |
| 5 | Check error icon | Red warning icon | ⬜ |
| 6 | Verify error title | "Lookup Failed" | ⬜ |
| 7 | Check error message | Network error mentioned | ⬜ |
| 8 | Re-enable network | Connection restored | ⬜ |
| 9 | Click "Try Again" | Retry succeeds | ⬜ |

---

### TC-17: Modal Close and Cleanup
**Objective**: Verify proper cleanup when closing

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Open Production Out module | Scanner active | ⬜ |
| 2 | Scan a QR code | Details displayed | ⬜ |
| 3 | Click X button in modal header | Modal closes | ⬜ |
| 4 | Verify camera stops | Camera indicator off | ⬜ |
| 5 | Re-open Production Out | Fresh state, no data | ⬜ |
| 6 | Verify scanner restarts | Camera activates | ⬜ |
| 7 | Press Escape key | Modal closes | ⬜ |
| 8 | Click outside modal | Modal closes | ⬜ |

---

### TC-18: Tab Switching Behavior
**Objective**: Verify tab switching works correctly

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Open Production Out module | Scan tab active | ⬜ |
| 2 | Camera running | Camera feed visible | ⬜ |
| 3 | Click Manual Entry tab | Tab switches | ⬜ |
| 4 | Verify camera stops | Camera feed stops | ⬜ |
| 5 | Check input field visible | Manual input shown | ⬜ |
| 6 | Verify focus | Input field receives focus | ⬜ |
| 7 | Click Scan tab | Tab switches back | ⬜ |
| 8 | Verify camera restarts | Camera feed starts | ⬜ |
| 9 | Check manual panel hidden | Input hidden | ⬜ |

---

### TC-19: Cancel Button
**Objective**: Verify Cancel button functionality

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Scan valid QR code | Details displayed | ⬜ |
| 2 | Enter quantity: 50 | Input accepted | ⬜ |
| 3 | Click Cancel button | Details cleared | ⬜ |
| 4 | Verify scanner restarts | Camera activates | ⬜ |
| 5 | Check no submission | Sheet not updated | ⬜ |

---

### TC-20: Multiple Dispatches Same Session
**Objective**: Verify handling multiple dispatches

| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Dispatch item A (30 units) | Success | ⬜ |
| 2 | Click Scan Next Item | Scanner restarts | ⬜ |
| 3 | Dispatch item B (45 units) | Success | ⬜ |
| 4 | Click Scan Next Item | Scanner restarts | ⬜ |
| 5 | Dispatch item C (20 units) | Success | ⬜ |
| 6 | Verify sheet has all 3 | All updated correctly | ⬜ |
| 7 | Check quantities reduced | All QTYs reduced properly | ⬜ |

---

## 📱 Responsive Testing

### TC-R01: Mobile (Portrait)
**Device**: iPhone/Android phone, 375px width

| Component | Expected Behavior | Status |
|-----------|-------------------|--------|
| Modal | Full width, max height 95vh | ⬜ |
| Header | Stacked layout | ⬜ |
| QR viewport | Full width, maintains aspect | ⬜ |
| Tabs | Full width buttons | ⬜ |
| Details grid | Single column | ⬜ |
| Buttons | Stacked, full width | ⬜ |
| Success grid | Single column | ⬜ |
| Touch targets | Minimum 44px | ⬜ |

### TC-R02: Tablet (Portrait)
**Device**: iPad, 768px width

| Component | Expected Behavior | Status |
|-----------|-------------------|--------|
| Modal | Max width 900px | ⬜ |
| QR viewport | 360px max width | ⬜ |
| Details grid | Two columns | ⬜ |
| Buttons | Side by side | ⬜ |
| Layout | Tablet-optimized spacing | ⬜ |

### TC-R03: Desktop
**Device**: 1920x1080 screen

| Component | Expected Behavior | Status |
|-----------|-------------------|--------|
| Modal | Centered, max width 900px | ⬜ |
| QR viewport | 420px max width | ⬜ |
| Details grid | Two columns | ⬜ |
| Buttons | Side by side | ⬜ |
| Hover effects | All interactive elements | ⬜ |

---

## 🌐 Browser Compatibility Testing

| Browser | Version | Platform | Status | Notes |
|---------|---------|----------|--------|-------|
| Chrome | Latest | Windows | ⬜ | |
| Chrome | Latest | macOS | ⬜ | |
| Chrome | Latest | Android | ⬜ | |
| Firefox | Latest | Windows | ⬜ | |
| Firefox | Latest | macOS | ⬜ | |
| Safari | Latest | iOS | ⬜ | |
| Safari | Latest | macOS | ⬜ | |
| Edge | Latest | Windows | ⬜ | |
| Samsung Internet | Latest | Android | ⬜ | |

---

## ♿ Accessibility Testing

### TC-A01: Keyboard Navigation
| Step | Action | Expected Result | Status |
|------|--------|-----------------|--------|
| 1 | Tab through modal | Focus visible on all elements | ⬜ |
| 2 | Press Enter on Manual tab | Tab switches | ⬜ |
| 3 | Type in input, press Enter | Lookup triggered | ⬜ |
| 4 | Tab to Submit button | Button receives focus | ⬜ |
| 5 | Press Enter on Submit | Confirmation appears | ⬜ |
| 6 | Press Escape | Modal closes | ⬜ |

### TC-A02: Screen Reader
| Component | Announced Correctly | Status |
|-----------|---------------------|--------|
| Modal title | Yes | ⬜ |
| Tab buttons | State announced | ⬜ |
| Input labels | Associated correctly | ⬜ |
| Buttons | Purpose clear | ⬜ |
| Toast notifications | Announced | ⬜ |
| Error messages | Announced | ⬜ |

### TC-A03: Visual
| Check | Result | Status |
|-------|--------|--------|
| Color contrast | WCAG AA compliant | ⬜ |
| Text size | Minimum 11.5px | ⬜ |
| Focus indicators | Visible | ⬜ |
| Icons with text | Redundancy present | ⬜ |

---

## 🔒 Security Testing

### TC-S01: Session Validation
| Step | Expected Result | Status |
|------|-----------------|--------|
| Open module without login | Redirect to login | ⬜ |
| Wrong department user | Access denied | ⬜ |
| Session expired | Re-authentication required | ⬜ |

### TC-S02: Input Sanitization
| Input | Handling | Status |
|-------|----------|--------|
| HTML in QR code | Escaped, not rendered | ⬜ |
| Script tags | Escaped, not executed | ⬜ |
| SQL injection attempt | No effect | ⬜ |

---

## 📊 Performance Testing

### TC-P01: Loading Times
| Action | Target | Actual | Status |
|--------|--------|--------|--------|
| Modal open | <500ms | | ⬜ |
| Camera init | <2s | | ⬜ |
| QR lookup | <3s | | ⬜ |
| Sheet update | <5s | | ⬜ |

### TC-P02: Memory
| Check | Result | Status |
|-------|--------|--------|
| Camera stops on close | No leak | ⬜ |
| Multiple open/close | Stable | ⬜ |
| Extended use | No degradation | ⬜ |

---

## 📝 Test Execution Summary

### Test Statistics
- **Total Test Cases**: 20 functional + 8 responsive + 9 browser + 3 accessibility + 2 security + 2 performance = **44 tests**
- **Passed**: _____
- **Failed**: _____
- **Blocked**: _____
- **Not Executed**: _____

### Test Environment
- **Date**: _____________
- **Tester**: _____________
- **Browser**: _____________
- **Device**: _____________
- **Network**: _____________

### Issues Found
| ID | Severity | Description | Status |
|----|----------|-------------|--------|
| | | | |

### Sign-off
- **Tester**: _________________ Date: _______
- **Reviewer**: _________________ Date: _______
- **Approved**: _________________ Date: _______

---

## 📚 Notes
- Use real test data from Stores Out sheet
- Test with multiple users simultaneously for concurrency
- Verify audit trail timestamps are accurate
- Check for memory leaks with prolonged usage
- Test with slow network connections
- Verify behavior with camera permission denied
- Test rapid QR code scanning
- Check for race conditions in API calls
