# UI Tracker

This file tracks all UI work items and tasks for the modern React + Tailwind frontend.

## Pages
- [x] Landing Page
- [x] Login Page
- [x] Registration Page
- [x] Dashboard Page
- [x] Documentation Page

## Components
- [x] Navbar
- [x] Footer
- [x] FeatureCard
- [x] Sidebar
- [x] AuthForm

## Recent UI fixes & enhancements (dashboard)
- [x] Remove duplicate sidebar from global layout; dashboard now renders its own aside. (2025-08-30)
- [x] Move Docs link from Navbar to Sidebar; Sidebar now contains Docs. (2025-08-30)
- [x] Move signed-in user display from Sidebar to Navbar top-right with dropdown logout. (2025-08-30)
- [x] Clicking oreo.io logo navigates to `/dashboard` instead of landing. (2025-08-30)
- [x] Sidebar overlaps Navbar and collapses to icons-only; hides oreo.io text when collapsed. (2025-08-30)
- [x] Welcome message now shows actual username (from `currentUser()`), fallback to 'User'. (2025-08-30)
- [x] Create/Resume buttons conditional: only 'Create New Project' when no projects; show 'Resume' when >=1 project. (2025-08-30)
- [x] Placeholder routes (`/settings`, `/labs`, etc.) now route to a 404 page. (2025-08-30)
- [x] Add `UserContext` (provider + hook) to centralize user info across the app. (2025-08-30)
- [x] Apply new design language: straight edges, flat cards, bold typography, sharp dividers; removed soft shadows in favor of flat borders. (2025-08-30)
- [x] Tweak sidebar positioning and collapse behavior to overlap under topbar and show icons-only when collapsed. (2025-08-30)

## Routing
✅ Routing: Public routes (Landing, Login, Register, Docs) + nested app routes (Dashboard, Projects, Datasets, Admin, etc.)
## Visual Design
✅ Responsive design: All pages/components should be mobile-friendly and grid-based
- [x] Typography hierarchy
- [x] Minimal, modern, professional look

## Responsive Design
- [x] Desktop and mobile layouts

## Icons & Illustrations
- [x] Lucide/Heroicons for icons
- [ ] Undraw/HeroPatterns for illustrations

## API Integration
- [ ] Placeholder API calls for backend endpoints

## Code Organization
- [x] Components in /components
- [x] Pages in /pages
- [ ] Example usage of components

---

Check off each item as completed. Update this file as you progress.
