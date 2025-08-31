# Issue Tracker

This file records known issues, fixes and planned enhancements for the oreo.io v3 project.


## 2025-08-30 — Recent fixes & follow-ups

- Fix: Navbar now reads authenticated user from `UserContext` and shows username instead of Login when authenticated.
- Fix: Sidebar expand/collapse now controls layout via parent-managed `collapsed` state; main content resizes (CSS grid helper `layout-with-sidebar`) instead of being overlapped.
- Fix: Dashboard "Create New Project" buttons now navigate to `/projects` (existing inline create flow).

Enhancements / Pending items:

- Auth: Move to httpOnly cookie-based JWT (backend change required). Frontend updated to include `credentials: 'include'` on auth calls and to call `UserContext.refresh()` after login. Backend changes required: set cookie on login, provide `/auth/me` to read cookie and return user profile, and ensure CORS and SameSite settings allow cookie usage from the frontend origin when developing.
- Layout: Replace inline margin with responsive CSS grid (implemented via `.layout-with-sidebar`); consider adding CSS transitions for smoother width change.
- Security: Remove token usage from localStorage where possible; currently code falls back to token if backend still returns it.

New items added 2025-08-30 (UI Enhancements requested):

- UI: Revert primary button color to previous solid blue for clearer CTAs (was changed to glassy gradient in recent UI experiment). Status: completed in `frontend/src/index.css`.
- Feature: Replace Projects card grid with file-explorer style table view. Table should show columns: Name, Dataset count, Date modified. Include client-side sorting by each column. Status: implemented in `frontend/src/pages/ProjectsPage.tsx`.
- Enhancement: Add sortable columns (Name, Datasets, Modified) and display dataset counts and last-modified timestamps for each project. Status: implemented; backend may supply `datasetCount` and `modified` fields for accuracy.

- Enhancement: Make Projects table columns resizable via drag handles (frontend-only, implemented). Status: implemented in working tree; pending user review.
- Enhancement: Keyboard accessibility for rows (Enter/Space to open) and row focus outline. Status: implemented in working tree; pending user review.
- Enhancement: Truncate long project names in the table with tooltip on hover (using title attribute). Status: implemented in working tree; pending user review.
- Enhancement: Replace text sort arrows with small SVG icons for clarity. Status: implemented.


## 2025-08-31 — Work-in-progress 404 and layout polish

- Fix: NotFound page now shows only the work-in-progress illustration and no header/copy to match current UX request. File: `frontend/src/pages/NotFoundPage.tsx`. Status: done.
- Fix: Docs page now re-uses the NotFound/work-in-progress UI while documentation is being prepared. File: `frontend/src/pages/DocsPage.tsx`. Status: done.
- Tweak: Centered the 404/work-in-progress image and constrained its container to avoid unnecessary vertical scrolling on the page by using a min-height relative to the viewport minus top navbar (min-h-[calc(100vh-64px)]) and overflow-hidden on the NotFound container. Status: done; please verify across breakpoints.

Checks / Follow-ups:

- Verify left sidebar occupies full viewport height on all pages and breakpoints. Relevant files: `frontend/src/components/Layout.tsx`, `frontend/src/index.css` (look for `.layout-with-sidebar .sidebar { height: calc(100vh - 64px); }`). Status: manual verification needed in browser; evidence so far: `Layout` was updated to apply `.layout-with-sidebar` when user is present.
- If vertical scroll remains visible on NotFound/Docs routes, consider removing vertical padding on the `main` element for those routes or explicitly setting `overflow: hidden` on the page container. Status: pending (no further changes committed).


## 2025-08-31 — Dashboard refinements

- Change: Removed the "Resume Previous Project" button from the Dashboard header in favor of a single primary CTA for creating projects. File: `frontend/src/pages/DashboardPage.tsx`. Status: done.
- Change: Replaced the project card grid with a table view on Dashboard (columns: Name, Datasets, Last Modified) to match the Projects listing pattern. File: `frontend/src/pages/DashboardPage.tsx`. Status: done.
- Change: Removed the "Recent Changes" section from Dashboard to simplify the landing experience. File: `frontend/src/pages/DashboardPage.tsx`. Status: done.

Follow-ups:

- Verify table responds to long project names (truncation) — consider adding `title` attributes or truncation styles if needed. Status: manual QA.
- Consider reintroducing a compact Recent Changes widget elsewhere (e.g., an expandable side panel) if users ask for quick activity. Status: deferred.



