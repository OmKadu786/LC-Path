---
name: Engineered Precision
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#20201f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353535'
  on-surface: '#e5e2e1'
  on-surface-variant: '#bccaba'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#879486'
  outline-variant: '#3d4a3e'
  surface-tint: '#5edf81'
  primary: '#5edf81'
  on-primary: '#003916'
  primary-container: '#2db55d'
  on-primary-container: '#003f19'
  inverse-primary: '#006d31'
  secondary: '#c8c6c6'
  on-secondary: '#303030'
  secondary-container: '#474747'
  on-secondary-container: '#b6b5b4'
  tertiary: '#ffb2bc'
  on-tertiary: '#670022'
  tertiary-container: '#fe708a'
  on-tertiary-container: '#710027'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#7cfc9b'
  primary-fixed-dim: '#5edf81'
  on-primary-fixed: '#00210a'
  on-primary-fixed-variant: '#005323'
  secondary-fixed: '#e4e2e1'
  secondary-fixed-dim: '#c8c6c6'
  on-secondary-fixed: '#1b1c1c'
  on-secondary-fixed-variant: '#474747'
  tertiary-fixed: '#ffd9dd'
  tertiary-fixed-dim: '#ffb2bc'
  on-tertiary-fixed: '#400012'
  on-tertiary-fixed-variant: '#8a1636'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353535'
typography:
  display:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  h1:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.01em
  h2:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 22px
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-caps:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.06em
  code-sm:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 18px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  base: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 32px
  gutter: 12px
---

## Brand & Style

The design system is built for high-performance developers who value efficiency, speed, and technical clarity. The brand personality is "Quietly Powerful"—it doesn’t distract from the code, but enhances the problem-solving experience through a premium, engineered aesthetic.

The visual style blends **Minimalism** with **Modern Technical** accents. It utilizes a deep, monochromatic foundation to reduce eye strain during long coding sessions, punctuated by vibrant, glowing functional elements. High-density layouts and precise alignments evoke the feeling of a sophisticated IDE, ensuring that the Chrome extension feels like a native tool rather than an overlay.

## Colors

The palette is strictly optimized for dark-mode environments. The primary color, **Emerald Green**, is reserved for success states, primary actions, and progress indicators, creating a direct mental link to LeetCode’s "Submit" action.

- **Foundational Grays:** #1A1A1A serves as the canvas background. #282828 is used for elevated surfaces like cards and modals.
- **Accent Glow:** A low-opacity version of the primary Emerald is used for ambient backlighting and "active" states to create depth without sacrificing the professional tone.
- **Success/Warning/Error:** Maintain standard semantic colors but desaturated to fit the dark theme, except for the Primary Emerald which remains vibrant.

## Typography

This design system utilizes **Inter** exclusively to maintain a clean, utilitarian aesthetic. The hierarchy is established through weight and letter-spacing rather than drastic size changes, reflecting the information-dense nature of developer tools.

- **Headlines:** Use tighter letter-spacing and semi-bold weights to look "locked-in" and authoritative.
- **Labels:** Small, uppercase labels with increased tracking are used for metadata and category headers to provide a structural, "blueprint" feel.
- **Readability:** Body text uses a slightly lighter gray (e.g., #CCCCCC) to reduce the harsh contrast of pure white on black, which can cause "halation" or blurring for some users.

## Layout & Spacing

Because this design system is primarily applied to a Chrome extension, real estate is premium. The layout follows a **Strict 4px Grid** to ensure every element is mathematically aligned.

- **Fluid Containers:** The extension width is generally fixed (e.g., 360px - 400px), using fluid internal containers with 16px side margins.
- **Density:** High information density is preferred. Use 8px spacing for related elements (label to input) and 16px or 24px for distinct sections.
- **Consistency:** All internal padding for cards and containers should default to 12px or 16px to maintain a compact, "instrument panel" feel.

## Elevation & Depth

Hierarchy is achieved through **Tonal Layering** and **Subtle Glows** rather than heavy shadows.

- **Surface Tiers:** 
    - Tier 0: #1A1A1A (Background)
    - Tier 1: #282828 (Cards/Containers)
    - Tier 2: #333333 (Hover states/Inputs)
- **The "Glow" Effect:** Primary elements (like the 'Start' button or an active path) utilize a `box-shadow` with a 15-20px blur using the Emerald color at 20% opacity.
- **Borders:** Instead of deep shadows, use 1px solid borders in #333333 to define shapes. For "featured" or "active" cards, the border can transition to a subtle Emerald gradient.

## Shapes

The shape language is **Soft-Technical**. A base radius of 4px (`roundedness: 1`) is applied to most components to keep the UI looking modern but precise.

- **Small Components:** Checkboxes and small buttons use a 4px radius.
- **Containers:** Larger cards or modals may use an 8px radius to feel slightly more approachable.
- **Pills:** Avoid pill-shaped buttons except for status tags (e.g., "Easy", "Medium", "Hard") to keep the "engineered" aesthetic consistent.

## Components

### Buttons
- **Primary:** Background #2DB55D, text #1A1A1A (high contrast). Apply a subtle Emerald outer glow on hover.
- **Secondary:** Transparent background, 1px border in #434343, text #FFFFFF.
- **Ghost:** No background or border; Emerald text for actions, White/Gray text for navigation.

### Cards
- Background #282828 with a 1px border in #333333. 
- Active or "Featured" cards should have an inner 1px border highlight at the top or a subtle glow emanating from behind the card.

### Input Fields
- Background #1A1A1A (inset feel) with a 1px border in #434343. 
- Focus state: Border changes to #2DB55D with a 2px outer glow.

### Chips / Tags
- Use for difficulty levels. 
- "Easy": Dark green background with bright green text.
- "Medium": Dark yellow background with bright yellow text.
- "Hard": Dark red background with bright red text.
- All tags use `label-caps` typography.

### Progress Indicators
- Linear bars with a #282828 track and #2DB55D fill. The fill should have a slight "pulse" or glow effect to indicate movement along the path.