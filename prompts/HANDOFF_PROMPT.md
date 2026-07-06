# Project Handoff: Valorant AI Content Automation

This document serves as the complete handoff specification and setup instruction prompt to continue development on a new PC or session.

---

## 🎯 Project Status Summary

- **Current Milestone**: Milestone 1 (Core Message Broker & API Gateway)
- **Completed Tasks**:
  - **Task 1.1 (Configure Monorepo Scaffolding)**: Root monorepo workspace configurations, TypeScript compilation bases, formatting standards, and git exclusions are fully implemented, compiling, and formatting cleanly.
  - **Task 1.2 (Implement Prisma PostgreSQL Relational Schema)**: Scaffolded the `@packages/database` shared library package, created relational schema models (`Job`, `Highlight`, `VideoMetadata`, `TTSAudioSync`, `YouTubeUpload`), successfully deployed the initial database migrations, and compiled the client type bindings.

---

## 💻 Setup Instructions for the New PC

To restore the local development environment and database state on your new PC, follow these steps exactly:

### Step 1: Install System Prerequisites

Ensure the following are installed and configured on the local Windows host / Linux environment:

1. **Node.js** (v18+ or v20+)
2. **pnpm** (`npm install -g pnpm`)
3. **PostgreSQL** (v15 or v16)
4. **Git**

### Step 2: Clone and Restore Codebase

Clone the project repository and switch to the active development branch:

```bash
git clone https://github.com/akangRio/valoAutomation.git
cd valoAutomation
git checkout phase1
```

### Step 3: Initialize local PostgreSQL Server

Ensure that PostgreSQL is running locally on port `5432`.
Run the following database queries under superuser/root privileges to provision the credentials and target database:

```sql
-- Create the state database
CREATE DATABASE state_db;

-- Update postgres user password to match project configuration
ALTER USER postgres WITH PASSWORD 'password';
```

### Step 4: Configure Local Environment Variables

Create a `.env` file at the root of the workspace directory (`/valoAutomation/.env`) containing:

```env
# Database Configuration
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/state_db?connection_limit=5&pool_timeout=10"
```

### Step 5: Restore Node Modules & Sync Migrations

Install dependencies and sync the database schema migrations locally:

```bash
# Install monorepo dependencies
pnpm install

# Run database migrations to provision the schema tables inside state_db
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/state_db?connection_limit=5&pool_timeout=10" pnpm --filter @packages/database run prisma:migrate

# Compile database type bindings and build the package
DATABASE_URL="postgresql://postgres:password@127.0.0.1:5432/state_db?connection_limit=5&pool_timeout=10" pnpm --filter @packages/database run build
```

### Step 6: Verify Environment Health

Run the workspace validation script to ensure typescript compiles and formatting is clean:

```bash
# Verify TypeScript compile
npx tsc --noEmit

# Verify Turborepo builds
pnpm run build
```

---

## 🚀 Immediate Next Tasks to Execute

You are now ready to tackle **Task 1.3: Implement Express API Gateway and Controllers**:

### Task 1.3 Objective:

Construct the central Express API Gateway, configure controller routing, and implement Zod validation middleware.

### Target Directory:

`apps/api-gateway`

### Acceptance Criteria to Complete:

1. `POST /api/v1/jobs` parses inbound payloads, performs Zod schema verification checks, and creates pending records in PostgreSQL via Prisma.
2. `GET /api/v1/jobs/:id` successfully returns real-time status and error logs.
3. Includes centralized, JSON-compliant error-catching middleware returning formatted response logs.

---

## 📝 Verification Logs File Check

For previous execution parameters and verification logs, check [verification_log.json](file:///home/student_03_c5def29c309c/valoAutomation/verification_log.json) at the workspace root.
