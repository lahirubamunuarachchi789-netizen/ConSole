# HR Department - Gatepass Management Implementation

## Overview
This document describes the implementation of the HR Department's gatepass management functionality, which allows HR users to review and approve gatepasses that have been approved by the Management Department.

## What Was Implemented

### 1. HR Gatepass Module (`assets/js/hr-dashboard.js`)

#### Key Functions Added:

**`fetchHRGatepasses()`**
- Fetches gatepasses from the "Storse To GFU Gatepass" sheet
- Filters only gatepasses with Status = "Pending To HR" (Column D)
- Returns filtered array of pending HR gatepasses

**`loadHRGatepasses()`**
- Main function to load and display HR gatepasses
- Shows loading spinner during fetch
- Renders gatepass list or error state
- Handles errors with retry option

**`renderHRGatepassList(gatepasses)`**
- Renders the list of pending HR gatepasses
- Shows count of pending approvals
- Includes refresh button
- Displays empty state when no gatepasses

**`renderHRGatepassItem(gatepass, index)`**
- Renders individual gatepass card
- Shows gatepass name, employee name, dates
- Displays management approval info
- Shows "Pending HR" status badge

**`viewHRGatepass(index)`**
- Opens full-screen preview modal
- Parses JSON data from Column A
- Displays detailed gatepass information
- Shows management approval metadata

**`renderHRGatepassPreview(gatepass, data)`**
- Renders professional gatepass document
- Shows company branding and headers
- Displays approval information section
- Includes items table with sizes/quantities
- Shows signature sections

**`buildHRItemsTable(data)`**
- Builds items table from JSON data
- Supports both simple (Size/QTY) and complex (QTY object) formats
- Calculates row and column totals
- Displays grand total

**`approveHRGatepass()`**
- Handles HR approval action
- Shows confirmation dialog
- Updates Status to "Pending To Transport"
- Records HR approval metadata (Columns I, J, K):
  - Approved HR User
  - HR Approve Date
  - HR Approve Time
- Refreshes gatepass list

**`rejectHRGatepass()`**
- Handles rejection action
- Prompts for rejection reason
- Updates Status to "Rejected"
- Records rejection metadata
- Refreshes gatepass list

**`updateHRGatepassStatus(rowData, newStatus, extraFields)`**
- Updates gatepass status in Google Sheet
- Finds row by gatepass name
- Uses PATCH request to update specific row
- Updates Status and additional fields

**`closeHRGatepassPreview()`**
- Closes preview modal with animation
- Cleans up DOM elements

**`downloadHRGatepass()`**
- Placeholder for PDF download functionality
- Will be implemented with jsPDF library

### 2. Module Content Integration

**`getGatepassContent()` - Modified**
- Changed from placeholder content to functional module
- Loads HR gatepasses automatically on module open
- Shows loading spinner initially
- Container: `#hrGatepassContainer`

### 3. CSS Styling (`assets/css/hr-dashboard.css`)

Added comprehensive styles for:
- HR gatepass container
- Loading and error states
- Gatepass list items with HR-specific theming
- Purple/violet color scheme (HR brand colors)
- Management approval info section
- Preview overlay and modal
- Responsive design for mobile devices
- Smooth animations and transitions
- Status badges and icons

#### Key Style Features:
- Purple gradient theme (`--hr-primary: #7c3aed`)
- Interactive hover effects
- Status badges (Pending HR)
- Approval info section with amber background
- Professional document layout
- Mobile-responsive design

## Data Flow

### Step 1: HR User Opens Gatepass Module
```
User clicks "Pending Gatepass" → getGatepassContent() called
→ setTimeout triggers loadHRGatepasses() after 100ms
```

### Step 2: Fetch Gatepasses
```
loadHRGatepasses() → fetchHRGatepasses()
→ GET request to SheetBest API
→ Filter where Status === "Pending To HR"
→ Return filtered array
```

### Step 3: Display List
```
renderHRGatepassList(gatepasses)
→ For each gatepass: renderHRGatepassItem()
→ Show gatepass name, employee name, created date
→ Show management approver and approval date
→ Display "Pending HR" badge
```

### Step 4: View Gatepass Details
```
User clicks gatepass → viewHRGatepass(index)
→ Parse JSON from Column A
→ renderHRGatepassPreview()
→ Display full document with:
  - Company header
  - Gatepass info
  - Management approval section (green badge)
  - Items table
  - Action buttons
```

### Step 5: HR Approval
```
User clicks "Approve for Release" → approveHRGatepass()
→ Show confirmation dialog
→ Capture HR user, date, time
→ updateHRGatepassStatus() with:
  - Status: "Pending To Transport"
  - Approved HR User: username
  - HR Approve Date: DD/MM/YYYY
  - HR Approve Time: HH:MM:SS
→ PATCH request to SheetBest API
→ Close preview
→ Refresh list (gatepass no longer appears)
```

### Step 6: HR Rejection
```
User clicks "Reject" → rejectHRGatepass()
→ Prompt for rejection reason
→ updateHRGatepassStatus() with:
  - Status: "Rejected"
  - HR metadata + Rejection Reason
→ PATCH request to SheetBest API
→ Close preview
→ Refresh list (gatepass no longer appears)
```

