# DO BILL POS - AUTHORITATIVE 6-DOCUMENT PROJECT BLUEPRINT

> **Vibe Coding Architectural Framework & Documentation Standard**
>
> This document contains the complete 6 core architectural specifications required to maintain, scale, and extend the DO BILL POS enterprise retail system with 100% precision and zero ambiguity.

---

```
                                  FULL VIBE CODING WORKFLOW
                                  
  ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
  │   1. PRD    │ ──> │   2. TRD    │ ──> │ 3. APP FLOW │ ──> │  4. UI/UX   │
  │ Product Req │     │ Tech Stack  │     │ Navigation  │     │ Design System│
  └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
                                                                     │
  ┌─────────────┐     ┌─────────────┐                                │
  │ 6. IMPLEMENT│ <── │ 5. BACKEND  │ <──────────────────────────────┘
  │ Build Plan  │     │   SCHEMA    │
  └─────────────┘     └─────────────┘
```

---

## 1. PRD — Product Requirements Document

### 1.1 App Identity & Executive Summary
- **App Name**: DO BILL POS
- **Tagline**: High-Performance, Multi-Tenant Retail Billing & Inventory Management Engine
- **Problem Statement**: Small-to-medium retail store owners face slow checkout queues, complex inventory discrepancies across multiple product units (e.g. Box vs Pcs), unreliable thermal printing, and dangerous data cross-contamination when managing multiple stores or cashier staff.
- **Target User Personas**:
  1. **Store Owner / Super Admin**: Needs real-time sales reporting, revenue analytics, multi-tenant store switching, UPI VPA configuration, and staff access controls.
  2. **Store Cashier / Billing Executive**: Needs lightning-fast barcode scanning (<20ms response), fast cash/UPI payment toggling, item discounts, and immediate thermal receipt printing.
  3. **Inventory Manager**: Needs multi-unit stock tracking (Box, Pcs, Kg, Ltr, Mtr), low-stock alert thresholds, and batch cost price adjustments.

### 1.2 Core Functional Capabilities
- **High-Speed POS Checkout**: Barcode scanning, keyword search, item quantity multiplier, real-time GST tax calculation (0%, 5%, 12%, 18%, 28%), and cart discount engine.
- **Dynamic UPI Payment Generator**: Generates dynamic, compliant UPI QR codes embedded directly with the exact bill amount and store VPA.
- **ESC/POS Thermal Printing**: Binary command builder supporting 80mm & 58mm thermal paper over WebUSB, Bluetooth Serial, and Direct HTML Print.
- **Multi-Tenant Data Isolation**: Absolute database isolation per registered owner email (`workspace_owner`). Data from Account 1 is strictly invisible to Account 2.
- **Password Recovery & OTP Security**: Email verification via 6-digit OTP engine, 24-hour maximum session lifetime, and SHA-256 password hashing.

### 1.3 User Stories & Success Metrics
- *User Story 1*: "As a cashier, I want to scan product barcodes continuously so I can complete customer checkout in under 10 seconds without touching the mouse."
- *User Story 2*: "As a multi-store owner, I want to toggle between my grocery store and electronics shop instantly without data leaking between them."
- *Success Metrics*: <50ms barcode lookup latency, 100% tenant data isolation test score, 0% invoice calculation errors.

---

## 2. TRD — Technical Requirements Document

### 2.1 Architecture Diagram
```
+---------------------------------------------------------------------------------+
|                                 CLIENT LAYER                                    |
|   React 18 + TypeScript + Vite 5 + Tailwind CSS + Lucide Icons + Recharts      |
|   DirectPrintService (ESC/POS Builder) + HashRouter / BrowserRouter Fallback    |
+---------------------------------------------------------------------------------+
                                       │
                         REST API over HTTP (JSON Payloads)
                        Header: x-workspace-owner: email
                                       │
+---------------------------------------------------------------------------------+
|                                 SERVER LAYER                                    |
|   Express 4 + Node.js Runtime (Port 3000)                                       |
|   Workspace Isolation Middleware + SHA-256 Auth + OTP Generator Engine          |
+---------------------------------------------------------------------------------+
                                       │
                       Parameterized Prepared SQL Statements
                                       │
+---------------------------------------------------------------------------------+
|                                DATABASE LAYER                                   |
|   SQLite3 Persistent Engine (/data/dobill.db)                                   |
|   Strict Multi-Tenant Row Bounds: WHERE workspace_owner = ?                    |
+---------------------------------------------------------------------------------+
```

### 2.2 Tech Stack Matrix
| Layer | Technology | Version / Tool | Purpose |
|-------|------------|----------------|---------|
| **Frontend Framework** | React + TypeScript | React 18 / TS 5 | Type-safe, component-driven SPA interface |
| **Build Tooling** | Vite + esbuild | Vite 5 | Instant HMR dev server & single-bundle CJS server build |
| **Styling Engine** | Tailwind CSS | Tailwind v4 | Utility-first responsive design system |
| **Icons & Visuals** | Lucide React | Latest | Crisp vector iconography |
| **Backend Runtime** | Express.js / Node.js | Express 4 / Node 18+ | REST API routing and request middleware |
| **Database Engine** | SQLite3 / better-sqlite3 | SQLite 3.x | Zero-latency embedded disk database |
| **Printing Driver** | ESC/POS Binary Protocol | Native TS Service | Raw binary command stream for thermal printers |

---

## 3. App Flow — User Navigation & Workflows

