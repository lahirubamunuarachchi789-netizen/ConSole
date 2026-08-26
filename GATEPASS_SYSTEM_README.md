# Gatepass Management System

## Overview
The Gatepass Management System allows authorized users to review, approve, and manage employee gatepasses from the "Storse To GFU Gatepass" Google Sheet.

### User Roles:
- **Management Department**: Reviews initial gatepass submissions and approves them for HR review
- **HR Department**: Reviews management-approved gatepasses and gives final approval for release

## Features

### Management Department Features

#### 1. **Gatepass List View**
- Displays all gatepasses with status "Pending Approval" from Column D
- Shows gatepass name, employee name, created date, and time
- Real-time count of pending approvals
- Refresh button to reload the list
- Empty state when no pending gatepasses

#### 2. **Professional Gatepass Preview**
When a Management user clicks on a gatepass, a full-screen modal displays detailed information

#### 3. **Action Buttons**
- **Download**: Downloads gatepass as a formatted document
- **Share**: Shares gatepass summary information
- **Approve**: Updates Status to "Pending To HR" and records approval metadata

### HR Department Features

#### 1. **HR Gatepass List View**
- Displays all gatepasses with status "Pending To HR" from Column D
- Shows gatepass name, employee name, created date, and management approval info
- Real-time count of pending HR approvals
- Refresh button to reload the list
- Empty state when no gatepasses pending HR approval

#### 2. **HR Gatepass Preview**
Full-screen modal showing:
- Complete gatepass details from JSON in Column A
- Management approval information (Columns F, G, H)
- Items table with sizes and quantities
- Professional document layout with company branding

#### 3. **HR Action Buttons**
- **Download**: Downloads gatepass as formatted document
- **Reject**: Rejects the gatepass with reason
- **Approve for Transport**: Final approval, updates Status to "Pending To Transport"

## Approval Workflow

### Stage 1: Management Review
1. Gatepass created with Status = "Pending Approval" (Column D)
2. Management user logs in and opens "Pending Gatepass" module
3. Management reviews gatepass details
4. On approval:
   - Status changes to "Pending To HR"
   - Columns F, G, H updated with:
     - F: "Approved Manegement User" (approver username)
     - G: "Manegement Approve Date" (approval date)
     - H: "Manegement Approve Time" (approval time)

### Stage 2: HR Review
1. HR user logs in and opens "Pending Gatepass" module
2. System displays gatepasses where Status = "Pending To HR"
3. HR reviews gatepass and management approval details
4. HR can either:
   - **Approve**: Status changes to "Pending To Transport"
     - Columns I, J, K updated with HR approval metadata
     - Gatepass forwarded to Transport Department
   - **Reject**: Status changes to "Rejected"
     - Rejection reason recorded

### Stage 3: Transport Processing
1. Transport Department views gatepasses with Status = "Pending To Transport"
2. Transport arranges vehicle and logistics
3. Final processing and release

### Status Flow
```
Pending Approval → Pending To HR → Pending To Transport → [Transport Processing]
                                 → Rejected
```

## Document Details

### Data Structure (from JSON in Column A):
- **Gatepass ID** - From "Gatepass name" column
- **Employee Name** - GatepassName field
- **Created By** - CreatedBy field
- **Channel/Unit** - Chanula field
- **Created Date** - CreateDate field
- **Created Time** - CreateTime field
- **Item Count** - ItemsC field
- **Total Qty** - TotalQty field
- **GFL Code** - GFL_Code field
- **PO Number** - PO field
- **Model** - Model field
- **Elite** - Elite field
- **Outsole Colour** - Outsole_Colour field
- **F-Gun** - F_Gun field
- **Size** - Size field
- **Current Status** - From Status column

### 3. **Action Buttons**

#### Download
- Downloads gatepass as a formatted text file (.txt)
- Includes all gatepass details in a professional format
- File naming: `Gatepass_{Name}_{Timestamp}.txt`

#### Share
- Uses native share API if available
- Falls back to clipboard copy
- Shares gatepass summary information

#### Approve
- Updates the Status in Column D to "Pending To HR"
- Shows confirmation dialog before approval
- Displays success message
- Automatically refreshes the gatepass list
- Closes the preview modal

### 4. **Professional Design**
- Gold/Amber theme matching Management branding
- Full-screen preview modal with backdrop blur
- Professional document layout with company header
- Responsive design for all screen sizes
- Smooth animations and transitions
- Loading states for all async operations

