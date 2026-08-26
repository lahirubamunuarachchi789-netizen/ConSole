# Transportation Management Module - HR Dashboard

## Overview
The Transportation Management module allows HR Department users to manage vehicle assignments for approved gatepasses. This module displays gatepasses with "Pending To Transport" status, allows viewing detailed previews, downloading PDFs, and assigning vehicles with driver information.

## Features Implemented

### 1. **Gatepass List View**
- Displays gatepasses with Status = "Pending To Transport" from Column D
- Shows gatepass name, employee name, created date, and HR approval date
- Real-time count of pending transport assignments
- Refresh button to reload the list
- Empty state when no gatepasses pending

### 2. **Professional Gatepass Preview**
Full-screen modal showing:
- Complete gatepass details from JSON in Column A
- **Approval Timeline** showing:
  - ✓ Management Approved (green checkmark)
  - ✓ HR Approved (green checkmark)
  - ⏳ Transport Assignment (pending)
- Items table with sizes and quantities
- Professional document layout with company branding

### 3. **PDF Download (Teal/Cyan Theme)**
- Download gatepass as professional PDF
- **Teal/Cyan branding** for Transport Department
- Includes full approval chain (Management + HR)
- Shows "PENDING TRANSPORT" status
- Filename: `Transport_Gatepass_{Name}_{Timestamp}.pdf`

### 4. **Vehicle Assignment Form**
Modal form with:
- **Vehicle Number** (required)
- **Driver Name** (required)
- **Remarks** (optional)
- Real-time validation
- Success confirmation
- Updates status to "Vehicle Assigned"

## Data Flow

### Step 1: HR Approves Gatepass
```
HR User Approves → Status: "Pending To Transport" (Column D)
                 → HR approval data in Columns I, J, K
```

### Step 2: Transportation User Views Gatepasses
```
User opens Transportation module
→ fetchTransportGatepasses()
→ GET request to SheetBest API
→ Filter where Status === "Pending To Transport"
→ Display in list
```

### Step 3: View Gatepass Preview
```
User clicks gatepass card
→ viewTransportGatepass(index)
→ Parse JSON from Column A
→ Display approval timeline
→ Show all details
→ Action buttons: Download PDF | Assign Vehicle
```

### Step 4: Assign Vehicle
```
User clicks "Assign Vehicle"
→ showVehicleAssignmentForm()
→ User enters:
  - Vehicle Number
  - Driver Name
  - Remarks (optional)
→ submitVehicleAssignment()
→ Update gatepass with:
  - Status: "Vehicle Assigned"
  - Vehicle Number (new column)
  - Driver Name (new column)
  - Transport Remarks (new column)
  - Assigned By (transport user)
  - Assignment Date
  - Assignment Time
→ PATCH request to SheetBest API
→ Close forms
→ Refresh list
```

## Column Mapping

### Read from Sheet:
- **Column A**: Rows_JSON (parsed as JSON)
- **Column B**: Created Date
- **Column C**: Created Time
- **Column D**: Status (filter: "Pending To Transport")
- **Column E**: Gatepass name
- **Column F**: Approved Manegement User (Management approver)
- **Column G**: Manegement Approve Date
- **Column H**: Manegement Approve Time
- **Column I**: Approved HR User (HR approver)
- **Column J**: HR Approve Date
- **Column K**: HR Approve Time

### Write to Sheet on Vehicle Assignment:
- **Column D**: Status → "Vehicle Assigned"
- **Column L**: Vehicle Number → User input
- **Column M**: Driver Name → User input
- **Column N**: Transport Remarks → User input
- **Column O**: Assigned By → sessionStorage.getItem('sm_user')
- **Column P**: Assignment Date → DD/MM/YYYY
- **Column Q**: Assignment Time → HH:MM:SS

## API Details

### Endpoint:
```
https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse To GFU Gatepass
```

### Fetch Request:
```javascript
GET /tabs/Storse To GFU Gatepass
Response: Array of all rows
Filter client-side: row['Status'] === 'Pending To Transport'
```

### Update Request:
```javascript
PATCH /tabs/Storse To GFU Gatepass/{rowIndex}
Body: {
  "Status": "Vehicle Assigned",
  "Vehicle Number": "CAA-1234",
  "Driver Name": "John Doe",
  "Transport Remarks": "Deliver by 3 PM",
  "Assigned By": "username",
  "Assignment Date": "20/08/2026",
  "Assignment Time": "14:30:45"
}
```

## User Interface

### 📋 Gatepass List Item

