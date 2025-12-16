# Onboarding Screen Designs

## Design System Overview

### Color Palette
- **Gradient**: `#9C3FE4` (Purple) → `#C65647` (Orange/Red) - Used for primary buttons
- **Background Overlay**: `rgba(21, 19, 22, 0.8)` - Dark semi-transparent overlay
- **Theme Support**: Light/Dark mode compatible
- **Primary Colors**: 
  - Light: `#2563EB` (Blue)
  - Dark: `#BB86FC` (Purple)

### Typography & Spacing
- Button Border Radius: `15px`
- Card Border Radius: `20px`
- Input Border Radius: `8px`
- Consistent padding: `20px` horizontal

---

## Screen 1: Welcome / Community

```
┌─────────────────────────────────┐
│  [Skip]                         │
│                                 │
│                                 │
│        🎨 Illustration          │
│    (People/Icons Icon)          │
│         Large Icon              │
│                                 │
│                                 │
│   Connect with Communities      │
│        [Title - Large]          │
│                                 │
│   Join groups, chat with        │
│   friends, and build your       │
│   network.                      │
│   [Description text]            │
│                                 │
│                                 │
│  ● ○ ○ ○ ○                     │
│  [Page Indicators]              │
│                                 │
│  [  Next  ]                     │
│  [Gradient Button]              │
└─────────────────────────────────┘
```

