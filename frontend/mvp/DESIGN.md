---
name: Blueprint Sketch
colors:
  surface: '#0b1326'
  surface-dim: '#0b1326'
  surface-bright: '#31394d'
  surface-container-lowest: '#060e20'
  surface-container-low: '#131b2e'
  surface-container: '#171f33'
  surface-container-high: '#222a3d'
  surface-container-highest: '#2d3449'
  on-surface: '#dae2fd'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#dae2fd'
  inverse-on-surface: '#283044'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#4cd7f6'
  on-secondary: '#003640'
  secondary-container: '#03b5d3'
  on-secondary-container: '#00424e'
  tertiary: '#f9bd22'
  on-tertiary: '#402d00'
  tertiary-container: '#ce9a00'
  on-tertiary-container: '#4a3500'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#acedff'
  secondary-fixed-dim: '#4cd7f6'
  on-secondary-fixed: '#001f26'
  on-secondary-fixed-variant: '#004e5c'
  tertiary-fixed: '#ffdf9f'
  tertiary-fixed-dim: '#f9bd22'
  on-tertiary-fixed: '#261a00'
  on-tertiary-fixed-variant: '#5c4300'
  background: '#0b1326'
  on-background: '#dae2fd'
  surface-variant: '#2d3449'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 56px
    fontWeight: '800'
    lineHeight: 64px
    letterSpacing: -0.03em
  headline-xl-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 36px
    fontWeight: '800'
    lineHeight: 44px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '700'
    lineHeight: 36px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
  body-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Plus Jakarta Sans
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-lg:
    fontFamily: JetBrains Mono
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system merges the precision of modern developer-first infrastructure tooling with the spontaneous clarity of a collaborative whiteboard canvas (Excalidraw/tldraw inspired). It targets software architects, platform engineers, and technical founders who value deep systems thinking without bureaucratic sterility. 

The aesthetic is grounded in a deep charcoal/slate canvas textured with subtle architectural graph dots, punctuated by vibrant marker-pen accents (emerald runtime greens, highlighter cyan, scribble corals, and marker yellows). Technical components—such as terminal panels, metric streams, and code viewports—remain sharp, legible, and authoritative, while surrounding narrative callouts, structural relationship diagrams, highlight bounds, and badges employ organic, sketchy contours, rough strokes, and dynamic annotation arrows. 

The emotional payoff is instant comprehension, technical trust, and creative momentum: a feeling that the architecture is living, accessible, and authored by engineers for engineers.

## Colors

The system uses a dark mode palette calibrated against deep slate and carbon paper surfaces, allowing chalk and marker tones to shine with high contrast.

- **Primary (`#10B981` — Cyber Emerald):** Represents operational health, primary interactive states, successful deployments, and live runtime signals.
- **Secondary (`#06B6D4` — Highlighter Cyan):** Reserved for technical connection strings, sketch arrows, architecture connectors, and secondary focal points.
- **Tertiary (`#FBBF24` — Marker Yellow):** Powers whiteboard annotations, doodle tags, scribble callouts, and inline emphasis marks. Paired with Coral (`#FB7185`) for critical architectural caveats and alerts.
- **Neutral (`#0F172A` — Deep Slate Canvas):** Provides the foundational slate-dark backdrop. 
  - Canvas Base: `#0B0F19`
  - Surface Tiers: `#111827` (Card/Node), `#1E293B` (Elevated Terminal/Popover)
  - Architectural Grid Lines/Dots: `rgba(148, 163, 184, 0.08)`
  - Sketchy Outlines: `rgba(148, 163, 184, 0.28)`
  - Text Primary: `#F8FAFC`
  - Text Muted: `#94A3B8`

## Typography

The type system is built on a tight partnership between **Plus Jakarta Sans** and **JetBrains Mono**:

- **Plus Jakarta Sans:** Drives product messaging, marketing headers, and descriptive interface copy. It supplies contemporary geometric legibility with warm, rounded humanist terminals that keep technical material readable and friendly.
- **JetBrains Mono:** Handles all system metrics, code payloads, terminal inputs, sketch dimension tags, and doodle metadata. Its increased character height and clear code ligatures anchor the developer identity.
- **Handwritten Accents:** For contextual scribble notes, speech labels, and arrow tags, leverage SVG path doodles or italicized `label-md` snippets styled with marker-stroke underscores to evoke fast whiteboard sketches.

## Layout & Spacing

The layout is built around a hybrid whiteboard canvas model: a central structured 12-column grid placed atop an infinite-feel dot-matrix background (`24px` repetition grid pattern).

