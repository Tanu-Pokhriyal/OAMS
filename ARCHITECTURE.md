# Billboard Management System — Architecture & Design

## Table of Contents
- [1. High-Level Architecture](#1-high-level-architecture)
- [2. Roles](#2-roles)
- [3. Complete Callflow (6 Phases)](#3-complete-callflow-6-phases)
- [4. Campaign State Machine](#4-campaign-state-machine)
- [5. Data Model (ER Diagram)](#5-data-model-er-diagram)
- [6. Notification Events](#6-notification-events)
- [7. API Endpoints](#7-api-endpoints)
- [8. Tech Stack](#8-tech-stack)

---

## 1. High-Level Architecture

```mermaid
graph TB
    subgraph "Frontend (React + Vite)"
        CP["Client Portal"]
        AP["Admin Dashboard"]
        VP["Vendor Portal"]
    end

    subgraph "Real-Time Layer"
        SIO["Socket.IO Server"]
    end

    subgraph "Backend (Node.js + Express)"
        AUTH["Auth Service<br/>(JWT + Role-based)"]
        CAMP["Campaign Controller"]
        SURV["Site Survey Controller"]
        CREAT["Creatives Controller"]
        WO["Work Order Controller"]
        INST["Installation Controller"]
        INV["Invoice Controller"]
        NOTIF["Notification Controller"]
        PDF["PDF Generator"]
    end

    subgraph "Storage"
        MONGO[("MongoDB<br/>billboard_management")]
        UPLOAD["File Storage<br/>(Uploads / Cloud)"]
    end

    subgraph "External Services"
        MAPS["Google Maps API<br/>(GPS & Location)"]
        CAM["Device Camera API"]
    end

    CP & AP & VP -->|"HTTP + WebSocket"| AUTH
    AUTH --> CAMP & SURV & CREAT & WO & INST & INV
    CAMP & SURV & CREAT & WO & INST & INV --> MONGO
    SURV & INST --> UPLOAD
    SURV --> MAPS
    SURV --> CAM
    NOTIF --> SIO
    SIO -->|"Push Notifications"| CP & AP & VP
    SURV & INST --> PDF
```

---

## 2. Roles

| Role | Responsibilities |
|------|-----------------|
| **Client** | Creates campaigns, reviews installation reports, approves/rejects invoices |
| **Admin** | Reviews campaigns, allocates vendors, selects billboard images, creates work orders, manages creatives, forwards reports/invoices |
| **Vendor** | Conducts site surveys (uploads geotagged billboard photos), performs installations, uploads installation images, sends invoices |

---

## 3. Complete Callflow (6 Phases)

```mermaid
sequenceDiagram
    autonumber
    participant C as Client
    participant A as Admin
    participant V as Vendor

    rect rgb(230, 245, 255)
    Note over C,A: PHASE 1 — Campaign Creation & Review
    C->>A: Create Campaign (brief, budget, locations, dates)
    A->>A: Review Campaign Brief
    alt Approved
        A-->>C: ✅ Notify: Campaign Approved
    else Rejected
        A-->>C: ❌ Notify: Campaign Rejected (with reason)
    else Rework Required
        A-->>C: 🔄 Notify: Rework Required (remarks)
        C->>A: Resubmit Updated Campaign
        A->>A: Re-review Campaign
    end
    end

    rect rgb(255, 245, 230)
    Note over A,V: PHASE 2 — Vendor Allocation & Site Survey
    A->>V: Allocate Vendor to Campaign
    Note over V: Vendor notified of assignment
    V->>V: Ground team visits site(s)
    V->>V: Upload Billboard Images<br/>(size, description, location/GPS,<br/>media type, multiple photos)
    V-->>A: Site Survey Complete (images + metadata)
    Note over V: PDF Report auto-generated<br/>from uploaded images
    end

    rect rgb(230, 255, 230)
    Note over A,V: PHASE 3 — Image Selection & Creatives
    A->>A: Review Site Survey PDF
    A->>A: Select images (1 or many from survey)
    A->>A: Prepare Creatives for each selected image
    Note over A: Creatives processing complete
    end

    rect rgb(255, 230, 245)
    Note over A,V: PHASE 4 — Work Order & Installation
    A->>V: Create & Send Work Order<br/>(linked to creatives + same vendor)
    V->>V: Start Installation
    V->>V: Upload installation images<br/>(one per creative approved)
    V-->>A: Installation Complete<br/>(Installation Report auto-generated)
    end

    rect rgb(245, 245, 230)
    Note over C,A: PHASE 5 — Client Verification
    A->>C: Send Installation Report
    alt Accepted
        C-->>A: ✅ Installation Accepted
    else Rejected
        C-->>A: ❌ Installation Rejected (remarks)
        A-->>V: 🔄 Rework Installation
        V->>V: Redo installation & re-upload
        V-->>A: Updated Installation Report
        A->>C: Resend Report
    else Rework Required
        C-->>A: 🔄 Rework Required (remarks)
        A-->>V: Forward rework instructions
    end
    end

    rect rgb(240, 230, 255)
    Note over C,V: PHASE 6 — Invoicing & Closure
    A-->>V: Notify: Installation Accepted
    V->>A: Send Invoice
    A->>C: Forward Invoice
    alt Invoice Accepted
        C-->>A: ✅ Invoice Accepted
        A->>A: Close Work Order
        A-->>V: Notify: Work Order Closed
    else Invoice Rejected
        C-->>A: ❌ Invoice Rejected (remarks)
        A-->>V: Notify: Update Invoice
        V->>A: Resend Updated Invoice
        A->>C: Forward Updated Invoice
    end
    end
```

### Phase Summary

| Phase | Key Actions |
|-------|------------|
| **1. Campaign Creation & Review** | Client creates → Admin approves/rejects/rework |
| **2. Vendor Allocation & Site Survey** | Admin assigns vendor → Vendor visits sites, uploads geotagged billboard photos → PDF auto-generated |
| **3. Image Selection & Creatives** | Admin selects images from survey → Prepares creatives for each |
| **4. Work Order & Installation** | Admin creates work order → Same vendor installs → Uploads proof images → Report generated |
| **5. Client Verification** | Admin sends report → Client accepts/rejects/rework |
| **6. Invoicing & Closure** | Vendor invoices → Admin forwards → Client accepts/rejects → Admin closes work order |

---

## 4. Campaign State Machine

**17 states** covering the full lifecycle:

```mermaid
stateDiagram-v2
    [*] --> pending_approval: Client creates campaign

    pending_approval --> approved: Admin approves
    pending_approval --> rejected: Admin rejects
    pending_approval --> rework_required: Admin requests rework

    rework_required --> pending_approval: Client resubmits

    approved --> vendor_allocated: Admin allocates vendor

    vendor_allocated --> survey_in_progress: Vendor starts site survey

    survey_in_progress --> survey_completed: Vendor uploads images + PDF generated

    survey_completed --> creatives_in_progress: Admin selects images & starts creatives

    creatives_in_progress --> creatives_ready: Admin finishes creatives

    creatives_ready --> work_order_issued: Admin creates work order

    work_order_issued --> installation_in_progress: Vendor starts installation

    installation_in_progress --> installation_completed: Vendor uploads install images + report

    installation_completed --> client_verified: Client accepts installation
    installation_completed --> client_disputed: Client rejects/requests rework

    client_disputed --> installation_in_progress: Vendor reworks installation

    client_verified --> invoiced: Vendor sends invoice via Admin

    invoiced --> invoice_accepted: Client accepts invoice
    invoiced --> invoice_rejected: Client rejects invoice

    invoice_rejected --> invoiced: Vendor resends updated invoice

    invoice_accepted --> closed: Admin closes work order

    closed --> [*]
    rejected --> [*]
```

### Status Transitions Table

| From | To | Triggered By | Action |
|------|----|-------------|--------|
| — | `pending_approval` | Client | Create campaign |
| `pending_approval` | `approved` | Admin | Approve campaign |
| `pending_approval` | `rejected` | Admin | Reject campaign |
| `pending_approval` | `rework_required` | Admin | Request rework (with remarks) |
| `rework_required` | `pending_approval` | Client | Resubmit updated campaign |
| `approved` | `vendor_allocated` | Admin | Allocate vendor |
| `vendor_allocated` | `survey_in_progress` | Vendor | Start site survey |
| `survey_in_progress` | `survey_completed` | Vendor | Upload images (PDF auto-generated) |
| `survey_completed` | `creatives_in_progress` | Admin | Select images, begin creatives |
| `creatives_in_progress` | `creatives_ready` | Admin | Finish creatives |
| `creatives_ready` | `work_order_issued` | Admin | Create work order |
| `work_order_issued` | `installation_in_progress` | Vendor | Start installation |
| `installation_in_progress` | `installation_completed` | Vendor | Upload install images + report |
| `installation_completed` | `client_verified` | Client | Accept installation |
| `installation_completed` | `client_disputed` | Client | Reject/rework installation |
| `client_disputed` | `installation_in_progress` | Vendor | Redo installation |
| `client_verified` | `invoiced` | Vendor | Send invoice |
| `invoiced` | `invoice_accepted` | Client | Accept invoice |
| `invoiced` | `invoice_rejected` | Client | Reject invoice (with remarks) |
| `invoice_rejected` | `invoiced` | Vendor | Resend updated invoice |
| `invoice_accepted` | `closed` | Admin | Close work order |

---

## 5. Data Model (ER Diagram)

```mermaid
erDiagram
    USER {
        ObjectId _id PK
        String name
        String email UK
        String password
        Enum role "admin | client | vendor"
        Date createdAt
    }

    CAMPAIGN {
        ObjectId _id PK
        String title
        String brief
        Number budget
        StringArray targetLocations
        Date startDate
        Date endDate
        Enum status "17 states"
        ObjectId clientId FK
        ObjectId vendorId FK
        String adminRemarks
        Date createdAt
        Date updatedAt
    }

    SITE_SURVEY {
        ObjectId _id PK
        ObjectId campaignId FK
        ObjectId vendorId FK
        Array images "embedded SurveyImage"
        String pdfUrl
        Enum status "pending | completed"
        Date createdAt
    }

    SURVEY_IMAGE {
        String imageUrl
        String description
        String size
        GeoJSON location "lat and lng"
        String locationAddress
        Enum mediaType "6 types"
        Boolean selectedByAdmin
    }

    CREATIVE {
        ObjectId _id PK
        ObjectId campaignId FK
        ObjectId surveyImageRef FK
        String creativeImageUrl
        String description
        Enum status "pending | processed"
        Date createdAt
    }

    WORK_ORDER {
        ObjectId _id PK
        ObjectId campaignId FK
        ObjectId vendorId FK
        Array creativeIds FK
        Enum status "issued | in_progress | completed | closed"
        Date issuedDate
        Date closedDate
    }

    INSTALLATION {
        ObjectId _id PK
        ObjectId workOrderId FK
        ObjectId campaignId FK
        ObjectId vendorId FK
        Array images "install proof"
        String reportPdfUrl
        Enum status "in_progress | completed | disputed | verified"
        String clientRemarks
        Date createdAt
    }

    INVOICE {
        ObjectId _id PK
        ObjectId campaignId FK
        ObjectId workOrderId FK
        ObjectId vendorId FK
        Number amount
        String invoiceFileUrl
        Enum status "pending | accepted | rejected"
        String clientRemarks
        Date createdAt
        Date updatedAt
    }

    NOTIFICATION {
        ObjectId _id PK
        ObjectId userId FK
        String title
        String message
        Enum type "14 event types"
        ObjectId referenceId
        String referenceModel
        Boolean read
        Date createdAt
    }

    USER ||--o{ CAMPAIGN : "creates (client)"
    USER ||--o{ CAMPAIGN : "assigned to (vendor)"
    CAMPAIGN ||--|| SITE_SURVEY : "has"
    SITE_SURVEY ||--o{ SURVEY_IMAGE : "contains"
    CAMPAIGN ||--o{ CREATIVE : "has"
    SURVEY_IMAGE ||--o| CREATIVE : "selected for"
    CAMPAIGN ||--|| WORK_ORDER : "has"
    WORK_ORDER ||--o{ CREATIVE : "references"
    WORK_ORDER ||--|| INSTALLATION : "has"
    CAMPAIGN ||--|| INVOICE : "has"
    USER ||--o{ NOTIFICATION : "receives"
```

### Media Types (for Survey Images)
| Value | Display Name |
|-------|-------------|
| `vinyl` | Vinyl |
| `one_way` | One Way |
| `sunboard` | Sunboard |
| `no_lit_board` | No-Lit Board |
| `glow_sign_board` | Glow Sign Board |
| `acrylic_board` | Acrylic Board |

---

## 6. Notification Events

```mermaid
graph LR
    subgraph "Notification Events"
        N1["campaign_reviewed<br/>→ Client"]
        N2["campaign_rework<br/>→ Client"]
        N3["vendor_allocated<br/>→ Vendor"]
        N4["survey_completed<br/>→ Admin"]
        N5["creatives_ready<br/>→ Admin internal"]
        N6["work_order_issued<br/>→ Vendor"]
        N7["installation_completed<br/>→ Admin"]
        N8["installation_report_sent<br/>→ Client"]
        N9["installation_verified<br/>→ Admin then Vendor"]
        N10["installation_disputed<br/>→ Admin"]
        N11["invoice_received<br/>→ Client"]
        N12["invoice_accepted<br/>→ Admin"]
        N13["invoice_rejected<br/>→ Admin then Vendor"]
        N14["work_order_closed<br/>→ Vendor"]
    end

    subgraph "Socket.IO Rooms"
        R1["room: user_{userId}"]
        R2["room: role_admin"]
    end

    N1 & N2 --> R1
    N3 & N6 & N14 --> R1
    N4 & N7 & N10 & N12 & N13 --> R2
    N8 & N11 --> R1
    N9 --> R1
```

### Notification Events Detail

| # | Event | Recipient | Trigger |
|---|-------|-----------|---------|
| 1 | `campaign_reviewed` | Client | Admin approves or rejects campaign |
| 2 | `campaign_rework` | Client | Admin requests campaign rework |
| 3 | `vendor_allocated` | Vendor | Admin assigns vendor to campaign |
| 4 | `survey_completed` | Admin | Vendor completes site survey |
| 5 | `creatives_ready` | Admin (internal) | Creatives processing finished |
| 6 | `work_order_issued` | Vendor | Admin creates work order |
| 7 | `installation_completed` | Admin | Vendor finishes installation |
| 8 | `installation_report_sent` | Client | Admin forwards installation report |
| 9 | `installation_verified` | Admin → Vendor | Client accepts installation |
| 10 | `installation_disputed` | Admin | Client rejects installation |
| 11 | `invoice_received` | Client | Admin forwards invoice |
| 12 | `invoice_accepted` | Admin | Client accepts invoice |
| 13 | `invoice_rejected` | Admin → Vendor | Client rejects invoice |
| 14 | `work_order_closed` | Vendor | Admin closes work order |

---

## 7. API Endpoints

| Resource | Method | Endpoint | Role | Description |
|----------|--------|----------|------|-------------|
| **Auth** | POST | `/api/auth/register` | Public | Register user |
| **Auth** | POST | `/api/auth/login` | Public | Login, returns JWT |
| **Campaign** | POST | `/api/campaigns` | Client | Create new campaign |
| **Campaign** | GET | `/api/campaigns` | All | List campaigns (filtered by role) |
| **Campaign** | GET | `/api/campaigns/:id` | All | Get campaign details |
| **Campaign** | PUT | `/api/campaigns/:id` | Client | Update campaign (resubmit) |
| **Campaign** | PATCH | `/api/campaigns/:id/review` | Admin | Approve/reject/rework campaign |
| **Campaign** | PATCH | `/api/campaigns/:id/allocate-vendor` | Admin | Assign vendor |
| **Site Survey** | POST | `/api/site-surveys` | Vendor | Create survey with images |
| **Site Survey** | GET | `/api/site-surveys/:campaignId` | Admin, Vendor | Get survey for campaign |
| **Site Survey** | PATCH | `/api/site-surveys/:id/select-images` | Admin | Select images from survey |
| **Creative** | POST | `/api/creatives` | Admin | Create creative from selected image |
| **Creative** | GET | `/api/creatives/:campaignId` | Admin, Vendor | List creatives for campaign |
| **Creative** | PATCH | `/api/creatives/:id` | Admin | Update creative status |
| **Work Order** | POST | `/api/work-orders` | Admin | Create work order |
| **Work Order** | GET | `/api/work-orders/:id` | Admin, Vendor | Get work order details |
| **Work Order** | PATCH | `/api/work-orders/:id/close` | Admin | Close work order |
| **Installation** | POST | `/api/installations` | Vendor | Start installation + upload images |
| **Installation** | GET | `/api/installations/:workOrderId` | All | Get installation details |
| **Installation** | PATCH | `/api/installations/:id/verify` | Client | Accept/reject/rework installation |
| **Invoice** | POST | `/api/invoices` | Vendor | Create invoice |
| **Invoice** | GET | `/api/invoices/:campaignId` | All | Get invoice for campaign |
| **Invoice** | PATCH | `/api/invoices/:id/review` | Client | Accept/reject invoice |
| **Invoice** | PUT | `/api/invoices/:id` | Vendor | Update rejected invoice |
| **Notification** | GET | `/api/notifications` | All | Get user's notifications |
| **Notification** | PATCH | `/api/notifications/:id/read` | All | Mark notification as read |

---

## 8. Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| UI Components | Tailwind CSS / Material UI |
| State Management | React Context / Zustand |
| Backend | Node.js + Express |
| Database | MongoDB + Mongoose |
| Authentication | JWT (JSON Web Tokens) |
| Real-Time | Socket.IO |
| File Uploads | Multer (local) / Cloud Storage |
| PDF Generation | PDFKit / Puppeteer |
| Maps & GPS | Google Maps JavaScript API |
| Camera | HTML5 MediaDevices API |
