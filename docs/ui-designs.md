# UI Designs for MVP

1️⃣ Login / Signup Page

Layout: Split screen

- Left side → Minimal illustration (data charts / cloud storage).
- Right side → Login form.

Elements:

- Logo + app name (top left).
- Email, Password inputs (rounded, clean).
- “Login” button (primary).
- “Sign up” link (below).

Style:

- White background, accent color buttons (blue/purple gradient).
- Subtle shadow cards.

Extra: Option to login with Google (OAuth).

2️⃣ Dashboard (Projects Overview)

Layout:

- Top navbar → Logo, project switcher dropdown, user avatar menu.
- Sidebar →
  - Projects
  - Datasets
  - Approvals
  - Queries
  - Settings
- Main panel → Grid of project cards.

Project Card:

- Title + description.
- Last updated timestamp.
- Status badge (Active / Pending / Archived).

Style:

- Grid layout with 2–3 cards per row.
- Smooth hover animations.

3️⃣ Project Page

Layout:

- Header → Project title + breadcrumbs.
- Tabs → Datasets | Approvals | Rules | Members.
- Content panel → table/grid depending on tab.

Datasets Tab:

- Table of datasets (name, rows, schema, last updated).
- “Upload Dataset” button (floating primary button).

Approvals Tab:

- Approval queue with status tags.
- Approve / Reject actions inline.

Rules Tab:

- List of rules (e.g., “Column X must be unique”).
- Toggle switch to activate/deactivate.
- “+ Add Rule” button.

4️⃣ Dataset Viewer (Live Editing)

Layout:

- Spreadsheet-like table (sticky header, infinite scroll).
- Sidebar (toggleable) → Schema & Rules summary.
- Top bar → Dataset name + version selector.

Interactions:

- Double-click cell → edit value.
- On save → validation (via Python microservice).
- Errors → highlight cell in red with tooltip.

Style:

- Clean white background.
- Soft grid lines.
- Validation badges (✅ / ❌) on columns.

5️⃣ Approvals Workflow

Layout:

- Timeline view → Submission → Validation → Approval → Commit.
- Table list of pending approvals with details.

Action buttons:

- Approve ✅
- Reject ❌ (with comment box).

Style:

- Minimal cards with stepper UI (progress bar at top).

6️⃣ Query Editor

Layout:

- Left → Schema explorer (tree of datasets & columns).
- Right → SQL editor (monospace, syntax highlighting).
- Bottom → Results table.

Features:

- Run button (primary).
- Query history (sidebar modal).
- Export results (CSV/Excel/SQL).

Style:

- Dark mode SQL editor (Monaco-style).
- Light background for results table.

7️⃣ User Management (RBAC)

Layout:

- Table → Username, Role, Status.
- Dropdown → Change role (Owner, Approver, Editor, Viewer).
- Invite user button.

Style:

- Role badges (colored tags).
- Soft modal for "Invite User".

✨ Design System (Consistent Look & Feel)

Typography: Inter / Poppins, clean sans-serif.

Colors:

- Primary → Blue / Purple gradient (#6366f1 → #a855f7).
- Background → White / light gray.
- Accents → Subtle shadows & rounded corners (2xl).

UI Kit:

- Tailwind CSS + shadcn/ui.
- Icons from Lucide.
- Animations → Framer Motion (slide/fade transitions).
