# Frontend Architecture Specification for Live Edit (Oreo.io)

**Purpose**
This document describes the recommended frontend architecture for the Excel-like Live Edit feature and surrounding UX (change requests, approvals, previews, history). It is written as an implementation guide for your AI coding agent (Sonnet-4.5) and frontend engineers. It includes component design, folder structure, state management, API contracts, performance guidelines, testing strategy, accessibility and security considerations.


---

## 1. High-level goals

* Provide an Excel-like, keyboard-first, low-friction editing UX for non-technical users.
* Enforce business rules at the UI level (immediate validation feedback) while always re-validating server-side.
* Minimize data transfer & memory use (virtualization, on-demand fetch, sparse staging edits only).
* Keep the UI resilient: optimistic updates, conflict handling, and clear approval workflows.
* Maintain strict role-based visibility: Owner/Contributor/Viewer.

---

## 2. Tech stack

* **Framework:** React (TypeScript)
* **Bundler:** Vite
* **Styling:** Tailwind CSS + component library (shadcn/ui optional)
* **Grid:** AG Grid Enterprise or Community (features: cell editing, virtualization, column pinning, custom editors)
* **State management:** Zustand or Redux Toolkit Query (RTK Query) for server cache; use React Query or SWR for data fetching if preferred.
* **Realtime:** EventSource (SSE) for notifications; WebSocket (optional) for collaborative editing later.
* **Validation UI:** integrate Great Expectations results via API; show inline hints and toasts.
* **Testing:** Playwright for E2E, Jest + React Testing Library for unit tests.

---

## 3. Folder & Component Layout (recommended)

```
src/
 ├─ api/                 # api layer wrappers (api.ts generated from OpenAPI)
 ├─ components/
 │   ├─ Grid/            # AG Grid wrapper + cell editors
 │   │   ├─ LiveGrid.tsx
 │   │   ├─ CellEditor/*
 │   │   └─ utils.ts
 │   ├─ LiveEditToolbar/
 │   ├─ ChangeRequestPanel/
 │   ├─ PreviewModal/
 │   └─ HistoryViewer/
 ├─ hooks/
 │   ├─ useLiveSession.ts
 │   ├─ useEdits.ts
 │   └─ useValidation.ts
 ├─ stores/              # zustand or redux slices
 ├─ pages/
 │   ├─ DatasetViewer.tsx
 │   └─ ChangeRequestPage.tsx
 ├─ utils/
 └─ styles/
```

---

## 4. Data Flow & State Management

* **Source of truth:** Server-side Delta table.
* **Local state layers:**

  1. **Server cache:** RTK Query / React Query caches paginated data from `/datasets/{id}/data`.
  2. **Live session edits store (client-side):** Sparse list of edits keyed by `session_id` + `row_id` + `column` stored in Zustand. This mirrors the staging Delta on server.
  3. **UI optimism layer:** UI shows edits immediately after successful `/edits` response. Each edit has validation payload; invalid edits show UI flags.

**Synchronization rhythm:**

* On session start: create session (POST `/live_sessions`) → returns `session_id` and editable columns.
* Grid fetches page data with `session_id` overlay.
* On cell edit: call POST `/live_sessions/{session_id}/edits` → if valid, update local edits store; if invalid, show error.
* Batch saves: optionally use batch endpoint for rapid typing.
* Preview: call POST `/preview` to aggregate edits.
* Submit CR: POST `/change_requests`.

---

## 5. Grid Design (AG Grid)

**LiveGrid.tsx** responsibilities:

* Virtualization (rowModel: viewport or infinite)
* Column definitions enriched with `editable` flag, formatter and validators
* Custom cell editors for datatypes: text, number, date, dropdown (lookup) and boolean
* Keyboard navigation: Enter to edit, Tab to move, Shift+Enter to save
* Visual states: edited badge, validation error highlight, hover tooltip for GE messages

**Cell editor behavior:**

* On commit: send single-cell edit API; display spinner until response
* On validation failure: show inline error + prevent leaving cell (optional)
* For lookups: fetch suggestions from lookups API

**Performance:**

* Use value getters to overlay staging edits: `getRowNode(rowId).setDataValue(col, stagedValue)` instead of refetching entire page
* Avoid re-rendering the whole grid on each edit

---

## 6. Validation UX

* **Immediate feedback:** Inline per-cell validation messages from `/edits` response.
* **Non-blocking warnings:** For warnings, show yellow pip and allow editing to continue; show in preview summary.
* **Blocking errors (fatal):** prevent CR submission; display red marker and block the merge flow.
* **Validation panel:** show list of issues across the session grouped by severity

---

## 7. Change Request Workflow (UI)

* **Draft state:** User can edit until they hit "Preview" or "Submit".
* **Preview modal:** shows diffs, counts, validation summary; approver selection UI
* **Submit:** creates CR; sends notification to approvers (SSE event)
* **Approver UI:** show CR with side-by-side diff (old vs new) and inline comments for cells. Approver can Approve or Reject.

---

## 8. Conflict Handling & Merge UX

* When approver attempts to merge, server runs final validation and merge. If conflict (main changed since edits):

  * Server returns `409 Conflict` with conflict details listing rows with concurrent changes.
  * UI displays conflicts in a dedicated panel allowing the approver to pick resolution per-row or abort.
* Provide quick action buttons: Overwrite, Reject cell, Rebase edits.

---

## 9. Accessibility

* Keyboard-only operation must be fully supported
* ARIA labels for grid cells and editors
* High-contrast styles and focus rings
* Screen-reader friendly summaries for preview and validation results

---

## 10. Offline, Persistence & TTL

* Persist session edits to local storage periodically to avoid data loss
* Session TTL enforced by the backend; show countdown or auto-save warning

---

## 11. Testing & QA

* **Unit tests:** cell editor, hooks, validation mapping
* **Integration:** API mock + Grid interactions
* **E2E:** Playwright scenarios: start session, edit many cells, preview, submit CR, approve, verify Delta changed
* **Load:** simulate N concurrent editors and K rows edited to test responsiveness

---

## 12. Security & Permissions

* Enforce RBAC on UI level: hide edit buttons for viewers
* Validate permissions server-side regardless of UI checks
* Prevent XSS by sanitizing cell rendering

---

## 13. Deployment & Feature Flags

* Feature flag `live_edit_enabled` per-project to roll out gradually
* Toggle `storage_backend` per dataset (postgres | delta) during migration

---

## 14. Developer Hints for AI Agent

* Use the API spec files (Live-Edit-API-Spec.md) as the contract
* Implement small PRs: Grid wrapper, editor components, session hooks, preview modal, CR panel
* Use storybook for interactive component development

---

## 15. Sample Component Interface (TypeScript)

```ts
interface EditPayload { row_id: string; column: string; new_value: any; client_ts?: string }

// hook
function useLiveSession(datasetId: string) {
  return {
    sessionId, startSession, endSession, fetchPage, saveEdit, batchSave, preview, submitCR
  }
}
```