```
┌────────────────────────────────────────────────────────────┐
│ [Truck Icon]  Week 34                    [Awaiting Vehicle] │
│               Chanuka                                    [→] │
│               📅 Created: 19/08/2026                         │
│               ✓ HR Approved: 20/08/2026                      │
└────────────────────────────────────────────────────────────┘
```

### 🎨 Color Scheme

**Transport Theme:**
- **Primary:** Teal (#14b8a6)
- **Secondary:** Cyan (#06b6d4)
- **Completed:** Green (#10b981)
- **Pending:** Light teal with dashed border

### 📱 Approval Timeline

```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│   [✓]  ────────  [✓]  --------  [⏳]                         │
│  MGMT  (green)   HR   (dashed)  TRANS                        │
│ Rajesh          Anushka        Pending                        │
│ 20/08/2026     20/08/2026      Assignment                     │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

**Timeline States:**
- ✅ **Completed**: Green circle with checkmark, solid connector
- ⏳ **Pending**: Teal circle with icon, dashed connector

### 🚛 Vehicle Assignment Form

```
┌─────────────────────────────────────────────────────────────┐
│ [Truck] Assign Vehicle                              [X]     │
│         Gatepass: Week 34                                    │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  🚛 Vehicle Number *                                         │
│  [CAA-1234________________]                                  │
│                                                               │
│  🪪 Driver Name *                                            │
│  [John Doe________________]                                  │
│                                                               │
│  💬 Remarks                                                  │
│  [Additional notes...___________]                            │
│  [_____________________________]                             │
│                                                               │
│  ℹ️ Vehicle assignment will update the gatepass status      │
│     and notify relevant departments.                         │
│                                                               │
├─────────────────────────────────────────────────────────────┤
│           [Cancel]              [Assign Vehicle]             │
└─────────────────────────────────────────────────────────────┘
```

## PDF Features

### Teal/Cyan Transport Branding

**Header:**
- Teal background (Transport Department)
- "TRANSPORT DEPT" badge
- "Transportation - SOLE MATRIX" subtitle

**Approval Status Section:**
- Light teal background
- Three badges: ✓ MANAGEMENT | ✓ HR | ⏳ PENDING TRANSPORT
- Compact approval details

**Table:**
- Teal header background
- Teal grand total row

**Footer:**
- Four signature sections:
  - Prepared By
  - Management (with date)
  - HR Approved (with date)
  - Transport (PENDING badge in teal)

**Filename:**
```
Transport_Gatepass_Week34_1724188800000.pdf
```

## Workflow

```
┌─────────────────────────────────────────────────────────────┐
│                    GATEPASS WORKFLOW                         │
└─────────────────────────────────────────────────────────────┘

1. Gatepass Created
   Status: "Pending Approval"
   │
   ▼
2. Management Approves
   Status: "Pending To HR"
   Columns F, G, H filled
   │
   ▼
3. HR Approves
   Status: "Pending To Transport"  ← MODULE STARTS HERE
   Columns I, J, K filled
   │
   ▼
4. Transportation Views List
   Filters: Status = "Pending To Transport"
   │
   ▼
5. Transport User Opens Gatepass
   Views approval timeline
   Downloads PDF (optional)
   │
   ▼
6. Transport Assigns Vehicle
   Enters: Vehicle Number, Driver Name, Remarks
   Status: "Vehicle Assigned"
   Columns L, M, N, O, P, Q filled
   │
   ▼
7. Ready for Dispatch
   Vehicle and driver assigned
   Gatepass complete
```

## Code Structure

### JavaScript Functions (`hr-dashboard.js`)

**Configuration:**
```javascript
const TRANSPORT_CONFIG = {
  SHEET_URL: '...',
  TIMEOUT: 15000,
};

const TransportState = {
  gatepasses: [],
  currentGatepass: null,
};
```

**Core Functions:**
1. `fetchTransportGatepasses()` - Fetch from API
2. `loadTransportGatepasses()` - Load and display
3. `renderTransportGatepassList()` - Render list HTML
4. `renderTransportGatepassItem()` - Render single item
5. `viewTransportGatepass()` - Open preview modal
6. `renderTransportGatepassPreview()` - Render preview HTML
7. `closeTransportGatepassPreview()` - Close preview
8. `downloadTransportGatepass()` - Generate and download PDF
9. `showVehicleAssignmentForm()` - Show assignment form
10. `closeVehicleForm()` - Close form
11. `submitVehicleAssignment()` - Submit vehicle data
12. `updateTransportGatepassStatus()` - Update via API

### CSS Classes (`hr-dashboard.css`)

**Container:**
- `.transport-gatepass-container`
- `.transport-gatepass-item`
- `.transport-gatepass-icon`
- `.transport-pending-badge`

**Preview:**
- `.transport-preview-overlay`
- `.transport-preview-container`
- `.transport-preview-header`
- `.transport-preview-icon`
- `.transport-preview-footer`

**Timeline:**
- `.approval-timeline`
- `.timeline-item`
- `.timeline-icon`
- `.timeline-content`
- `.timeline-connector`
- `.timeline-completed` / `.timeline-pending`

**Form:**
- `.vehicle-form-overlay`
- `.vehicle-form-container`
- `.vehicle-form-header`
- `.vehicle-form-body`
- `.vehicle-form-footer`
- `.form-group`, `.form-label`, `.form-input`, `.form-textarea`
- `.btn-form`, `.btn-cancel`, `.btn-submit`

## Validation

### Form Validation:
```javascript
// Vehicle Number - Required
if (!vehicleNumber) {
  alert('Please enter the vehicle number.');
  return;
}

// Driver Name - Required
if (!driverName) {
  alert('Please enter the driver name.');
  return;
}

// Remarks - Optional
```

### Input Sanitization:
All displayed values pass through `sanitizeHTML()` to prevent XSS attacks.

## Error Handling

### Network Errors:
- Timeout after 15 seconds
- Error state with retry button
- User-friendly error messages

### Data Errors:
- JSON parsing failures caught and logged
- Fallback to empty object
- Alert shown to user

### Update Errors:
- Row not found: specific error message
- API errors: display status and response
- Button re-enabled on failure

## Mobile Responsiveness

### Tablet (≤768px):
- Timeline changes to vertical layout
- Connectors become vertical (3px width)
- Preview footer buttons stack
- Form buttons stack

### Mobile (≤480px):
- Timeline items reduced width
- Smaller font sizes
- Touch-friendly button sizes
- Reduced padding

## Security

### Authentication:
- Requires valid HR Department session
- Username retrieved from sessionStorage
- Department verified at dashboard level

### Input Sanitization:
- All displayed values sanitized
- Prevents XSS attacks
- Special characters escaped

### Validation:
- Required fields enforced
- Confirmation dialogs
- Prevents accidental submissions

## Testing Checklist

### Functionality:
- [ ] Transportation module loads from HR dashboard
- [ ] List displays "Pending To Transport" gatepasses
- [ ] Gatepass cards show correct information
- [ ] Click opens preview modal
- [ ] Approval timeline displays correctly
- [ ] Download PDF generates teal-themed PDF
- [ ] PDF includes full approval chain
- [ ] "Assign Vehicle" button opens form
- [ ] Form validates required fields
- [ ] Submit updates gatepass status
- [ ] Status changes to "Vehicle Assigned"
- [ ] Vehicle data written to correct columns
- [ ] List refreshes after assignment
- [ ] Empty state shows when no gatepasses
- [ ] Refresh button works

### UI/UX:
- [ ] Teal/cyan theme throughout
- [ ] Timeline animation smooth
- [ ] Form appears with animation
- [ ] Buttons have hover effects
- [ ] Icons display correctly
- [ ] Loading spinner shows during fetch
- [ ] Success message displays after assignment
- [ ] Forms close on Escape key
- [ ] Preview closes on backdrop click

### Error Handling:
- [ ] Network errors show retry option
- [ ] Invalid JSON handled gracefully
- [ ] Missing data shows "N/A"
- [ ] Form validates empty fields
- [ ] API errors display user-friendly messages

### Mobile:
- [ ] Timeline stacks vertically on mobile
- [ ] Form is usable on small screens
- [ ] Buttons are touch-friendly
- [ ] Text is readable
- [ ] No horizontal scroll

## Future Enhancements

### 1. Real-Time Tracking
- GPS integration for vehicle tracking
- Live status updates
- Delivery time estimates
- Route optimization

### 2. Driver Management
- Driver database integration
- Auto-fill driver name from vehicle
- Driver availability checking
- Performance tracking

### 3. Notifications
- SMS/Email to driver upon assignment
- Push notifications to transport team
- Delivery confirmation alerts
- Delay notifications

### 4. Analytics
- Average assignment time
- Vehicle utilization rates
- Driver performance metrics
- Delivery success rates

### 5. Batch Operations
- Assign multiple gatepasses to one vehicle
- Bulk status updates
- Route planning for multiple deliveries
- Print batch delivery notes

---

**Implementation Date:** August 20, 2026  
**Developer:** Kiro AI Assistant  
**Version:** 1.0  
**Status:** ✅ Complete and Ready for Testing
