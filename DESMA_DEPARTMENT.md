# Desma Department Dashboard

## Overview
The Desma Department dashboard is a specialized interface for Desma direct injection molding operations at Concord Footwear. It features a clean, focused design with a single module: **Desma In**.

## Design Theme

### Color Palette
- **Primary**: Purple (#8b5cf6) - Represents precision and technology
- **Secondary**: Teal (#14b8a6) - Represents innovation and quality
- **Accent**: Light Purple (#a78bfa) - UI highlights
- **Background**: Deep purple-navy gradient

### Visual Elements
- Animated background with floating shapes
- Gradient glows and particle effects
- Smooth transitions and hover effects
- Modern card-based interface

## Dashboard Features

### Top Navigation Bar
- **Logo & Branding**: SOLE MATRIX with Desma Department badge
- **Live Clock**: Real-time display with date
- **User Info**: Avatar, username, and role (Desma Operator)
- **Sign Out Button**: Purple themed logout option

### Hero Section
- **Personalized Greeting**: Time-based (morning/afternoon/evening)
- **User Welcome**: Displays logged-in username
- **Department Badge**: Animated icon with glow effect
- **Tagline**: "Precision injection molding at your fingertips"

### Stats Strip
4 information chips:
1. **Today**: Current date
2. **Department**: Desma
3. **Status**: Active (with teal indicator)
4. **Machine**: Online status

### Main Module Section

#### Intro Area
- Large gear icon with gradient background
- Title: "Desma Injection Molding"
- Description of the workflow

#### Desma In Card (Primary Module)
A large, centered, interactive card featuring:

**Visual Design:**
- Gradient border with glow effect
- Animated background pattern (lines and circles)
- Rotating icon on hover (box-open icon)
- Pulsing rings around the icon
- Shine effect animation

**Content:**
- Badge: "CORE MODULE"
- Title: "Desma In" with animated arrow
- Description: Material intake workflow
- 3 Feature Icons:
  - QR Scanning
  - Verification
  - Real-time Tracking
- Footer: "Injection Molding" tag + "START" button

**Interactions:**
- Hover: Lifts card, intensifies glow, expands arrow
- Click/Enter: Opens module interface
- Focus: Accessible keyboard navigation

#### Info Cards (Below Main Card)
3 supporting cards with icons:
1. **Quick Process**: ⚡ Streamlined workflow
2. **Quality First**: 🛡️ Material compliance
3. **Live Tracking**: 📈 Real-time monitoring

### Footer
- Copyright information
- Desma Department tag with gear icon

## Module: Desma In

### Purpose
Record and track incoming materials for Desma direct injection molding production.

### Features (Planned)
- **QR Code Scanning**: Camera-based or manual entry
- **Material Verification**: Validate incoming components
- **Quantity Checking**: Ensure correct amounts received
- **Real-time Updates**: Instant sheet updates
- **Production Tracking**: Monitor material flow

### Current Status
The Desma In module interface shows a "Coming Soon" placeholder with:
- Large animated icon
- Feature description
- Development status notice
- Back to dashboard button

## File Structure

```
desma-dashboard.html              - Main dashboard HTML
assets/
  css/
    desma-dashboard.css           - Desma-specific styles
  js/
    desma-dashboard.js            - Dashboard functionality
    auth.js                       - Updated with Desma redirect
```

## Authentication & Access

### Department Registration
Users can select "Desma Department" from the dropdown during registration.

### Login Flow
1. User enters credentials
2. System validates against Login sheet
3. If department = "Desma Department":
   - Redirects to `desma-dashboard.html`
   - Shows purple-themed success modal
   - Displays "Desma Operator" role

### Dashboard Protection
- Checks for valid session (username + department)
- Verifies department = "Desma Department"
- Redirects unauthorized users to login

## User Experience

### Navigation Flow
```
Login (index.html)
    ↓
Success Modal (purple theme)
    ↓
Desma Dashboard (desma-dashboard.html)
    ↓
Click "Desma In" Card
    ↓
Module Interface (overlay)
    ↓
[Future: Full Desma In functionality]
```

### Keyboard Accessibility
- **Tab**: Navigate through interactive elements
- **Enter/Space**: Activate module card
- **Escape**: Close module overlay
- All interactive elements are focusable
- ARIA labels for screen readers

## Technical Details

### JavaScript Functions

**`checkAuth()`**
- Validates session storage
- Confirms department access
- Redirects if unauthorized

**`initDashboard()`**
- Sets username displays
- Updates greeting
- Sets today's date
- Generates avatar

**`updateGreeting()`**
- Time-based greeting (morning/afternoon/evening)

**`startClock()`**
- Real-time clock in topbar
- Updates every second

**`generateAvatar()`**
- Creates initial-based avatar
- Purple gradient background

**`openDesmaIn()`**
- Shows module overlay
- Displays placeholder content
- Enables escape key handler

**`closeModule()`**
- Hides overlay with animation
- Cleans up event listeners

### CSS Animations

**Custom Animations:**
- `desmaFloat`: Floating shapes movement
- `scanLine`: Scanning line effect
- `expandFade`: Expanding circles
- `ringPulse`: Pulsing icon rings
- `bounce`: Arrow bounce effect
- `shine`: Card shine on hover
- `fadeInUp`: Content entrance animation
- `pulse`: Icon pulse effect

### Responsive Design
- Desktop-first approach
- Tablet: Adjusted padding and font sizes
- Mobile: Single column layout, smaller cards
- Breakpoint: 768px

## Future Enhancements

### Desma In Module (To Be Implemented)
1. **QR Code Scanner Interface**
   - Camera activation
   - Manual entry option
   - QR result display

2. **Material Lookup**
   - Search in sheets
   - Display material details
   - Show current inventory

3. **Intake Form**
   - Quantity input
   - Quality check fields
   - Notes/comments
   - Photo upload (optional)

4. **Sheet Integration**
   - Create "Desma In" sheet tab
   - Save intake records
   - Real-time updates
   - History tracking

5. **Reporting**
   - Daily intake summary
   - Material usage stats
   - Quality metrics

### Additional Modules (Future)
- **Desma Production**: Track active molding operations
- **Desma Out**: Record finished goods output
- **Quality Control**: Inspection and testing
- **Maintenance**: Machine status and upkeep

## Design Philosophy

### Why Single Module?
The Desma Department focuses on **precision intake** of materials before injection molding. Unlike other departments with multiple workflows, Desma's primary concern at this stage is ensuring accurate material reception. This focused approach:

- ✅ Reduces cognitive load
- ✅ Emphasizes the critical intake step
- ✅ Allows for detailed, comprehensive interface
- ✅ Maintains workflow clarity

### Purple & Teal Theme
- **Purple**: Represents technology, precision, and innovation
- **Teal**: Represents quality, freshness, and trust
- **Combination**: Modern, professional, high-tech aesthetic
- **Contrast**: Clear visual hierarchy and accessibility

### Centered Card Design
The large, centered card design:
- Draws attention to the primary action
- Provides clear call-to-action
- Reduces decision paralysis
- Creates a sense of importance
- Allows for rich, detailed information

## Testing Checklist

### Authentication
- [x] Can register with "Desma Department"
- [x] Redirects to desma-dashboard.html on login
- [x] Blocks access from other departments
- [x] Session persistence works

### Dashboard Display
- [x] Shows correct username and department
- [x] Clock updates in real-time
- [x] Date displays correctly
- [x] Greeting changes by time of day
- [x] Avatar generates from username

### Desma In Card
- [x] Card displays with all content
- [x] Hover effects work smoothly
- [x] Click opens module overlay
- [x] Keyboard navigation (Enter/Space)
- [x] Focus outline visible

### Module Overlay
- [x] Opens with animation
- [x] Displays placeholder content
- [x] Close button works
- [x] Escape key closes overlay
- [x] Smooth transitions

### Responsive Design
- [x] Looks good on desktop (1920px+)
- [x] Adapts to laptop (1366px)
- [x] Works on tablet (768px)
- [x] Usable on mobile (375px)

### Accessibility
- [x] All buttons have aria-labels
- [x] Keyboard navigation works
- [x] Focus indicators visible
- [x] Screen reader friendly
- [x] Color contrast meets WCAG AA

## Support & Maintenance

### Browser Compatibility
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

### Known Issues
None at this time.

### Future Maintenance
- Update module placeholder when real interface is ready
- Add more departments if needed
- Extend features based on user feedback

---

**Status**: ✅ Ready for Testing  
**Version**: 1.0  
**Last Updated**: August 21, 2026  
**Department**: Desma Department  
**System**: SOLE MATRIX
