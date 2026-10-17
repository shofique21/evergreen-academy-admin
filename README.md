# evergreen-academy-admin

Evergreen Academy — Frontend Foundation

Enterprise School Management System (SMS) built with **Vue 3 Composition API**, **TypeScript (Strict Mode)**, **Vite**, **Pinia**, **Vue Router**, and **PrimeVue** (Aura preset).

---

## 1. Technology Stack & Design System

* **Framework**: Vue.js 3 (Composition API with `<script setup lang="ts">`)
* **Type Safety**: TypeScript in strict mode (`vue-tsc -b`)
* **Styling**: PrimeVue Aura Theme + Emerald & Slate semantic design tokens (`src/style.css`), responsive layouts, and glassmorphism panels.
* **State Management**: Pinia Store (`src/stores/auth.ts`)
* **Routing**: Vue Router 4 with reactive session guards and permission checking
* **Component Library**: PrimeVue 4 (Buttons, Forms, DataTables, Dialogs, Toast, Confirmation)
* **Unit Testing**: Vitest 5 + `@vue/test-utils` with happy-dom environment

---

## 2. Feature-Based Folder Structure

```
frontend/src/
├── assets/                  # Static brand assets and SVGs
├── components/
│   ├── common/              # Reusable design system primitives
│   │   ├── AppAlert.vue          # Semantic banner alerts (info/success/warn/danger)
│   │   ├── AppBreadcrumbs.vue    # Accessible breadcrumb trail
│   │   ├── DataTableWrapper.vue  # Filterable, paginated, searchable data table
│   │   ├── EmptyState.vue        # Semantic zero-state illustration and CTA
│   │   ├── ErrorState.vue        # Retryable error boundary with correlation ID
│   │   ├── FormField.vue         # Accessible label, required asterisk, and error hint
│   │   ├── LoadingState.vue      # Accessible progress indicators and skeletons
│   │   ├── PageHeader.vue        # Standard page title, subtitle, breadcrumbs, actions
│   │   └── StatusBadge.vue       # Domain-aware status pills with live dot indicators
│   └── nav/                 # Navigation shells
│       ├── AppSidebar.vue        # Collapsible & mobile-drawer persona navigation
│       └── AppTopNav.vue         # Top bar with user initials, session badges, sign-out
├── composables/             # Reusable business logic and wrappers
│   ├── useApi.ts                 # Type-safe async API runner with loading/error state
│   ├── useBreadcrumbs.ts         # Reactive route breadcrumb computer
│   ├── useConfirmModal.ts        # Standardized PrimeVue confirmation dialog wrapper
│   └── useNotification.ts        # Toast notifications helper (success/error/warn/info)
├── layouts/                 # Persona-specific layouts
│   ├── AdminLayout.vue           # Super Admin, Principal, and School Admin workspace
│   ├── TeacherLayout.vue         # Faculty workspace (attendance, marks, gradebook)
│   ├── StudentLayout.vue         # Student portal (curriculum, report cards, fee dues)
│   ├── ParentLayout.vue          # Guardian portal (child switcher, dues payment)
│   └── AppLayout.vue             # Dynamic master layout adapting to active persona
├── router/                  # Route definitions, session verification, and permission guards
├── services/                # Axios API client with CSRF, tokens, and error normalization
├── stores/                  # Pinia stores (authStore, user session, roles, permissions)
├── tests/                   # Component and composable unit tests (Vitest)
├── types/                   # Type-safe TypeScript domain contracts (Academics, SIS, Billing)
└── views/                   # Operational views backed by real REST endpoints
    ├── academics/                # Academic session and class structure configurations
    ├── auth/                     # Institutional login portal with quick persona switchers
    ├── dashboard/                # Operational telemetry and real-time KPI overview
    ├── error/                    # HTTP 403 (Forbidden) and HTTP 404 (Not Found) views
    ├── fees/                     # Invoices, fee heads, and MFS payment gateways
    ├── settings/                 # Institutional parameters and payment gateway keys
    ├── students/                 # Student Information System (SIS) and NCTB admissions
    └── users/                    # Multi-role user management and account status toggling
```