## Column Mapping

### Read from Sheet:
- **Column A**: Rows_JSON (parsed as JSON)
- **Column B**: Created Date
- **Column C**: Created Time
- **Column D**: Status (filter: "Pending To HR")
- **Column E**: Gatepass name
- **Column F**: Approved Manegement User
- **Column G**: Manegement Approve Date
- **Column H**: Manegement Approve Time

### Write to Sheet on HR Approval:
- **Column D**: Status → "Pending To Transport"
- **Column I**: Approved HR User → sessionStorage.getItem('sm_user')
- **Column J**: HR Approve Date → DD/MM/YYYY
- **Column K**: HR Approve Time → HH:MM:SS

## API Details

### Endpoint:
```
https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse To GFU Gatepass
```

### Fetch Request:
```javascript
GET /tabs/Storse To GFU Gatepass
Response: Array of all rows
Filter client-side: row['Status'] === 'Pending To HR'
```

### Update Request:
```javascript
PATCH /tabs/Storse To GFU Gatepass/{rowIndex}
Body: {
  "Status": "Pending To Transport",
  "Approved HR User": "username",
  "HR Approve Date": "20/08/2026",
  "HR Approve Time": "14:30:45"
}
```

## User Experience

### Empty State:
When no gatepasses are pending HR approval:
- Shows clipboard check icon
- Message: "No gatepasses pending HR approval"
- Subtext: "All gatepasses have been processed"

### Gatepass Card:
- Purple gradient icon with ID card
- Gatepass name (bold, large)
- Employee name with user icon
- Created date with calendar icon
- Management approval info with checkmark icon
- "Pending HR" badge (purple)
- Chevron arrow on hover

### Preview Modal:
- Full-screen overlay with blur backdrop
- Professional document layout
- Company branding at top
- Four-column info grid
- Green approval badge: "Management Approved"
- Approval details: Approved By, Date, Time
- Items table (adapts to data structure)
- Three action buttons at bottom:
  - Download (amber)
  - Reject (red)
  - Approve for Release (purple)

## Error Handling

### Network Errors:
- Timeout after 15 seconds
- Error state with retry button
- User-friendly error messages

### Data Errors:
- JSON parsing failures caught and logged
- Fallback to empty object if parse fails
- Alert shown to user

### Update Errors:
- Row not found: specific error message
- API errors: display status and response
- Button re-enabled on failure

## Mobile Responsiveness

### Tablet (≤768px):
- Gatepass cards stack vertically
- Status badges full width
- Metadata items in column
- Preview footer buttons stack
- Approval details single column

### Mobile (≤480px):
- Header elements stack
- Refresh button full width
- Single column layout
- Reduced padding
- Touch-friendly button sizes

## Security & Validation

### Authentication:
- Requires valid HR Department session
- Username retrieved from sessionStorage
- Department verified at dashboard level

### Input Sanitization:
- All displayed values pass through sanitizeHTML()
- Prevents XSS attacks
- Removes dangerous characters

### Confirmation Dialogs:
- Approval requires confirmation
- Rejection requires reason input
- Prevents accidental actions

## Integration Points

### With Management Dashboard:
- Management approves → Status becomes "Pending To HR"
- Management writes approval to Columns F, G, H
- HR reads these columns to show approval info

### With Google Sheet:
- Reads all columns via SheetBest API
- Updates specific row by index
- Maintains data integrity

### With Session Management:
- Reads sm_user from sessionStorage
- Records HR approver username
- Validates department access

## Testing Checklist

- [ ] HR user can view list of "Pending To HR" gatepasses
- [ ] Gatepass cards show correct information
- [ ] Management approval info displays correctly
- [ ] Preview modal opens and displays full details
- [ ] Items table renders correctly for all data formats
- [ ] Approve button updates Status to "Pending To Transport"
- [ ] HR approval metadata written to Columns I, J, K
- [ ] Reject button prompts for reason
- [ ] Rejected gatepasses update correctly
- [ ] List refreshes after approval/rejection
- [ ] Empty state shows when no gatepasses
- [ ] Loading spinner appears during fetch
- [ ] Error state shows on network failure
- [ ] Retry button works correctly
- [ ] Refresh button updates list
- [ ] Preview closes on Escape key
- [ ] Preview closes on backdrop click
- [ ] Mobile layout works correctly
- [ ] Animations are smooth
- [ ] No console errors

## Future Enhancements

### PDF Generation:
- Implement jsPDF library
- Generate professional PDF documents
- Include company logo and branding
- Support landscape orientation
- Add page numbers and footers

### Notifications:
- Email notifications to HR on new gatepasses
- SMS alerts for urgent approvals
- Push notifications in browser

### Analytics:
- Track approval times
- Generate approval reports
- Dashboard statistics
- Historical data analysis

### Audit Trail:
- Complete approval history
- User action logs
- Timestamp all changes
- Export audit reports

---

**Implementation Date:** August 20, 2026  
**Developer:** Kiro AI Assistant  
**Version:** 1.0  
**Status:** ✅ Complete and Ready for Testing
