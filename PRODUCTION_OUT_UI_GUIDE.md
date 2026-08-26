# Production Out Module - UI Guide

## Visual Interface Overview

This document provides a visual description of the Production Out user interface.

---

## 🎨 Main Interface Components

### 1. Header Section
```
┌─────────────────────────────────────────────────────────────┐
│  [🔶]  Production Out                                        │
│        Dispatch Items from Production Floor                  │
└─────────────────────────────────────────────────────────────┘
```
- **Orange icon** with arrow-right-from-bracket symbol
- **Title**: "Production Out"
- **Subtitle**: Clear description of module purpose
- **Background**: Orange gradient (#f97316 → #ea580c)

---

### 2. QR Code Section

#### Tab Bar
```
┌─────────────────────────────────────────────────────────────┐
│  [🎥 Scan QR]  [⌨️ Manual Entry]                            │
└─────────────────────────────────────────────────────────────┘
```
- Two tabs with smooth transitions
- Active tab: Orange background with orange text
- Inactive tab: Gray text, transparent background

#### A. Scan Panel (Default Active)
```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│   ┌──────────────────────────────────────────────────────┐  │
│   │╔                                                    ╗│  │
│   │                                                       │  │
│   │        📷 CAMERA VIEW WITH QR SCANNER                │  │
│   │                                                       │  │
│   │                ════ Scanning Line ════               │  │
│   │                                                       │  │
│   │╚                                                    ╝│  │
│   │  🟢 Camera active — point at QR code                 │  │
│   └──────────────────────────────────────────────────────┘  │
│                                                               │
│              [🔄 Switch Camera]                              │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```
- **QR viewport**: 420px max width, 4:3 aspect ratio
- **Orange corner markers**: Visual guides at four corners
- **Animated scanning line**: Moves up and down
- **Status strip**: Green indicator when camera active
- **Switch button**: Toggle between front/rear cameras

#### B. Manual Panel
```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│   QR CODE VALUE                                              │
│   ┌────────────────────────────────────┐ [🔍 Look Up]       │
│   │ Type or paste QR code…             │                    │
│   └────────────────────────────────────┘                    │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```
- **Label**: "QR CODE VALUE" with orange icon
- **Input field**: Large, easy to type
- **Look Up button**: Orange gradient button
- **Enter key support**: Press Enter to submit

---

### 3. QR Result Badge (After Capture)
```
┌─────────────────────────────────────────────────────────────┐
│  ✅ QR: QR-ABC-12345-XYZ                              [✖️]  │
└─────────────────────────────────────────────────────────────┘
```
- **Orange background** with low opacity
- **Check icon**: Confirms successful capture
- **QR value**: Displayed in orange bold text
- **Clear button**: Remove and start over

---

### 4. Item Details Card

#### Header
```
┌─────────────────────────────────────────────────────────────┐
│  [📦]  Production Item Found                                │
│         QR-ABC-12345-XYZ                    [✅ Verified]   │
└─────────────────────────────────────────────────────────────┘
```
- **Orange icon**: Box symbol
- **Label**: "Production Item Found"
- **QR value**: Highlighted in orange
- **Badge**: Green verification badge

#### Details Grid
```
┌─────────────────────────────────────────────────────────────┐
│  # PO NUMBER           👟 MODEL                              │
│  PO-2026-001           CONCORD RUNNER PRO                    │
├─────────────────────────────────────────────────────────────┤
│  🎨 OUTSOLE COLOUR     📏 SIZE                               │
│  Black Carbon          EU 42                                 │
├─────────────────────────────────────────────────────────────┤
│  📦 AVAILABLE QTY      📄 MRN REFERENCE                      │
│  150                   MRN-OS-2026-045                       │
└─────────────────────────────────────────────────────────────┘
```
- **2-column grid layout**
- **Icons** for each field
- **Orange highlight** on PO number and Available QTY
- **Clean cell borders** with dark background

---

### 5. Dispatch Block

#### Information Hint
```
┌─────────────────────────────────────────────────────────────┐
│  ℹ️ Enter the quantity to dispatch from the production      │
│     floor and click Submit.                                  │
└─────────────────────────────────────────────────────────────┘
```

#### Quantity Input
```
┌─────────────────────────────────────────────────────────────┐
│  📦 DISPATCH QUANTITY                                        │
│  ┌────────────────────────┐                                 │
│  │ Enter quantity         │                                 │
│  └────────────────────────┘                                 │
│  Maximum: 150 units                                          │
└─────────────────────────────────────────────────────────────┘
```
- **Label** with icon
- **Number input** with placeholder
- **Hint text**: Shows maximum allowed
- **Validation**: Real-time feedback

#### Action Buttons
```
┌─────────────────────────────────────────────────────────────┐
│  [❌ Cancel]           [📤 Submit]                           │
└─────────────────────────────────────────────────────────────┘
```
- **Cancel**: Gray button, closes form
- **Submit**: Orange gradient button, prominent
- **Side-by-side layout** on desktop
- **Stacked layout** on mobile

---

### 6. Success Screen (After Dispatch)
```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                      ╔════════╗                              │
│                      ║   ✅   ║                              │
│                      ╚════════╝                              │
│                                                               │
│              Dispatched Successfully!                         │
│                                                               │
│     50 units of CONCORD RUNNER PRO (QR: QR-ABC-12345-XYZ)   │
│     have been dispatched from the production floor.          │
│                                                               │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  QR CODE               │  DISPATCHED QTY               │ │
│  │  QR-ABC-12345-XYZ      │  50                           │ │
│  ├────────────────────────────────────────────────────────┤ │
│  │  MODEL                 │  STATUS                       │ │
│  │  CONCORD RUNNER PRO    │  Dispatched ✅                │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                               │
│              [🔍 Scan Next Item]                             │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```
- **Large success icon**: Bounces on appear
- **Confirmation message**: Clear and concise
- **Summary grid**: Shows dispatch details
- **Orange highlights**: Dispatched quantity
- **Green status**: "Dispatched"
- **Continue button**: Scan next item

---

### 7. Error States

#### Not Found
```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                        ❌                                     │
│                                                               │
│                  No Record Found                              │
│                                                               │
│     QR code "QR-INVALID-CODE" does not match                 │
│     any production record.                                   │
│                                                               │
│              [🔄 Try Again]                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

#### Not Verified (Production In Not Done)
```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                        ⚠️                                     │
│                                                               │
│           Not Ready for Production Out                        │
│                                                               │
│     QR code "QR-ABC-12345-XYZ" has not been verified         │
│     through Production In yet. Please verify this item       │
│     through Production In first.                             │
│                                                               │
│              [🔍 Scan Another]                               │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

#### Lookup Failed (Network Error)
```
┌─────────────────────────────────────────────────────────────┐
│                                                               │
│                        ⚠️                                     │
│                                                               │
│                   Lookup Failed                               │
│                                                               │
│     Could not reach the sheet. Check your connection.        │
│                                                               │
│              [🔄 Try Again]                                  │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

---

### 8. Toast Notifications

#### Success
```
┌──────────────────────────────────┐
│ ✅ QR code captured!              │
└──────────────────────────────────┘
```

#### Error
```
┌──────────────────────────────────┐
│ ❌ Please enter a valid quantity. │
└──────────────────────────────────┘
```

#### Info
```
┌──────────────────────────────────┐
│ ℹ️ Looking up QR code…            │
└──────────────────────────────────┘
```

- **Position**: Bottom center of screen
- **Animation**: Slides up from bottom
- **Auto-dismiss**: After 3.5 seconds
- **Color coding**: Green for success, red for error, orange for info

---

## 🎨 Color Palette

### Primary Colors
- **Orange 500**: `#f97316` - Main accent color
- **Orange 600**: `#ea580c` - Darker shade for gradients
- **Orange 400**: `#fb923c` - Lighter shade for text
- **Orange 300**: `#fdba74` - Very light for subtle backgrounds

### Semantic Colors
- **Success Green**: `#22c55e` - Verification badges, success states
- **Error Red**: `#f87171` - Error messages, warnings
- **Warning Yellow**: `#fbbf24` - Alerts, notifications

### UI Colors
- **Text Primary**: `var(--clr-text-primary)` - Main text
- **Text Secondary**: `var(--clr-text-secondary)` - Supporting text
- **Text Muted**: `var(--clr-text-muted)` - Disabled/inactive text
- **Border**: `var(--clr-border)` - Input borders, dividers
- **Background**: Dark theme with transparency overlays

---

## 📱 Responsive Breakpoints

### Desktop (>1024px)
- Full 2-column layouts
- Large QR viewport (420px)
- Side-by-side buttons

### Tablet (768px - 1024px)
- Maintained layouts with slight adjustments
- Medium QR viewport (360px)

### Mobile (<768px)
- Single column layouts
- Stacked buttons
- Smaller QR viewport (100% width)
- Optimized touch targets (min 44px)

---

## ✨ Animations

### QR Scanning Line
- **Duration**: 2 seconds
- **Movement**: Top to bottom continuously
- **Effect**: Orange glow with transparency gradient
- **Easing**: ease-in-out

### Success Icon
- **Animation**: Scale bounce
- **Duration**: 0.5 seconds
- **Effect**: Scales from 0 to 1 with cubic-bezier easing
- **Accompanies**: Success screen display

### Toast Notifications
- **Entry**: Slide up from bottom
- **Duration**: 0.35 seconds
- **Easing**: cubic-bezier(0.34, 1.56, 0.64, 1) - bouncy
- **Exit**: Fade out over 0.3 seconds

### Tab Transitions
- **Duration**: 0.2 seconds
- **Effect**: Background color and text color fade
- **Smooth**: ease timing function

### Card Fade-ins
- **Duration**: 0.35 seconds
- **Effect**: Opacity 0→1, translateY 8px→0
- **Easing**: cubic-bezier for subtle bounce

---

## 🔤 Typography

### Headers
- **Module Title**: 1rem, weight 800, orange color
- **Section Labels**: 0.72rem, weight 700, uppercase, muted color
- **Success Title**: 1.4rem, weight 800, primary color

### Body Text
- **Main**: 0.9rem, weight normal, primary color
- **Supporting**: 0.82rem, weight normal, secondary color
- **Hints**: 0.72rem, weight normal, muted color

### Inputs
- **Field Labels**: 0.68rem, weight 700, uppercase, muted
- **Input Text**: 0.9rem, weight normal, primary color
- **Placeholders**: 0.9rem, weight normal, muted color

### Buttons
- **Text**: 0.84-0.9rem, weight 700, white or primary
- **Icons**: Consistent sizing with text

---

## 📐 Spacing & Layout

### Padding
- **Cards**: 16-18px
- **Sections**: 14-20px
- **Buttons**: 10-12px vertical, 18-24px horizontal
- **Inputs**: 12px vertical, 16px horizontal

### Gaps
- **Sections**: 14-20px
- **Elements**: 8-14px
- **Grid cells**: 1px (for borders)

### Border Radius
- **Cards**: 12px
- **Buttons**: 8-10px
- **Inputs**: 8px
- **Badges**: 20px (pill shape)
- **Icons**: 8-10px

### Shadows
- **Buttons**: `0 4px 16px rgba(249,115,22,0.35)`
- **Cards**: `0 0 0 1px rgba(249,115,22,0.25)`
- **Hover**: Enhanced shadow on button hover

---

## ♿ Accessibility Features

### ARIA Support
- **aria-label**: Descriptive labels for icon-only buttons
- **aria-live**: Toast notifications are announced
- **aria-selected**: Tab state indicators
- **role="status"**: Toast notification container

### Keyboard Navigation
- **Enter key**: Submit manual entry
- **Tab key**: Navigate through form fields
- **Escape key**: Close modal (inherited from dashboard)
- **Focus indicators**: Visible focus rings on interactive elements

### Screen Reader Support
- **Semantic HTML**: Proper heading hierarchy
- **Alt text**: Icons have descriptive text
- **Live regions**: Dynamic content updates announced
- **Hidden decorations**: `aria-hidden="true"` on decorative elements

### Visual Accessibility
- **High contrast**: Text meets WCAG AA standards
- **Color isn't only indicator**: Icons accompany color coding
- **Sufficient spacing**: Touch targets >44px on mobile
- **Readable fonts**: Minimum 0.72rem (11.5px)

---

## 🎯 User Interaction Flows

### Happy Path
1. User clicks Production Out card
2. Camera activates automatically
3. User points at QR code
4. System captures and shows result badge
5. Item details appear instantly
6. User enters dispatch quantity
7. User clicks Submit
8. Confirmation dialog appears
9. User confirms
10. Success screen shows
11. User clicks Scan Next Item
12. Process repeats

### Alternative Path (Manual Entry)
1. User clicks Production Out card
2. User clicks Manual Entry tab
3. Camera stops
4. User types QR code
5. User presses Enter or clicks Look Up
6. [Same as steps 5-12 above]

### Error Recovery
1. Camera not available → Manual entry suggested
2. QR not found → Clear button to try again
3. Not verified → Message to complete Production In first
4. Invalid quantity → Inline validation with hint
5. Network error → Retry button available

---

This UI guide provides a comprehensive visual reference for the Production Out module interface.