---

## 3. Personas & Adaptive Layouts

Evergreen Academy implements 4 dedicated persona layouts:
1. **AdminLayout** (`src/layouts/AdminLayout.vue`): Core academic control, user roles, student registry, fees, and telemetry.
2. **TeacherLayout** (`src/layouts/TeacherLayout.vue`): Focused on class rosters, syllabus, attendance marking, and NCTB grade tabulation.
3. **StudentLayout** (`src/layouts/StudentLayout.vue`): Student portal displaying class schedule, enrollment info, and published fee dues.
4. **ParentLayout** (`src/layouts/ParentLayout.vue`): Guardian portal providing child switcher, attendance summaries, and direct fee payment via bKash & SSLCommerz.

The master **AppLayout** (`src/layouts/AppLayout.vue`) dynamically senses the user's authenticated persona and renders the corresponding navigation items, badges, and view controls automatically.

---

## 4. Reusable Common Components & Accessibility

* **`FormField.vue`**: Accessible form wrapper providing `<label :for="id">`, mandatory `*` indicator, and `<p role="alert" aria-live="polite">` validation message mapping directly from backend Laravel error keys.
* **`StatusBadge.vue`**: Automatic severity and color mapping for domain statuses (`ACTIVE`, `INACTIVE`, `PAID`, `UNPAID`, `PARTIAL`, `PRESENT`, `ABSENT`, `LATE`, `PUBLISHED`, `DRAFT`, `CURRENT`).
* **`DataTableWrapper.vue`**: Wraps PrimeVue `DataTable` with built-in search debouncing, custom filters slot, action controls, total count badge, and zero-state fallback.
* **`EmptyState.vue`**: Accessible `role="status"` region with configurable icon, header, explanatory message, and action callback button.
* **`ErrorState.vue`**: Displays network or API failure messages with Laravel `correlation_id` code tracking and a retry action button.
* **`AppBreadcrumbs.vue`**: Accessible `<nav aria-label="Breadcrumb">` with interactive hierarchical routing.

---

## 5. API Client & Centralized Error Handling

The shared Axios client (`src/services/api.ts`) provides:
1. **Sanctum SPA Support**: `getCsrfCookie()` initializes CSRF tokens before stateful requests.
2. **Bearer Token Injection**: Auto-attaches `Authorization: Bearer <token>` when stored in localStorage.
3. **Correlation Tracking**: Captures `X-Correlation-ID` header from backend responses.
4. **Normalized Error Model**: Rejects with `ApiNormalizedError`:
   ```ts
   export interface ApiNormalizedError {
     message: string
     status?: number
     errorType?: string
     errors?: Record<string, string[]>
     correlationId?: string | null
   }
   ```
5. **Session Expiry**: Intercepts `401 Unauthorized` responses and automatically routes to `/login?expired=1`.

---

## 6. Authentication State & Route Guards

The route guard (`src/router/index.ts`) enforces:
1. **First-Load Session Hydration**: Calls `authStore.fetchUser()` on initial page load if uninitialized.
2. **Guest-Only Routes**: Redirects authenticated users from `/login` to `/dashboard`.
3. **Auth-Protected Routes**: Redirects unauthenticated visitors to `/login?redirect=<path>`.
4. **Permission Enforcement**: Verifies `to.meta.permission` against `authStore.hasPermission(permission)`. Unauthorized attempts are directed to the `/403` Forbidden view with the required permission displayed.
5. **Catch-All 404**: Unmatched paths route directly to `/404` Not Found view.

---

## 7. Development & Verification Commands

All commands run from `c:\laragon\www\Evergreen-Academy\frontend`:

```bash
# Run local Vite development server
cmd.exe /c npm run dev

# Run strict TypeScript check and production bundle build
cmd.exe /c npm run build

# Run Vitest unit test suite
cmd.exe /c npm test
```
