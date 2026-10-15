---
name: Cube Trainer
description: Competition Stage for physical smart-cube practice
colors:
  canvas: "#eff6ff"
  surface: "#ffffff"
  text: "#172554"
  muted: "#526381"
  accent: "#2456d9"
  accent-text: "#ffffff"
  soft: "#e2ecfb"
  line: "#c9d7ec"
  danger: "#b32441"
  shell: "#172554"
  shell-text: "#eff6ff"
  shell-muted: "#c1d0ee"
  success: "#167252"
  success-surface: "#d9f4e9"
  phase-cross: "#4775e8"
  phase-f2l: "#ef8093"
  phase-oll: "#dfb63c"
  phase-pll: "#39a78a"
  dark-canvas: "#101c37"
  dark-surface: "#182849"
  dark-text: "#edf4ff"
  dark-muted: "#acbddc"
  dark-accent: "#a1beff"
  dark-accent-text: "#14254c"
  dark-soft: "#23385e"
  dark-line: "#354b70"
  dark-danger: "#ffa4b6"
  dark-success: "#92e6c2"
  dark-success-surface: "#1a443c"
  dark-phase-cross: "#83a7ff"
  dark-phase-f2l: "#f79bad"
  dark-phase-oll: "#eed078"
  dark-phase-pll: "#6ed5b5"
typography:
  display:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: 'clamp(64px, 7vw, 96px)'
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: '-.04em'
  title:
    fontSize: '22px'
    fontWeight: 600
    letterSpacing: '-.02em'
  body:
    fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    fontSize: '16px'
    lineHeight: 1.5
  control:
    fontSize: '14px'
  annotation:
    fontSize: '12px'
rounded:
  control: '8px'
  panel: '12px'
  overlay: '16px'
  badge: '999px'
spacing:
  '1': '4px'
  '2': '8px'
  '3': '12px'
  '4': '16px'
  '6': '24px'
  '8': '32px'
  '10': '40px'
  '12': '48px'
components:
  button-primary:
    backgroundColor: '{colors.accent}'
    textColor: '{colors.accent-text}'
    rounded: '{rounded.control}'
    padding: '8px 12px'
    height: '40px'
  button-outline:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.control}'
    padding: '8px 12px'
  button-ghost:
    backgroundColor: 'transparent'
    textColor: '{colors.text}'
    rounded: '{rounded.control}'
    padding: '8px 12px'
  input:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.control}'
    padding: '8px 12px'
  dialog:
    backgroundColor: '{colors.surface}'
    textColor: '{colors.text}'
    rounded: '{rounded.overlay}'
  success-badge:
    backgroundColor: '{colors.success-surface}'
    textColor: '{colors.success}'
    rounded: '{rounded.badge}'
    padding: '6px 12px'
---

# Design System: Cube Trainer

## Overview

**Creative North Star: "Competition Stage"**

Physical practice takes the stage. A midnight-indigo navigation shell frames an open blue practice plane; a centered interactive cube and large timer carry the main visual weight. Color helps identify actions and measured phases while flat supporting regions keep attention on the attempt.

The approved direction is code-led, with `.impeccable/mocks/decision/assigned.html` as its composition reference. It uses the existing geometric 3D cube and component foundations; no new shipping raster assets or approved raster comp establish this system. The current source, particularly `src/styles/competition-stage.css`, is the extraction authority. This stylesheet loads after `workspace.css` and `design-navigation.css` in `src/app/main.tsx`.

**Key Characteristics:**

- One centered practice plane.
- A concentrated indigo shell and meaningful phase colors.
- Large tabular time with restrained interface typography.
- Flat sections and progressive analysis disclosure.

## Colors

### Primary

Electric blue identifies primary actions and the current setup move. The dark theme substitutes a lighter blue and dark foreground for readable controls. Selection uses the same accent pair.

### Secondary

Cross blue, F2L coral, OLL amber, and PLL mint remain consistent between live and saved analysis. These are data categories rather than interchangeable decoration. Success has a separate text/surface pair; danger identifies errors and destructive actions. Recognition intervals include a pattern and phase labels provide another cue.

### Neutral

Light mode uses a pale-blue canvas, white overlay surfaces, indigo text, blue-gray secondary text, and cool dividers. Dark mode uses a deep-blue canvas with lighter blue surfaces and text. The shell retains its midnight-indigo background, pale text, and muted navigation colors in both themes. Frontmatter keys prefixed `dark-` are the overrides selected by `prefers-color-scheme: dark`; unoverridden shell tokens remain shared.

**The Semantic Color Rule.** Phase colors retain their measured meaning across live results and saved details; pair color with labels or other state cues.

