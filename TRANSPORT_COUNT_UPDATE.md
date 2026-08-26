# Transportation Pending Count - Dynamic Update

## Overview
Updated the Transportation card on the HR Dashboard to display the actual count of pending transport assignments dynamically instead of showing a static "8 Active Routes" text.

## Changes Made

### 1. State Management (`assets/js/hr-dashboard.js`)

**Added `pendingTransportCount` to HRState:**
```javascript
const HRState = {
  currentUser: null,
  currentDept: null,
  currentModule: null,
  pendingGatepassCount: 0,
  pendingTransportCount: 0,  // ✨ NEW
};
```

### 2. New Function: `loadPendingTransportCount()`

**Purpose:** Fetches and counts gatepasses with "Pending To Transport" status

**Implementation:**
```javascript
async function loadPendingTransportCount() {
  try {
    // Fetch all gatepasses from sheet
    const response = await fetch(SHEET_URL, { method: 'GET' });
    const data = await response.json();
    
    // Count only "Pending To Transport" gatepasses
    const pendingCount = data.filter(row => 
      row['Status']?.trim() === 'Pending To Transport'
    ).length;

    // Update state and UI
    HRState.pendingTransportCount = pendingCount;
    updatePendingTransportBadge(pendingCount);
    
  } catch (error) {
    console.error('Error loading transport count:', error);
  }
}
```

### 3. New Function: `updatePendingTransportBadge(count)`

**Purpose:** Updates the badge count on the Transportation card

**Implementation:**
```javascript
function updatePendingTransportBadge(count) {
  const badge = document.querySelector('.hr-card-transport .badge-count');
  if (badge) {
    badge.textContent = count;
  }
}
```

### 4. Dashboard Initialization Update

**Modified `initDashboard()`:**
```javascript
function initDashboard() {
  updateUserInfo();
  updateGreeting();
  updateStatToday();
  loadPendingGatepassCount();
  loadPendingTransportCount();  // ✨ NEW - Load transport count on init
}
```

### 5. Auto-Update After Vehicle Assignment

**Updated `submitVehicleAssignment()`:**
```javascript
async function submitVehicleAssignment() {
  // ... assignment logic ...
  
  closeVehicleForm();
  closeTransportGatepassPreview();
  await loadTransportGatepasses();
  await loadPendingTransportCount();  // ✨ NEW - Refresh count
}
```

### 6. HTML Update (`hr-dashboard.html`)

**Changed Transportation Card Badge:**

**Before:**
```html
<span class="card-tag"><i class="fa-solid fa-route"></i> Fleet</span>
<div class="card-badge-status">
  <span class="status-dot active"></span>
  <span class="badge-label">8 Active Routes</span>
</div>
```

**After:**
```html
<span class="card-tag"><i class="fa-solid fa-truck"></i> Transport</span>
<div class="card-badge-notification">
  <span class="badge-count">0</span>
  <span class="badge-label">Pending</span>
</div>
```

## How It Works

### On Dashboard Load:
```
1. User logs in as HR
2. Dashboard initializes
3. loadPendingTransportCount() called
4. Fetch all gatepasses from sheet
5. Filter: Status === "Pending To Transport"
6. Count filtered gatepasses
7. Update badge with actual count
```

### After Vehicle Assignment:
```
1. User assigns vehicle to gatepass
2. Status updated to "Vehicle Assigned"
3. Forms close
4. Gatepass list refreshes
5. loadPendingTransportCount() called again
6. New count fetched and displayed
7. Badge shows updated count (decreased by 1)
```

## UI Changes

### Before:
```
┌─────────────────────────────────────────────┐
│ 02 Transportation                           │
│ Schedule and track...                       │
│                                             │
│ [Fleet]          [● 8 Active Routes]    [→] │
└─────────────────────────────────────────────┘
```

### After:
```
┌─────────────────────────────────────────────┐
│ 02 Transportation                           │
│ Schedule and track...                       │
│                                             │
│ [Transport]      [5 Pending]            [→] │
└─────────────────────────────────────────────┘
```

**Changes:**
- ❌ Removed: "8 Active Routes" (static text)
- ❌ Removed: Green status dot
- ❌ Removed: "Fleet" tag icon
- ✅ Added: Dynamic count badge "X Pending"
- ✅ Added: Amber/gold notification badge styling
- ✅ Added: Truck icon in tag

## Badge Styling

The Transportation badge now uses the same notification badge style as the Gatepass card:

