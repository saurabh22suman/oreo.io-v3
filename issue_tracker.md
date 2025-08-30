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