## Typography

The interface uses the system sans stack recorded in the frontmatter. The timer uses tabular numerals and the display role; numeric history, metadata, and phase values also retain stable columns. Page and dialog titles use the title role, with page titles reducing to (20px) on narrow screens. Body, controls, and annotations use their shared size tokens. Narrow-screen timers use (72px); move guidance uses (20px), reducing to (18px).

Keep descriptive labels left-aligned where needed for reading. Center history values and phase-table data columns and headers. Use the existing Lucide icon family with the shared (20px) icon size; icon-only actions retain accessible names.

## Layout

The header spans the viewport. A utility row places page title and session above a practice column capped at (960px). Cube, timer, analysis, and history share that centerline; Cross controls sit above the stage rather than in a flanking sidebar. Desktop horizontal workspace padding is the largest spacing step; it reduces to the sixth step at (1100px), then the fourth at (640px). Navigation wraps below the header actions at the first breakpoint. At (360px), compact brand and navigation spacing preserve access.

Cross controls use four desktop columns and two narrow columns. The cube viewport is (270px) high, reducing to (250px) on narrow screens. Setup occupies a minimum (56px) region. Preserve page scrolling for analysis and contain dense horizontal tables within their own region.

Recent history uses a shallow five-column row, changing to three columns on narrow screens. All results restores the full paginated table with a bounded scroll region of `min(480px, 60dvh)`. Controls use the shared (40px) desktop minimum and (44px) narrow minimum; specific inherited compact controls, including the session select, retain their local sizing.

## Elevation & Depth

The practice canvas and its sections are flat. Dividers, spacing, and soft selected surfaces organize content. Elevation belongs to overlays: the floating phase card uses `0 8px 28px #0d20452b`; the dialog uses `0 20px 64px #08183240`. A floating card does not enter document flow or move analysis on hover.

**The Open Stage Rule.** Use shared alignment and space before introducing another panel around practice content.

## Shapes

Controls have gently rounded corners; overlays use the larger overlay radius. The existing panel radius remains for localized previews. Success badges are pill-shaped. History, Cross controls, analysis regions, and disclosure sections stay flat rather than becoming nested cards. The thin phase timeline retains its existing (14px) height while equivalent table controls provide larger activation targets.

## Components

### Buttons and inputs

Existing shared Button and native-select components remain the primitives. Primary buttons use the accent pair; outline buttons use the surface; ghost and link variants are transparent. Inputs use the surface, text, line, and control-radius tokens. Shared keyboard focus is a (2px) accent outline offset by (3px). Disabled buttons use reduced opacity (.45). Buttons and links transition background and color over (140ms ease-out); reduced-motion preference removes transition and animation duration.

### Navigation and session

The shell groups Solve, Cross Trainer, Insights, and optional Debug with connection and Settings access. Current navigation uses an electric-blue background and white text without an extra underline. The session picker remains in the utility row. Mobile actions keep accessible names when visible labels are abbreviated.

### Phase analysis

CFOPBreakdown provides the continuous, duration-proportional phase ribbon and stable phase summaries. Compact live analysis hides the full metric groups behind View analysis; saved result details retain the full review. Phase controls support click, keyboard, touch, pressed state, and Escape dismissal. Preserve recognition/execution distinctions, skipped phases, and honest unavailable timing.

### History

HistoryTable supports recent and all-results presentations with the same result selection and actions. Penalty edits, deletion, pagination, and saved review remain reachable. Empty history uses concise secondary text without an enclosing card.

### Dialogs and disclosures

Existing dialog primitives retain focus containment and restoration. Soft headers, spacious bodies, and flat sections group Settings, Device, import, session creation, and saved details. Shared disclosures use a bottom divider and a (56px) trigger region; do not wrap every setting in another card. Named X buttons close dialogs and pinned phase cards without redundant tooltips.

### Cross and secondary pages

Cross shares the stage and semantic controls, with localized success feedback and flat saved-attempt metric sections. Insights and Debug inherit the open plane and bounded diagnostic content. Preserve their existing capabilities and recovery guidance.

## Do's and Don'ts

### Do:

- **Do** keep the cube and timer on one shared centerline.
- **Do** preserve phase meanings and equivalent keyboard, click, and touch access.
- **Do** keep full saved review and all-results history reachable.
- **Do** use shared tokens and the final stylesheet cascade when extending the interface.

### Don't:

- **Don't** reintroduce unequal flanking sidebars around the practice stage.
- **Don't** move surrounding content when a phase card opens on hover.
- **Don't** fabricate unavailable timing or product capabilities to fill space.
- **Don't** treat the superseded design guides as current visual authority.