- **Desktop (1024px+):** 12-column grid, max width 1280px, with `1.5rem` (24px) gutters and `2rem` (32px) margins. Diagrammatic annotations and hand-drawn callouts can break out of standard column tracks by `-24px` to `-48px` to establish whiteboard asymmetry.
- **Tablet (768px - 1023px):** 8-column grid with `1.5rem` gutters. Diagram callouts align within column edges to prevent horizontal scroll.
- **Mobile (Up to 767px):** 4-column layout with `1rem` gutters and margins. Sketch scribbles and arrows shift to inline stack flow rather than overlapping floating coordinates.
- **Vertical Rhythm:** Micro-components adhere to a strict 4px/8px internal step (`space-xs` through `space-xl`), while macro sections breathe with generous padding (`4rem` to `6rem`) to mimic open canvas space.

## Elevation & Depth

Visual hierarchy abandons traditional corporate drop shadows in favor of **tonal layering**, **tactile hard-offset shadow sketches**, and **sketch borders**:

1. **Canvas Surface:** Dark ink base with an SVG dot grid overlay at 8% opacity.
2. **Container Layers:** Cards and technical panes sit on `#111827` bordered by 1px to 1.5px semi-rough borders (`rgba(148, 163, 184, 0.2)`).
3. **Sketch Elevation (The "Drawn Offset"):** Key interactive cards and floating modal tags employ a 2D hard offset drop: `box-shadow: 4px 4px 0px 0px rgba(16, 185, 129, 0.35)` or `box-shadow: 3px 3px 0px 0px #06B6D4`. This replicates rapid marker drop-shadows on paper.
4. **Active/Highlight Glow:** High-priority nodes and running services feature a localized ambient stroke glow using Cyber Emerald (`rgba(16, 185, 129, 0.15)`) without blurring structural borders.

## Shapes

The design system maintains a base roundedness tier of `1` (Soft, default `0.25rem` / 4px to 8px) for production-grade UI components, preserving high data density and technical structure.

To integrate the hand-drawn Excalidraw aesthetic without sacrificing layout alignment:
- Standard UI containers use subtle irregular border radii (e.g., `border-radius: 6px 4px 7px 5px`) or rough SVG clipping masks to produce a tactile, imperfect edge.
- Connectors and architectural links use hand-drawn SVG lines with deliberate stroke jitter (roughness of 1.2–1.8), variable line dashes (`stroke-dasharray: 6 4`), and marker arrowheads.
- Doodle badges, callout bubbles, and highlighters feature organic, hand-drawn vector loops around critical stats.

## Components

### Buttons
- **Primary:** Background in Cyber Emerald (`#10B981`) with JetBlack (`#090D16`) text, weight 600, styled with a distinct 2px hard offset shadow (`box-shadow: 3px 3px 0px #047857`). On hover, the element translates 2px down and right, collapsing the offset.
- **Secondary (Terminal/Sketch):** Transparent fill, slate border (`#334155`), JetBrains Mono label, with a soft neon cyan sketch indicator on hover.
- **Annotation Button:** Handwritten style tag button with a dashed, slightly tilted outline and marker-yellow text.

### Chips & Doodle Badges
- Status chips feature a monospaced font, an SVG hand-drawn circle indicator (pulsing green dot), and a light charcoal background.
- "Doodle" badges use marker outlines (emerald, yellow, or cyan), a subtle rotation (`transform: rotate(-1.5deg)`), and text accented by rough SVG underlines.

### Architecture Cards & Panels
- Constructed from `#111827` backdrops. Edges are framed with a 1.5px rough slate border.
- Cards host an optional top-right "pin" or "tape" vector, or an architectural port node (`[+]`) at connection centers.
- Diagram cards incorporate scribble connector wires that trace dependencies from one card to another using dotted cyan or amber SVG paths.

### Lists & Key-Value Metrics
- Metrics are displayed in JetBrains Mono with hand-drawn highlighter backdrops (a semi-transparent yellow/green SVG swatch layered under the text).
- Bullet points use hand-sketched checkmarks or terminal prompt markers (`>_`).

### Checkboxes & Radios
- Checkboxes mimic quick hand-drawn pencil boxes with imperfect square outlines.
- Selected state displays a marker tick stroke (`stroke-linecap: round`) drawn in Cyber Emerald.

### Input Fields & Terminal Prompts
- Dark input fields (`#0B0F19`) with sharp or slightly softened corners, inset 1px border.
- Active focus displays a dual-tone scribble border or a glowing cyan offset line. 
- Prefix indicators utilize monospace directory paths (e.g., `mesh://`) to reinforce the developer domain.

### Diagrammatic Connectors & Callout Annotations
- Vector-based directional arrows featuring variable stroke weights that curve naturally between stack layers.
- Embedded sketch sticky-notes that offer architecture advice ("Zero trust edge proxy runs here!") rendered in tilted, high-contrast marker cards.