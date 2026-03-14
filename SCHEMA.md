# FlowCare Database Schema

## Entity-Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌──────────────┐
│   branches   │       │  service_types   │       │    staff     │
├──────────────┤       ├──────────────────┤       ├──────────────┤
│ id (PK)      │──┐    │ id (PK)          │──┐    │ id (PK)      │
│ name         │  │    │ name             │  │    │ name         │
│ location     │  │    │ description      │  │    │ email        │
│ phone        │  │    │ durationMinutes  │  │    │ password     │
│ createdAt    │  │    │ price            │  │    │ role (ENUM)  │
│ updatedAt    │  │    │ branchId (FK)────│──┘    │ branchId(FK) │──┐
└──────────────┘  │    │ createdAt        │       │ createdAt    │  │
                  │    │ updatedAt        │       │ updatedAt    │  │
                  │    └──────────────────┘       └──────────────┘  │
                  │              │                       │          │
                  │              │ M:N                   │          │
                  │              ▼                       ▼          │
                  │    ┌──────────────────┐                         │
                  │    │ staff_services   │ (Junction)              │
                  │    ├──────────────────┤                         │
                  │    │ id (PK)          │                         │
                  │    │ staffId (FK)─────│─────────────────────────┘
                  │    │ serviceTypeId(FK)│
                  │    │ createdAt        │
                  │    │ updatedAt        │
                  │    └──────────────────┘
                  │
                  │    ┌──────────────────┐
                  │    │     slots        │
                  │    ├──────────────────┤
                  ├───▶│ branchId (FK)    │
                  │    │ id (PK)          │
                  │    │ serviceTypeId(FK)│
                  │    │ staffId (FK)     │ (optional)
                  │    │ date             │
                  │    │ startTime        │
                  │    │ endTime          │
                  │    │ isBooked         │
                  │    │ deletedAt        │ (soft delete)
                  │    │ createdAt        │
                  │    │ updatedAt        │
                  │    └──────────────────┘
                  │              │
                  │              │ 1:1
                  │              ▼
                  │    ┌──────────────────┐       ┌──────────────┐
                  │    │  appointments    │       │  customers   │
                  │    ├──────────────────┤       ├──────────────┤
                  ├───▶│ branchId (FK)    │       │ id (PK)      │
                       │ id (PK)          │       │ name         │
                       │ customerId (FK)──│──────▶│ email        │
                       │ slotId (FK)      │       │ password     │
                       │ serviceTypeId(FK)│       │ phone        │
                       │ staffId (FK)     │       │ idImage      │
                       │ status (ENUM)    │       │ createdAt    │
                       │ notes            │       │ updatedAt    │
                       │ attachment       │       └──────────────┘
                       │ createdAt        │
                       │ updatedAt        │
                       └──────────────────┘

                       ┌──────────────────┐
                       │   audit_logs     │
                       ├──────────────────┤
                       │ id (PK)          │
                       │ action           │
                       │ actorId          │
                       │ actorRole        │
                       │ targetType       │
                       │ targetId         │
                       │ branchId         │
                       │ metadata (JSONB) │
                       │ createdAt        │
                       └──────────────────┘
