# Pending Gatepass Count - Dynamic Update

## Overview
Updated the HR Dashboard to display the actual count of pending gatepasses dynamically instead of showing a static hardcoded value.

## Changes Made

### 1. State Management (`assets/js/hr-dashboard.js`)

**Added `pendingGatepassCount` to HRState:**
```javascript
const HRState = {
  currentUser: null,
  currentDept: null,
  currentModule: null,
  pendingGatepassCount: 0,  // ✨ NEW
};
```

### 2. New Function: `loadPendingGatepassCount()`

**Purpose:** Fetches and counts gatepasses with "Pending To HR" status

**Implementation:**
```javascript
async function loadPendingGatepassCount() {
  try {
    // Fetch all gatepasses from sheet
    const response = await fetch(SHEET_URL, { method: 'GET' });
    const data = await response.json();
    
    // Count only "Pending To HR" gatepasses
    const pendingCount = data.filter(row => 
      row['Status']?.trim() === 'Pending To HR'
    ).length;

    // Update state and UI
    HRState.pendingGatepassCount = pendingCount;
    updatePendingGatepassBadge(pendingCount);
    
  } catch (error) {
    console.error('Error loading count:', error);
  }
}
```

### 3. New Function: `updatePendingGatepassBadge(count)`

**Purpose:** Updates the badge count on the Gatepass card

**Implementation:**
```javascript
function updatePendingGatepassBadge(count) {
  const badge = document.querySelector('.hr-card-gatepass .badge-count');
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
  loadPendingGatepassCount();  // ✨ NEW - Load count on init
}
```

### 5. Auto-Update After Actions

**Updated `approveHRGatepass()`:**
```javascript
async function approveHRGatepass() {
  // ... approval logic ...
  
  closeHRGatepassPreview();
  await loadHRGatepasses();
  await loadPendingGatepassCount();  // ✨ NEW - Refresh count
}
```

**Updated `rejectHRGatepass()`:**
```javascript
async function rejectHRGatepass() {
  // ... rejection logic ...
  
  closeHRGatepassPreview();
  await loadHRGatepasses();
  await loadPendingGatepassCount();  // ✨ NEW - Refresh count
}
```

## How It Works

### On Dashboard Load:
```
1. User logs in as HR
2. Dashboard initializes
3. loadPendingGatepassCount() called
4. Fetch all gatepasses from sheet
5. Filter: Status === "Pending To HR"
6. Count filtered gatepasses
7. Update badge with actual count
```

### After Approval/Rejection:
```
1. HR user approves/rejects gatepass
2. Status updated in sheet
3. Preview modal closes
4. Gatepass list refreshes
5. loadPendingGatepassCount() called again
6. New count fetched and displayed
7. Badge shows updated count
```

## UI Location

The count appears in the **Pending Gatepass** card on the HR Dashboard:

```html
<div class="card-badge-notification">
  <span class="badge-count">12</span>  <!-- Now dynamic! -->
  <span class="badge-label">Pending</span>
</div>
```

## Benefits

### ✅ Real-Time Accuracy
- Shows actual count from Google Sheet
- No hardcoded values

### ✅ Auto-Update
- Refreshes after every approval/rejection
- Stays synchronized with sheet data

### ✅ Better User Experience
- HR users see accurate workload
- No confusion about pending items
- Immediate feedback after actions

### ✅ Error Handling
- Gracefully handles fetch failures
- Logs errors to console
- Doesn't break dashboard if API fails

## API Details

### Endpoint:
```
GET https://api.sheetbest.com/sheets/dd583123-5c7c-4279-8303-2aea56b7c8aa/tabs/Storse To GFU Gatepass
```

### Filter Logic:
```javascript
const pendingCount = data.filter(row => {
  const status = String(row['Status'] || '').trim();
  return status === 'Pending To HR';
}).length;
```

### Status Values Counted:
- ✅ Counts: `"Pending To HR"` (exact match)
- ❌ Ignores: `"Pending Approval"`, `"Pending To Transport"`, `"Rejected"`

## Testing Checklist

- [ ] Badge shows "0" when no pending gatepasses
- [ ] Badge shows correct count on dashboard load
- [ ] Count matches actual "Pending To HR" gatepasses in sheet
- [ ] Count decreases by 1 after approving a gatepass
- [ ] Count decreases by 1 after rejecting a gatepass
- [ ] Badge updates without page refresh
- [ ] No console errors during fetch
- [ ] Works when API is slow
- [ ] Handles API errors gracefully
- [ ] Multiple tabs stay synchronized (after refresh)

## Performance

### Network Requests:
- **On Load:** 1 request to fetch count
- **After Action:** 1 request to refresh count
- **Total:** Minimal overhead

### Optimization:
- Could add caching with TTL
- Could use WebSockets for real-time sync
- Could batch requests if needed

## Future Enhancements

### 1. Real-Time Updates
- Implement polling every 30-60 seconds
- Update count automatically without user action
- Show notification when new gatepasses arrive

### 2. Badge Animation
- Pulse animation when count increases
- Smooth number transition effects
- Color change based on urgency

### 3. Breakdown Badge
- Show count by priority/urgency
- Display age of oldest pending gatepass
- Add tooltip with details

### 4. Performance
- Cache count for 1-2 minutes
- Only fetch full data when needed
- Use lightweight count-only API if available

---

**Implementation Date:** August 20, 2026  
**Developer:** Kiro AI Assistant  
**Version:** 1.1  
**Status:** ✅ Complete and Ready for Testing
