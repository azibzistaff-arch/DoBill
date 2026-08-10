# DO BILL POS - Enterprise Retail Billing & Inventory Management System

[![Build Status](https://img.shields.io/badge/Build-Passing-emerald)](https://github.com/dobill/pos)
[![Architecture](https://img.shields.io/badge/Architecture-Full%20Stack-indigo)](/PROJECT_BLUEPRINT.md)
[![Database](https://img.shields.io/badge/Database-SQLite%20Isolated-blue)](/PROJECT_BLUEPRINT.md)
[![Printing](https://img.shields.io/badge/Thermal%20Print-ESC%2FPOS-purple)](/PROJECT_BLUEPRINT.md)

DO BILL is a high-performance, offline-resilient Retail Point of Sale (POS) and Inventory Management System designed for small-to-medium retail businesses (grocery, apparel, electronics, hardware, general store).

It features instant barcode scanning, multi-unit stock tracking, dynamic UPI QR code payments, ESC/POS thermal printing, and strict multi-tenant row-level data isolation.

---

## Architecture & Blueprint Framework

This repository adheres strictly to the **6 Core Project Documents Framework**:

1. [**PRD (Product Requirements Document)**](/PROJECT_BLUEPRINT.md#1-prd--product-requirements-document) — Product vision, target personas, user stories, and core module specs.
2. [**TRD (Technical Requirements Document)**](/PROJECT_BLUEPRINT.md#2-trd--technical-requirements-document) — Technology stack, system architecture diagrams, and printer protocol specs.
3. [**App Flow (User Navigation)**](/PROJECT_BLUEPRINT.md#3-app-flow--user-navigation--workflows) — User navigation maps, POS checkout workflows, and workspace switching logic.
4. [**UI/UX Design Brief**](/PROJECT_BLUEPRINT.md#4-uiux-design-system-brief) — Design system, color palettes, typography scales, and ergonomics.
5. [**Backend Schema**](/PROJECT_BLUEPRINT.md#5-backend-schema--security-rules) — SQLite tables, parameterized SQL queries, and multi-tenant row-level isolation guarantees (`WHERE workspace_owner = ?`).
6. [**Implementation Plan**](/PROJECT_BLUEPRINT.md#6-implementation-plan--build-sequence) — Phase-by-phase build roadmap, security matrix, and verification steps.

---

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite 5, Tailwind CSS v4, Lucide Icons, Recharts, Motion/React.
- **Backend**: Express 4, Node.js (v18+), SQLite3 persistent database (`/data/dobill.db`).
- **Printing**: Native ESC/POS binary command stream builder (`DirectPrintService.ts`) for WebUSB, Bluetooth Serial, and browser direct print.
- **Security**: Parametric SQL queries, SHA-256 password hashing, 6-digit email OTP verification, and 24-hour session security.

---

## Key Features

- **High-Speed POS Checkout**: Lightning-fast product lookup via barcode scanner or keyword search (<20ms response time).
- **Multi-Unit Inventory**: Flexible tracking across multiple unit types (Pcs, Box, Kg, Ltr, Mtr) with batch cost pricing and low-stock alerts.
- **Dynamic UPI QR Codes**: Displays on-screen UPI QR codes automatically generated with the exact bill total and store VPA.
- **ESC/POS Thermal Printing**: Instant thermal printing on 80mm & 58mm paper rolls.
- **Multi-Tenant Data Isolation**: Multi-account workspace isolation where every query is strictly bound to the logged-in store owner (`workspace_owner`).
- **Account Recovery**: 6-Digit OTP verification sent directly to user email for password resets.

---

## Getting Started

### Prerequisites

- Node.js v18 or higher
- npm or yarn

### Installation & Development

```bash
# Install dependencies
npm install

# Start full-stack development server (Express + Vite on Port 3000)
npm run dev
```

The application will be accessible at `http://localhost:3000`.

### Production Build

```bash
# Build Vite client assets and compile esbuild server bundle
npm run build

# Start production server
npm start
```

---

## Documentation & Architecture Deep Dive

Read the complete system specification in [`PROJECT_BLUEPRINT.md`](/PROJECT_BLUEPRINT.md).