```

## Table Definitions

### 1. `branches`

Central entity representing clinic locations.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | UUID | No | `gen_random_uuid()` | **PRIMARY KEY** |
| name | VARCHAR(255) | No | — | Required |
| location | VARCHAR(255) | No | — | Required |
| phone | VARCHAR(255) | Yes | `NULL` | — |
| createdAt | TIMESTAMP | No | `NOW()` | Auto-managed |
| updatedAt | TIMESTAMP | No | `NOW()` | Auto-managed |

### 2. `service_types`

Services offered at each branch (e.g., General Checkup, Dental Cleaning).

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | UUID | No | `gen_random_uuid()` | **PRIMARY KEY** |
| name | VARCHAR(255) | No | — | Required |
| description | TEXT | Yes | `NULL` | — |
| durationMinutes | INTEGER | No | `30` | — |
| price | DECIMAL(10,3) | Yes | `0` | OMR (3 decimals) |
| branchId | UUID | No | — | **FK → branches.id** |
| createdAt | TIMESTAMP | No | `NOW()` | Auto-managed |
| updatedAt | TIMESTAMP | No | `NOW()` | Auto-managed |

### 3. `staff`

Staff members with role-based access control.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | UUID | No | `gen_random_uuid()` | **PRIMARY KEY** |
| name | VARCHAR(255) | No | — | Required |
| email | VARCHAR(255) | No | — | **UNIQUE**, Required |
| password | VARCHAR(255) | No | — | Hashed (bcrypt) |
| role | ENUM('admin','manager','staff') | No | `'staff'` | — |
| branchId | UUID | Yes | `NULL` | **FK → branches.id** (NULL for admins) |
| createdAt | TIMESTAMP | No | `NOW()` | Auto-managed |
| updatedAt | TIMESTAMP | No | `NOW()` | Auto-managed |

### 4. `customers`

Registered patients/clients.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | UUID | No | `gen_random_uuid()` | **PRIMARY KEY** |
| name | VARCHAR(255) | No | — | Required |
| email | VARCHAR(255) | No | — | **UNIQUE**, Required |
| password | VARCHAR(255) | No | — | Hashed (bcrypt) |
| phone | VARCHAR(255) | Yes | `NULL` | — |
| idImage | VARCHAR(255) | No | — | File path to uploaded ID |
| createdAt | TIMESTAMP | No | `NOW()` | Auto-managed |
| updatedAt | TIMESTAMP | No | `NOW()` | Auto-managed |

### 5. `slots`

Available time slots for booking. Supports soft deletes with configurable retention.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | UUID | No | `gen_random_uuid()` | **PRIMARY KEY** |
| branchId | UUID | No | — | **FK → branches.id** |
| serviceTypeId | UUID | No | — | **FK → service_types.id** |
| staffId | UUID | Yes | `NULL` | **FK → staff.id** |
| date | DATEONLY | No | — | `YYYY-MM-DD` |
| startTime | TIME | No | — | `HH:MM:SS` |
| endTime | TIME | No | — | `HH:MM:SS` |
| isBooked | BOOLEAN | No | `false` | — |
| deletedAt | TIMESTAMP | Yes | `NULL` | Soft delete marker |
| createdAt | TIMESTAMP | No | `NOW()` | Auto-managed |
| updatedAt | TIMESTAMP | No | `NOW()` | Auto-managed |

**Soft Delete Retention**: Records with `deletedAt` are automatically cleaned up after 30 days (configurable via `SOFT_DELETE_RETENTION_DAYS`).

### 6. `appointments`

Booked appointments linking customers to slots.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | UUID | No | `gen_random_uuid()` | **PRIMARY KEY** |
| customerId | UUID | No | — | **FK → customers.id** |
| slotId | UUID | No | — | **FK → slots.id**, UNIQUE |
| branchId | UUID | No | — | **FK → branches.id** |
| serviceTypeId | UUID | No | — | **FK → service_types.id** |
| staffId | UUID | Yes | `NULL` | **FK → staff.id** |
| status | ENUM('booked','checked-in','no-show','completed','cancelled') | No | `'booked'` | — |
| notes | TEXT | Yes | `NULL` | — |
| attachment | VARCHAR(255) | Yes | `NULL` | File path |
| createdAt | TIMESTAMP | No | `NOW()` | Auto-managed |
| updatedAt | TIMESTAMP | No | `NOW()` | Auto-managed |

### 7. `staff_services` (Junction Table)

Many-to-many relationship between staff and service types.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | UUID | No | `gen_random_uuid()` | **PRIMARY KEY** |
| staffId | UUID | No | — | **FK → staff.id** |
| serviceTypeId | UUID | No | — | **FK → service_types.id** |
| createdAt | TIMESTAMP | No | `NOW()` | Auto-managed |
| updatedAt | TIMESTAMP | No | `NOW()` | Auto-managed |

### 8. `audit_logs`

Immutable audit trail for all write operations.

| Column | Type | Nullable | Default | Constraints |
|--------|------|----------|---------|-------------|
| id | UUID | No | `gen_random_uuid()` | **PRIMARY KEY** |
| action | VARCHAR(255) | No | — | e.g., `appointment.create` |
| actorId | UUID | No | — | User who performed action |
| actorRole | VARCHAR(255) | No | — | e.g., `admin`, `customer` |
| targetType | VARCHAR(255) | No | — | e.g., `appointment`, `slot` |
| targetId | UUID | No | — | ID of affected entity |
| branchId | UUID | Yes | `NULL` | Branch scope for filtering |
| metadata | JSONB | No | `{}` | Additional context |
| createdAt | TIMESTAMP | No | `NOW()` | Immutable (no updatedAt) |

## Relationships Summary

| Relationship | Type | Description |
|-------------|------|-------------|
| Branch → ServiceType | 1:N | Each branch offers multiple services |
| Branch → Staff | 1:N | Staff belong to a branch (except admins) |
| Branch → Slot | 1:N | Slots are scoped to branches |
| Branch → Appointment | 1:N | Appointments are scoped to branches |
| ServiceType → Slot | 1:N | Slots are for specific service types |
| ServiceType → Appointment | 1:N | Appointments are for specific services |
| Staff ↔ ServiceType | M:N | Staff can serve multiple service types (via `staff_services`) |
| Staff → Slot | 1:N | Staff can be assigned to slots |
| Staff → Appointment | 1:N | Staff can be assigned to appointments |
| Customer → Appointment | 1:N | Customers can have multiple appointments |
| Slot → Appointment | 1:1 | Each slot can have at most one appointment |

## Indexes

- `staff.email` — UNIQUE
- `customers.email` — UNIQUE
- `appointments.slotId` — UNIQUE (one appointment per slot)
- All foreign keys are automatically indexed by PostgreSQL

## Notes

- **UUIDs**: All primary keys use UUID v4 for security and distributed-safe IDs
- **Timestamps**: Managed by Sequelize (`createdAt`, `updatedAt`)
- **Soft Deletes**: Only `slots` table uses soft deletes (manual `deletedAt` field)
- **Monetary**: Uses `DECIMAL(10,3)` for OMR (Omani Rial, 3 decimal places)
- **Passwords**: Hashed with bcrypt (12 rounds) before storage
- **Audit Trail**: `audit_logs` is append-only (no `updatedAt`)
