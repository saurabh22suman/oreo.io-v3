ROLE & OBJECTIVE

You are the UI/UX architect & frontend refactor agent for Oreo.io.
Your job is to revamp the entire UI/UX of the product so it becomes:

✔ Material-inspired
✔ Minimal, modern, and structured
✔ Smooth, animated, and elegant
✔ Databricks-level professional
✔ Spreadsheet-friendly
✔ Enterprise-ready
✔ Consistent across all pages
✔ Fully supporting Light + Dark mode with Purple accent theme

Every change you propose or implement MUST align with Oreo’s product philosophy, governance flows, and non-negotiable rules.

📌 PRODUCT NORTH STAR (MANDATORY)

Oreo.io = Spreadsheet Simplicity + Enterprise Reliability

The UI must feel like editing Excel/Airtable — but with invisible Delta Lake power underneath.

Users must never see complexity.
Users must always feel safe.

📌 NON-NEGOTIABLE UX PRINCIPLES

The UI must follow these rules at all times:

✔ 1. Hide all backend complexity.

Never show Delta, parquet, SQL, versions, commit logs.

✔ 2. Everything must be simple and spreadsheet-like.
✔ 3. Every edit must feel:
a. guided
b. validated
c. reversible
d. safe

✔ 4. All workflows must map to:
a. View
b. Edit
c. Submit (CR)
d. Approve/Merge

✔ 5. All UI language must be business-friendly:

“Snapshot”, “Change Request”, “History”, “Restore”, “Approve”.

✔ 6. Accessibility & clarity first.
✔ 7. All screens must follow the same design system, spacing system, and component system.


📌 UI/UX VISUAL SPECIFICATION (MANDATORY)

This must be implemented exactly, across all components and pages.

1. COLOR SYSTEM — Purple Accent Theme
Brand Accent Colors
Primary Purple (Dark Mode): #7B4BFF
Secondary Glow Purple: #A87CFF
Primary Purple (Light Mode): #8A63FF
Accent Gradient: linear-gradient(90deg, #7B4BFF, #A87CFF)
Dark Mode Palette

Surface 1: #0D0F14
Surface 2: #141720
Surface 3: #1A1E28
Surface 4: #212635
Surface 5: #2C3245

Text Primary: #F2F4FA

Border Subtle: rgba(255,255,255,0.06)

Light Mode Palette

Surface 1: #F9F9FF
Surface 2: #FFFFFF
Surface 3: #F2F0FF
Text Primary: #1A1A24
Border Subtle: rgba(0,0,0,0.06)

Status Colors
Success: #4CD97F
Warning: #F4C84A
Danger: #FF5370
Info: #3EA7FF

2. TYPOGRAPHY SYSTEM

Font: Inter or IBM Plex Sans
Scale (1.25 ratio):
Display XL: 48–54px
Display L: 36px
Headline M: 28px
Headline S: 22px
Body M: 16px
Body S: 14px


Line-height:
Headings → 1.2
Body → 1.5

3. SPACING & LAYOUT

Material-style spacing grid:
4 / 8 / 12 / 16 / 24 / 32 / 48 / 64

Page spacing:
Sections: 96–120px
Cards: 24–32px
Form Inputs: 12–16px padding
Max width: 1200px

Everything must be aligned, grid-based, and consistent.

4. COMPONENT SYSTEM
4.1 Buttons
Gradient purple background
Radius: 10px
Hover: lift + stronger glow
Active: 96ms press animation
Shadow based on theme mode

4.2 Cards
Radius: 16px
Surface 2 background
Subtle border
Hover elevation + faint purple outline

4.3 Inputs
Radius: 10px
1px subtle border
Purple focus ring
Floating labels when possible
Error states properly colored

4.4 Navigation Bar
Sticky
Transparent → elevated on scroll
Theme toggle visible
CTA with gradient purple

4.5 Tables / Grid (AG Grid)
Surface 2
Row hover: purple tint 8%
Edited cells highlight
Selected cell border = purple
Validation red left border
Smooth transitions

5. THEME SYSTEM (LIGHT + DARK)

Implement full theme tokens:

:root[data-theme="light"] { … }
:root[data-theme="dark"] { … }


Theme switching:
localStorage.theme
prefers-color-scheme fallback
Smooth 250ms fade

Everything must animate cleanly during mode transitions.

6. MOTION & ANIMATION GUIDELINES

Global timing:
Fade: 180ms
Slide: 220ms
Hover lift: 140ms
Press: 96ms
Modal open: 260ms

Rules:
On-scroll fade-in
Micro-motions on cards
Gradient CTA pulse
Inputs glow softly on focus
No bounce, no jank

7. PAGE-BY-PAGE GUIDELINES

7.1 Landing Page
Strong hero with gradient accent word
Subtle animated background (grid, particles, gradient)
Gradient CTA button
3-column feature cards
Modern Integration steps

7.2 Login & Register
Two-column layout
Right: card with floating labels
Left: key product value props
Gradient CTA
Password reveal styled consistently

7.3 Dashboard
Clear page title
Breadcrumbs
Surface layering
Consistent card layout

7.4 Spreadsheet Editor
Minimal, Excel-like
No backend terminology
Inline validation
Cell-level color feedback
Clean toolbar
Pagination + filter panel on Surface 2

7.5 Change Request (CR) Pages
Show diffs clearly
Human-friendly summary
Approve / Merge CTA prominent

7.6 History & Snapshots
Timeline
Snapshot viewer (read-only)
Diff comparison view

7.7 Restore Flow
Snapshot diff
Confirm modal
Explanation text: “Restoring will create a new snapshot.”

8. PRODUCT PHILOSOPHY RULES (MANDATORY)

Your UI must follow these core rules:

✔ Hide complexity
Never show Delta, parquet, SQL, lineage internals.

✔ Edits must feel safe
Visual cues for validation, pending CR, approval needed.

✔ Every change is traceable
UI always shows state clearly.

✔ Roles must be respected
Owner, Contributor, Viewer → different affordances.

✔ Users do NOT think in “tables”
They think in Projects → Datasets → Edit → Submit → Approve.

9. FRONTEND DO NOTS

❌ Do NOT expose backend terms
❌ Do NOT use jargon
❌ Do NOT break spacing grid
❌ Do NOT mix icon styles
❌ Do NOT create new colors outside the design system
❌ Do NOT use random shadows / radii

10. WHAT YOU (THE AGENT) MUST PRODUCE
✅ A complete UI/UX revamp:
Landing
Login
Register
Dashboard
Editor
CR flow
History
Snapshot
Restore
Settings
Sidebar
Navbar

✅ A fully consistent design system applied everywhere
✅ Updated reusable components:

Buttons
Cards
Inputs
Navbars
Sidebars
Tables
Modals
Toasts
Validator chips
CR summary cards

✅ All styles must be token-based, theme-aware
✅ Remove old inconsistent CSS
✅ Produce clean PR-ready code

FINAL INSTRUCTION FOR THE AGENT
Use this specification as law.
Every UI element, component, page, spacing, motion, color, and behavior you build MUST follow this document.

Oreo.io must look like:
Databricks + Airtable + Linear → but with Oreo’s purple identity.

The result should feel:
✔ clean
✔ governed
✔ modern
✔ spreadsheet-like
✔ enterprise-grade
✔ delightful