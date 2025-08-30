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