**Design Specifications:**
- Background: Same `background.png` with dark overlay as AuthScreen
- Icon: Large Ionicons `people` icon (size: 100-120px)
- Icon Color: Gradient or primary theme color
- Title: Bold, 28-32px, white/theme text color
- Description: Regular, 16-18px, secondary text color (#A3A3A3)
- Skip button: Top right, secondary text color, 16px
- Next button: Full width, gradient background, white text, bottom positioned

---

## Screen 2: Businesses

```
┌─────────────────────────────────┐
│  [Skip]                         │
│                                 │
│                                 │
│        🏪 Illustration          │
│    (Storefront Icon)            │
│         Large Icon              │
│                                 │
│                                 │
│   Discover Local Businesses     │
│        [Title - Large]          │
│                                 │
│   Browse shops, order products, │
│   and support local vendors.    │
│   [Description text]            │
│                                 │
│                                 │
│  ○ ● ○ ○ ○                     │
│  [Page Indicators]              │
│                                 │
│  [  Next  ]                     │
│  [Gradient Button]              │
└─────────────────────────────────┘
```

**Design Specifications:**
- Icon: Large Ionicons `storefront` icon (size: 100-120px)
- Icon Color: Gradient or accent color
- Same layout structure as Screen 1

---

## Screen 3: Wallet

```
┌─────────────────────────────────┐
│  [Skip]                         │
│                                 │
│                                 │
│        💰 Illustration          │
│      (Wallet Icon)              │
│         Large Icon              │
│                                 │
│                                 │
│   Manage Your Wallet            │
│        [Title - Large]          │
│                                 │
│   Send money, receive payments, │
│   and track your transactions.  │
│   [Description text]            │
│                                 │
│                                 │
│  ○ ○ ● ○ ○                     │
│  [Page Indicators]              │
│                                 │
│  [  Next  ]                     │
│  [Gradient Button]              │
└─────────────────────────────────┘
```

**Design Specifications:**
- Icon: Large Ionicons `wallet` icon (size: 100-120px)
- Icon Color: Gradient or success color

---

## Screen 4: Ehailing

```
┌─────────────────────────────────┐
│  [Skip]                         │
│                                 │
│                                 │
│        🚗 Illustration          │
│       (Car Icon)                │
│         Large Icon              │
│                                 │
│                                 │
│   Book Rides Instantly          │
│        [Title - Large]          │
│                                 │
│   Request rides, track drivers, │
│   and get where you need to go. │
│   [Description text]            │
│                                 │
│                                 │
│  ○ ○ ○ ● ○                     │
│  [Page Indicators]              │
│                                 │
│  [  Next  ]                     │
│  [Gradient Button]              │
└─────────────────────────────────┘
```

**Design Specifications:**
- Icon: Large Ionicons `car` icon (size: 100-120px)
- Icon Color: Gradient or info color

---

## Screen 5: Get Started

```
┌─────────────────────────────────┐
│  [Skip]                         │
│                                 │
│                                 │
│        🎉 Illustration          │
│      (Logo or Sparkles)         │
│      App Logo or Icon           │
│                                 │
│                                 │
│   Ready to Get Started?         │
│        [Title - Large]          │
│                                 │
│   Join thousands of users       │
│   already using the app.        │
│   [Description text]            │
│                                 │
│                                 │
│  ○ ○ ○ ○ ●                     │
│  [Page Indicators]              │
│                                 │
│  [ Get Started ]                │
│  [Gradient Button - Large]      │
└─────────────────────────────────┘
```

**Design Specifications:**
- Icon: App logo (from `assets/logo.png`) or celebration icon
- Button text changes to "Get Started" instead of "Next"
- Same gradient button style

---

## Component Specifications

### Page Indicator Dots
- **Active**: Filled circle, gradient or primary color, size: 8-10px
- **Inactive**: Outlined circle or filled with low opacity, size: 8-10px
- **Spacing**: 8px between dots
- **Position**: Centered, 40-50px above button

### Skip Button
- **Position**: Top right corner
- **Padding**: 20px from edges
- **Style**: Text button, no background
- **Color**: Secondary text color (#A3A3A3 in light, #A3A3A3 in dark)
- **Font Size**: 16px
- **Always visible on all screens**

### Next/Get Started Button
- **Width**: Full width minus 40px (20px padding each side)
- **Height**: 50-55px
- **Background**: Linear gradient from `#9C3FE4` to `#C65647`
- **Border Radius**: 15px
- **Text Color**: White (#FFFFFF)
- **Font Size**: 17-18px, bold
- **Position**: Fixed bottom with SafeAreaView padding
- **Margin Bottom**: 40-50px

### Icon/Illustration
- **Size**: 100-120px width/height
- **Position**: Centered vertically (flexible)
- **Color**: Can use gradient fill or theme primary color
- **Animation**: Optional subtle fade-in or scale animation

### Typography
- **Title**: 
  - Font Size: 28-32px
  - Font Weight: Bold
  - Color: Theme text color (white/primary)
  - Center aligned
  - Margin: 30-40px top, 20px bottom
  
- **Description**:
  - Font Size: 16-18px
  - Font Weight: Regular
  - Color: Secondary text color
  - Center aligned
  - Line Height: 24px
  - Padding: 0 40px

### Layout Structure
```
SafeAreaView (full screen)
  └─ ImageBackground (background.png)
      └─ Dark Overlay (rgba(21, 19, 22, 0.8))
          └─ Container (flex: 1)
              ├─ Skip Button (absolute top right)
              ├─ ScrollView (or fixed content)
              │   ├─ Spacer
              │   ├─ Icon/Illustration
              │   ├─ Spacer
              │   ├─ Title
              │   ├─ Description
              │   └─ Spacer
              ├─ Page Indicators
              └─ Next/Get Started Button
```

### Animation Suggestions
1. **Page Transitions**: Smooth swipe transitions using react-native-pager-view
2. **Icon Fade-in**: Icons fade in when page becomes active
3. **Button Pulse**: Subtle pulse animation on "Get Started" button
4. **Indicator Animation**: Smooth transition of active indicator

---

## Responsive Considerations

- **SafeAreaView**: Ensure content doesn't overlap with notches/status bars
- **Keyboard**: Onboarding won't need keyboard, but ensure proper spacing
- **Small Screens**: Reduce icon size and spacing proportionally
- **Large Screens**: Maintain max-width for content area for readability

---

## Accessibility

- **Skip Button**: Should be easily tappable (min 44x44px touch target)
- **Swipe Gesture**: Alternative navigation via buttons (already provided)
- **Text Contrast**: Ensure WCAG AA compliance for text readability
- **Focus Indicators**: Visible focus states for accessibility navigation

---

## Alternative Design Option: Minimalist

If you prefer a more minimalist approach:
- Remove background image, use solid gradient background
- Larger icons (140-160px)
- More white space
- Simpler, cleaner aesthetic