### 3.1 Navigation Diagram
```
                          ┌──────────────────────────┐
                          │   Access Terminal (Auth)  │
                          └─────────────┬────────────┘
                                        │ (Login / OTP Verify)
                                        ▼
                          ┌──────────────────────────┐
                          │     Dashboard Overview   │
                          └─────────────┬────────────┘
                                        │
      ┌──────────────────┬──────────────┼──────────────┬──────────────────┐
      ▼                  ▼              ▼              ▼                  ▼
┌────────────┐    ┌────────────┐  ┌───────────┐  ┌───────────┐     ┌─────────────┐
│  POS Billing│   │ Inventory  │  │   Sales   │  │ Analytics │     │ Shop & UPI  │
│ Terminal   │   │ Products   │  │  Records  │  │  Reports  │     │ Settings    │
└────────────┘    └────────────┘  └───────────┘  └───────────┘     └─────────────┘
```

### 3.2 Core Workflows
1. **Authentication & Session Workflow**:
   - User opens terminal -> Session check validates local storage token and 24h expiration timestamp.
   - If invalid/expired -> Prompts for Username/Email + Password.
   - For Forgot Password -> Input Email -> System generates 6-digit OTP -> Validates OTP -> Sets new password.
2. **POS Billing Workflow**:
   - Cashier enters `/pos` -> Auto-focuses barcode scanner input.
   - Barcode scan or quick search adds product to cart with default unit quantity.
   - Adjust quantity (Box/Pcs), apply GST tax or cart discount.
   - Click "Pay via UPI" -> Displays dynamic UPI QR code.
   - On payment confirmation -> Saves sale invoice in SQLite, deducts stock automatically, and sends binary stream to ESC/POS thermal printer.
3. **Workspace Switching Workflow**:
   - Owner selects active store in sidebar workspace selector.
   - Updates `x-workspace-owner` API header -> Backend re-filters all SQL queries to the target workspace -> UI updates without page reload.

---

## 4. UI/UX Design System Brief

### 4.1 Design Philosophy & Aesthetics
- **Style**: High-density, modern retail terminal designed for long hours of cashier eye comfort.
- **Color Palette**:
  - Primary / Accent: Indigo-600 (`#4F46E5`) - Primary buttons, active nav states.
  - Background: Off-White / Slate-50 (`#F8FAFC`) - Low-glare surface.
  - Card Surfaces: Pure White (`#FFFFFF`) with 1px border Slate-100 (`#E2E8F0`).
  - Success State: Emerald-600 (`#059669`) - Payment complete, stock optimal.
  - Warning State: Amber-600 (`#D97706`) - Low stock threshold, session warning.
  - Danger State: Red-600 (`#DC2626`) - Stock empty, bill cancelled.
- **Typography**: Plus Jakarta Sans for Display Numbers/Currency, Inter for Body & Form Controls.
- **Touch Ergonomics**: All interactive elements maintain a minimum 44px touch target for touchscreen POS terminals.

---

## 5. Backend Schema & Security Rules

### 5.1 Database Entity Relationship Diagram
```
┌───────────────────────────────────────┐
│                users                  │
├───────────────────────────────────────┤
│ id (PK)                               │
│ username (UNIQUE)                     │
│ email (INDEX)                         │
│ password_hash                         │
│ store_name                            │
│ reset_otp                             │
│ reset_otp_expiry                      │
└──────────────────┬────────────────────┘
                   │ 1 : 1 Workspace Owner
                   ▼
┌───────────────────────────────────────┐         ┌───────────────────────────────────────┐
│               products                │         │                 sales                 │
├───────────────────────────────────────┤         ├───────────────────────────────────────┤
│ id (PK)                               │         │ id (PK)                               │
│ workspace_owner (FK INDEX)            │         │ workspace_owner (FK INDEX)            │
│ name                                  │         │ receipt_no                            │
│ barcode (INDEX)                       │         │ customer_name, customer_phone         │
│ price, cost_price, unit, stock        │         │ items_json (JSON Array)               │
│ gst_rate, min_stock_alert             │         │ subtotal, tax, discount, total        │
└───────────────────────────────────────┘         │ payment_method, created_at            │
                                                  └───────────────────────────────────────┘
```

### 5.2 Mandatory Security Rule
> **Parametric Workspace Binding Requirement**:
> ALL SQL queries executed against `products`, `sales`, `shop_details`, or `invitations` MUST bind `workspace_owner` as an explicit parameter:
> ```sql
> SELECT * FROM products WHERE workspace_owner = ? ORDER BY name ASC;
> ```
> Global queries without workspace filtering are strictly prohibited to prevent multi-tenant data leaks.

---

## 6. Implementation Plan & Build Sequence

### 6.1 Roadmap Phases
1. **Phase 1: Multi-Tenant Backend Isolation Engine**: Setup SQLite parameterized queries, auth routes, session tokens, and workspace isolation headers.
2. **Phase 2: High-Speed POS Terminal**: Implement barcode scanning listeners, multi-unit quantity multipliers, real-time GST calculations, and cart management.
3. **Phase 3: Sales History & ESC/POS Printing**: Build `DirectPrintService.ts` for thermal printers, printable invoices, and revenue reporting.
4. **Phase 4: Store Switcher & Account Recovery**: Build workspace dropdown, 6-digit email OTP password recovery, and staff permissions.
5. **Phase 5: Desktop Executable & Mobile PWA**: Build Electron/Native desktop runner scripts (`main.cjs`, `preload.cjs`), manifest.json, and PWA offline fallback.
6. **Phase 6: Quality Verification & Audit**: Verify 100% multi-tenant data isolation and complete cross-account security testing.

---

### Verification Confirmation
- **Document Status**: Complete & Authoritative
- **System Alignment**: 100% Compliant with DO BILL POS full-stack architecture.