**CSS Classes:**
- `.card-badge-notification` - Container with amber background
- `.badge-count` - Large number with gold color and glow
- `.badge-label` - "Pending" text in uppercase

**Visual Style:**
- Amber/gold background with transparency
- Border with amber tint
- Pulse animation
- Number with text shadow and glow
- Matches the gatepass notification badge

## Benefits

### ✅ Real-Time Accuracy
- Shows actual count from Google Sheet
- No hardcoded values
- Reflects current pending assignments

### ✅ Auto-Update
- Refreshes on dashboard load
- Updates after vehicle assignment
- Stays synchronized with sheet data

### ✅ Consistent Design
- Matches Gatepass card styling
- Uses same notification badge component
- Consistent color scheme (amber/gold for pending items)

### ✅ Better User Experience
- Clear indication of pending work
- Immediate feedback after actions
- Helps prioritize tasks

### ✅ Error Handling
- Gracefully handles fetch failures
- Logs errors to console
- Doesn't break dashboard if API fails
- Shows "0" if no data available

## API Details

### Endpoint:
```
GET https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse To GFU Gatepass
```

### Filter Logic:
```javascript
const pendingCount = data.filter(row => {
  const status = String(row['Status'] || '').trim();
  return status === 'Pending To Transport';
}).length;
```

### Status Values Counted:
- ✅ Counts: `"Pending To Transport"` (exact match)
- ❌ Ignores: All other status values

## Synchronization

### Both Counts Load Together:
```javascript
function initDashboard() {
  updateUserInfo();
  updateGreeting();
  updateStatToday();
  loadPendingGatepassCount();     // Gatepass badge
  loadPendingTransportCount();    // Transport badge
}
```

### Counts Update After Actions:
- **Gatepass Badge**: Updates after HR approves/rejects
- **Transport Badge**: Updates after vehicle assignment

### Independent Fetches:
- Each badge has its own API call
- Failures don't affect each other
- Both use the same endpoint but filter differently

## Performance

### Network Requests:
- **On Load:** 2 requests (1 for gatepass, 1 for transport)
- **After Gatepass Action:** 1 request (gatepass count only)
- **After Transport Action:** 1 request (transport count only)
- **Total:** Minimal overhead

### Optimization Opportunities:
- Could combine both counts into single API call
- Could add caching with TTL
- Could use polling for real-time updates
- Could implement WebSocket for instant sync

## Testing Checklist

### Badge Display:
- [ ] Badge shows "0" when no pending gatepasses
- [ ] Badge shows correct count on dashboard load
- [ ] Count matches actual "Pending To Transport" in sheet
- [ ] Count uses amber/gold notification styling
- [ ] Badge label says "Pending" not "Active Routes"
- [ ] Truck icon displays instead of route icon

### Count Updates:
- [ ] Count loads automatically on dashboard init
- [ ] Count decreases after vehicle assignment
- [ ] Count updates without page refresh
- [ ] No console errors during fetch
- [ ] Works when API is slow
- [ ] Handles API errors gracefully

### Visual Consistency:
- [ ] Transport badge matches Gatepass badge style
- [ ] Amber/gold color scheme consistent
- [ ] Pulse animation works
- [ ] Badge size and spacing consistent
- [ ] Icon and text aligned properly

### Integration:
- [ ] Both badges load simultaneously
- [ ] Independent updates work correctly
- [ ] No conflicts between the two
- [ ] Dashboard loads smoothly
- [ ] Counts remain accurate after multiple actions

## Future Enhancements

### 1. Combined API Call
Fetch both counts in a single request:
```javascript
async function loadAllCounts() {
  const data = await fetchGatepasses();
  const hrCount = data.filter(row => row.Status === 'Pending To HR').length;
  const transportCount = data.filter(row => row.Status === 'Pending To Transport').length;
  
  updatePendingGatepassBadge(hrCount);
  updatePendingTransportBadge(transportCount);
}
```

### 2. Real-Time Updates
- Poll every 30-60 seconds
- Update counts automatically
- Show notification when count changes

### 3. Badge Details
- Hover to see breakdown
- Click to open module directly
- Show oldest pending item age

### 4. Visual Indicators
- Pulse faster when count is high
- Change color based on urgency
- Show trend (increasing/decreasing)

---

**Implementation Date:** August 20, 2026  
**Developer:** Kiro AI Assistant  
**Version:** 1.1  
**Status:** ✅ Complete and Ready for Testing
