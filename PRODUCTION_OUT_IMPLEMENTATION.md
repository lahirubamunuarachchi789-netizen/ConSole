# Production Out Module Implementation

## Overview
The Production Out module allows Outsole Production users to dispatch completed items from the production floor. It features QR code scanning, manual entry, quantity input, and submit functionality.

## Features

### 1. QR Code Scanning
- **Camera-based scanning**: Uses the device camera to scan QR codes
- **Switch camera**: Toggle between front and rear cameras
- **Real-time feedback**: Visual scanning line animation and status updates
- **Auto-detection**: Automatically captures QR code when detected

### 2. Manual QR Entry
- **Tab switching**: Switch between Scan and Manual Entry modes
- **Keyboard input**: Manually type or paste QR code values
- **Enter key support**: Press Enter to submit manual entry
- **Look Up button**: Explicitly trigger QR code lookup

### 3. Item Lookup
The system looks up scanned QR codes in the "Stores Out" sheet and validates:
- **Record exists**: QR code matches a kitting record
- **Production In verified**: Item has been verified through Production In module
- **Status check**: Ensures item is ready for dispatch

### 4. Quantity Input
- **Available quantity display**: Shows the maximum available quantity
- **Input validation**: Ensures quantity is valid and within limits
- **Min/Max constraints**: Quantity must be at least 1 and not exceed available stock
- **Clear hint**: Visual indication of maximum allowed quantity

### 5. Dispatch Submission
- **Confirmation prompt**: Asks user to confirm before dispatching
- **Real-time updates**: Updates the Stores Out sheet with dispatch information
- **Quantity management**: Reduces available quantity by dispatched amount
- **Audit trail**: Records dispatch user, date, and time

## User Flow

```
1. User opens Production Out module
2. User scans QR code OR manually enters it
3. System looks up item in Stores Out sheet
4. System validates item is verified (Production In completed)
5. System displays item details (PO, Model, Colour, Size, Available QTY)
6. User enters dispatch quantity
7. User clicks Submit button
8. System confirms dispatch with user
9. System updates sheet with dispatch info
10. Success screen shows dispatch details
11. User can scan next item
```

## Data Flow

### Sheet: Stores Out
**Columns Updated:**
- `QTY` (Column G): Reduced by dispatched quantity
- `Production Out` (Column P): Set to "Dispatched"
- `Dispatched Qty` (Column Q): Amount dispatched
- `Dispatched User` (Column R): User who performed dispatch
- `Dispatched Date` (Column S): Date of dispatch (DD/MM/YYYY)
- `Dispatched Time` (Column T): Time of dispatch (HH:MM:SS)

### API Endpoint
```javascript
PATCH ${CONFIG.SHEETBEST_STORESOUT_URL}/QR_Code/{qrCode}
```

## Files Created

### JavaScript
- `assets/js/production-out.js` (15KB)
  - QR scanner initialization and management
  - Tab switching logic
  - Item lookup and validation
  - Quantity validation
  - Dispatch submission
  - Success/error handling
  - Toast notifications

### CSS
- `assets/css/production-out.css` (21KB)
  - Modal styling with orange theme (#f97316)
  - QR viewport with scanning animation
  - Tab bar styling
  - Form input styling
  - Details card layout
  - Success/error states
  - Responsive design

### Integration
- Updated `outsole-dashboard.js` to handle Production Out module
- Updated `outsole-dashboard.html` to include CSS and JS files

## UI Components

### 1. Header Section
- Module icon (orange)
- Title: "Production Out"
- Subtitle: "Dispatch Items from Production Floor"

### 2. QR Code Section
- Tab bar: Scan QR / Manual Entry
- QR viewport with corner markers and scanning line
- Camera switch button
- Manual input field with Look Up button
- QR result badge showing captured code

### 3. Item Details Card
- Header with QR code and verification badge
- Grid layout showing:
  - PO Number
  - Model
  - Outsole Colour
  - Size (EU)
  - Available QTY (highlighted in orange)
  - MRN Reference

### 4. Dispatch Block
- Information hint
- Quantity input field with label and icon
- Maximum quantity hint
- Cancel and Submit buttons

### 5. Success Screen
- Large success icon with bounce animation
- Confirmation message
- Summary grid showing:
  - QR Code
  - Dispatched Qty (highlighted in orange)
  - Model
  - Status: "Dispatched" (green)
- "Scan Next Item" button

### 6. Error States
- **Not Found**: QR code doesn't exist
- **Not Verified**: Item not processed through Production In
- **Lookup Failed**: Network or sheet error

## Validation Rules

1. **QR Code Required**: Cannot proceed without QR code
2. **Item Must Exist**: QR code must match a record
3. **Verification Required**: Item must have been verified in Production In (Vrification column populated)
4. **Quantity Minimum**: Must be at least 1
5. **Quantity Maximum**: Cannot exceed available stock
6. **Numeric Only**: Quantity must be a valid integer
7. **Confirmation Required**: User must confirm dispatch

## Color Theme
The module uses an **orange gradient theme** to distinguish it from Production In (green):
- Primary: `#f97316` (Orange 500)
- Secondary: `#ea580c` (Orange 600)
- Light: `#fb923c` (Orange 400)
- Very Light: `#fdba74` (Orange 300)

## Dependencies
- **html5-qrcode**: QR code scanning library (loaded from CDN)
- **CONFIG.SHEETBEST_STORESOUT_URL**: API endpoint for Stores Out sheet
- **Session Storage**: User authentication (`sm_user`)

## Browser Compatibility
- Requires camera access for QR scanning
- Falls back to manual entry if camera unavailable
- Responsive design works on mobile and desktop
- Supports both front and rear cameras

## Security Features
- Session validation (requires authenticated user)
- Department validation (Outsole Production only)
- Confirmation prompts for dispatch actions
- Input sanitization (HTML escaping)
- Error handling for all API calls

## Future Enhancements
Potential improvements:
1. Batch dispatching (multiple items at once)
2. Dispatch history view
3. Print dispatch labels
4. Barcode support (in addition to QR codes)
5. Partial dispatch tracking
6. Return/undo dispatch functionality
7. Export dispatch reports
8. Real-time stock level updates
9. Low stock alerts
10. Integration with Pack To Bin module

## Testing Checklist
- [ ] QR scanner activates correctly
- [ ] Manual entry works
- [ ] Tab switching functions properly
- [ ] Camera switch toggles between front/rear
- [ ] Item lookup validates correctly
- [ ] Not verified items are rejected
- [ ] Non-existent QR codes show error
- [ ] Quantity validation works (min/max)
- [ ] Dispatch updates sheet correctly
- [ ] Success screen displays proper data
- [ ] Toast notifications appear
- [ ] Modal closes properly
- [ ] QR scanner stops when modal closes
- [ ] Responsive layout works on mobile
- [ ] Error handling covers all cases

## Support
For issues or questions, contact the development team.