## Technical Implementation

### Management Dashboard Integration
- **File**: `management-dashboard.html` and `assets/js/management-dashboard.js`
- **API Endpoint**: SheetBest API (Storse To GFU Gatepass tab)
- **Filters**: Status = "Pending Approval"
- **Updates**: Status → "Pending To HR", Columns F, G, H

### HR Dashboard Integration
- **File**: `hr-dashboard.html` and `assets/js/hr-dashboard.js`
- **API Endpoint**: SheetBest API (Storse To GFU Gatepass tab)
- **Filters**: Status = "Pending To HR"
- **Updates**: Status → "Pending To Transport" or "Rejected", Columns I, J, K

### API Integration
- **Endpoint**: SheetBest API
- **Sheet**: "Storse To GFU Gatepass" tab
- **Data Source**: Column A (JSON format)
- **Status Column**: Column D

### Data Flow

#### Management Flow:
1. Fetch all rows from "Storse To GFU Gatepass" sheet
2. Filter rows where Status = "Pending Approval"
3. Parse JSON from Column A (Rows_JSON)
4. Display in list view
5. On approve: 
   - Update Status to "Pending To HR"
   - Write approval metadata to Columns F, G, H
6. Refresh list to show updated data

#### HR Flow:
1. Fetch all rows from "Storse To GFU Gatepass" sheet
2. Filter rows where Status = "Pending To HR"
3. Parse JSON from Column A (Rows_JSON)
4. Display in list view with management approval info
5. On approve:
   - Update Status to "Pending To Transport"
   - Write HR approval metadata to Columns I, J, K
6. On reject:
   - Update Status to "Rejected"
   - Write rejection info
7. Refresh list to show updated data

### Files Modified/Created
- `assets/css/hr-dashboard.css` - HR-specific styling including gatepass UI
- `assets/js/hr-dashboard.js` - HR dashboard functionality with gatepass management
- `assets/css/gatepass-management.css` - Shared gatepass styling
- `assets/js/gatepass-management.js` - Management gatepass functionality
- Integrated into `management-dashboard.html` and `hr-dashboard.html`

## Usage

### For Management Users:
1. Login as Management user
2. Click on "Pending Gatepass" card
3. View list of gatepasses pending management approval
4. Click on any gatepass to preview
5. Review gatepass details
6. Choose action:
   - Download for records
   - Share with others
   - Approve to send to HR Department
7. Status automatically updates to "Pending To HR"

### For HR Users:
1. Login as HR Department user
2. Click on "Pending Gatepass" card
3. View list of gatepasses pending HR approval (already approved by Management)
4. Click on any gatepass to preview
5. Review gatepass details and management approval info
6. Choose action:
   - Download for records
   - Reject with reason
   - Approve to send to Transport Department
7. Status automatically updates to "Pending To Transport" or "Rejected"

## Sheet Structure Expected

### Columns:
- **A**: Rows_JSON (JSON data with all gatepass details)
- **B**: Created Date
- **C**: Created Time
- **D**: Status ("Pending Approval", "Pending To HR", "Pending To Transport", "Rejected")
- **E**: Gatepass name
- **F**: Approved Manegement User (Management approver username)
- **G**: Manegement Approve Date (Management approval date)
- **H**: Manegement Approve Time (Management approval time)
- **I**: Approved HR User (HR approver username)
- **J**: HR Approve Date (HR approval date)
- **K**: HR Approve Time (HR approval time)

### JSON Structure in Column A:
```json
{
  "GatepassName": "Employee Name",
  "CreatedBy": "Creator Name",
  "Chanula": "Channel/Unit",
  "CreateDate": "Date",
  "CreateTime": "Time",
  "ItemsC": "Item Count",
  "TotalQty": "Total Quantity",
  "GFL_Code": "GFL Code",
  "PO": "PO Number",
  "Model": "Model",
  "Elite": "Elite",
  "Outsole_Colour": "Outsole Colour",
  "F_Gun": "F-Gun",
  "Size": "Size"
}
```

## Error Handling
- Network timeouts (15 seconds)
- API errors with user-friendly messages
- JSON parsing errors
- Empty states for no data
- Retry functionality on failures

## Security
- Session-based authentication
- Management-only access
- Confirmation dialogs for approval actions
- Input sanitization for XSS protection

---

© 2026 Concord Footwear (Pvt) Ltd — SOLE MATRIX v1.0
