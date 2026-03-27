# Homework Design System

## Brand Principles

**Homework should feel like**: Relief. Calm. Confidence. "Finally, someone made this make sense."

**Homework should NOT feel like**: Exciting. Urgent. Aggressive. Sales-y.

---

---

## Brand Foundations

### Color System

All color definitions, tokens, and usage rules live in:

→ `docs/Brand/colors`

Rules:
- No raw hex values should be introduced outside that file
- All UI must use semantic color tokens
- Accent colors are restricted and must follow usage rules


---

## Typography

### Font Stack
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

### Scale
| Use | Size | Weight | Line Height |
|-----|------|--------|-------------|
| H1 (Page titles) | 32px / 2rem | 600 | 1.2 |
| H2 (Section headers) | 24px / 1.5rem | 600 | 1.3 |
| H3 (Card titles) | 18px / 1.125rem | 600 | 1.4 |
| Body | 16px / 1rem | 400 | 1.5 |
| Small | 14px / 0.875rem | 400 | 1.5 |
| Caption | 12px / 0.75rem | 400 | 1.4 |

### Rules
- No ALL CAPS except very short labels
- No exclamation points in UI copy
- Sentence case for buttons and labels

---

## Spacing

Use Tailwind's default spacing scale:
```
4px  = p-1, m-1
8px  = p-2, m-2
12px = p-3, m-3
16px = p-4, m-4
24px = p-6, m-6
32px = p-8, m-8
48px = p-12, m-12
64px = p-16, m-16
```

### Component Spacing
- Card padding: `p-6` (24px)
- Section gaps: `gap-8` (32px)
- Form field gaps: `gap-4` (16px)
- Button internal padding: `px-4 py-2`

---

## Components

### Buttons

**Primary** (main actions)
```jsx
<button className="bg-primary text-primary-foreground px-4 py-2 rounded-lg font-medium hover:bg-primary/90 transition-colors">
  Book Service
</button>
```

**Secondary** (supporting actions)
```jsx
<button className="border border-border text-foreground px-4 py-2 rounded-lg font-medium hover:bg-accent transition-colors">
  Learn More
</button>
```

**Ghost** (tertiary)
```jsx
<button className="text-primary px-4 py-2 font-medium hover:underline">
  Cancel
</button>
```

### Cards

```jsx
<div className="bg-card rounded-xl border border-border shadow-sm p-6">
  {/* Card content */}
</div>
```

### Inputs

```jsx
<input 
  className="w-full px-4 py-3 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
  placeholder="Enter your address"
/>
```

### Status Badges

```jsx
// Good/Healthy
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
  Healthy
</span>

// Warning/Attention
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
  Due Soon
</span>

// Problem/Action Needed
<span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
  Action Needed
</span>
```

---

## Layout Patterns

### Page Container
```jsx
<main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
  {/* Page content */}
</main>
```

### Two-Column (Desktop)
```jsx
<div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
  <div className="lg:col-span-2">
    {/* Main content */}
  </div>
  <div>
    {/* Sidebar */}
  </div>
</div>
```

### Card Grid
```jsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
  {/* Cards */}
</div>
```

---

## Motion

Keep it subtle. We're calming, not flashy.

```css
/* Standard transition */
transition-all duration-200 ease-in-out

/* Hover states */
hover:shadow-md
hover:scale-[1.02]

/* Focus states */
focus:ring-2 focus:ring-primary
```

**Never use**:
- Bounce animations
- Aggressive scaling
- Flashing elements
- Auto-playing anything

---

## Icons

Use Lucide React (already in shadcn):
```jsx
import { Home, Wrench, DollarSign, Check } from 'lucide-react';

<Home className="w-5 h-5 text-muted-foreground" />
```

Icon sizing:
- Inline with text: `w-4 h-4`
- Button icons: `w-5 h-5`
- Feature icons: `w-6 h-6`
- Hero icons: `w-8 h-8`

---

## Accessibility

### Requirements
- All interactive elements keyboard accessible
- Focus states visible
- Color contrast 4.5:1 minimum
- Form inputs have labels
- Images have alt text
- Error messages linked to inputs

### Testing
```bash
# Use axe-core for automated checks
npm install @axe-core/react
```

---

## Responsive Breakpoints

Use Tailwind defaults:
```
sm: 640px   (large phones)
md: 768px   (tablets)
lg: 1024px  (laptops)
xl: 1280px  (desktops)
2xl: 1536px (large monitors)
```

Design mobile-first, enhance upward.

---

## Component Library Setup

We use shadcn/ui as our base. Initialize with:

```bash
npx shadcn-ui@latest init
```

Configuration:
- Style: Default
- Base color: Slate
- CSS variables: Yes

Then add components as needed:
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add input
# etc.
```

---

## Do's and Don'ts

### Do
- Use generous whitespace
- Keep forms short
- Show progress indicators
- Provide clear feedback
- Use consistent alignment

### Don't
- Overwhelm with options
- Hide important information
- Use red for non-errors
- Auto-play videos or sounds
- Use dark patterns

---

## Example: Equipment Card

```jsx
<div className="bg-card rounded-xl border border-border shadow-sm p-6 hover:shadow-md transition-shadow">
  <div className="flex items-start justify-between">
    <div>
      <h3 className="text-lg font-semibold text-foreground">
        Carrier Infinity AC
      </h3>
      <p className="text-sm text-muted-foreground mt-1">
        Installed March 2019 · 5 years old
      </p>
    </div>
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
      Healthy
    </span>
  </div>
  
  <div className="mt-4 pt-4 border-t border-border">
    <div className="grid grid-cols-2 gap-4 text-sm">
      <div>
        <span className="text-muted-foreground">Warranty</span>
        <p className="font-medium text-foreground">Valid until 2029</p>
      </div>
      <div>
        <span className="text-muted-foreground">Last Service</span>
        <p className="font-medium text-foreground">Oct 2024</p>
      </div>
    </div>
  </div>
</div>
```

This creates a calm, informative card that doesn't pressure action.

