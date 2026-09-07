# Terminal Start Commands Reference

This guide provides a comprehensive list of terminal commands to set up, run, test, and manage the **AI-powered CRM** project (Next.js frontend + FastAPI backend).

---

## 🚀 Quick Start (TL;DR)

### Option A: Local Native Development (Recommended)

Run setup once, then start the Web and API services in separate terminal windows:

```bash
# 1. Install dependencies & set up environments
npm install
cp apps/web/.env.example apps/web/.env.local
python -m venv apps/api/.venv
apps/api/.venv/bin/python -m pip install -e "apps/api[dev]"  # macOS/Linux
# apps/api/.venv/Scripts/python -m pip install -e "apps/api[dev]"  # Windows
cp apps/api/.env.example apps/api/.env

# 2. Setup database & seed demo data
createdb crm_dev
npm run api:migrate
npm run api:seed

# 3. Start Development Servers (in two separate terminals)
# Terminal 1: Web App (http://localhost:3000)
npm run dev

# Terminal 2: FastAPI Backend (http://localhost:8000)
npm run api
```

---

### Option B: Docker Stack Development

```bash
# Start PostgreSQL, Redis, and FastAPI in background
npm run up

# View live container logs
npm run logs

# Start Next.js web application separately
npm run dev

# Tear down Docker services
npm run down
```

---

## 📋 Complete Command Reference

### 1. Development & Server Start Commands

| Command | Alternative (`make`) | Description | Default URL / Port |
| :--- | :--- | :--- | :--- |
| `npm run dev` | `make web` | Starts Next.js development server (with HMR) | `http://localhost:3000` |
| `npm run api` | `make api` | Starts FastAPI backend server (with Uvicorn auto-reload) | `http://localhost:8000` |
| `npm run up` | `make up` | Starts Docker services (PostgreSQL, Redis, API) | API on `:8000`, DB on `:5433` |
| `npm run down` | `make down` | Stops and removes Docker stack containers | - |
| `npm run logs` | `make logs` | Tails live log output from Docker containers | - |

---

### 2. Initial Setup & Installation

| Command | Alternative (`make`) | Description |
| :--- | :--- | :--- |
| `npm install` | `make install-web` | Installs root & Next.js workspace Node modules |
| `make install-api` | - | Creates Python venv at `apps/api/.venv` and installs API package in editable mode |
| `make install` | `make install` | Runs both `install-web` and `install-api` |

---

### 3. Database & Migration Commands

| Command | Alternative (`make`) | Description |
| :--- | :--- | :--- |
| `npm run api:migrate` | `make migrate` | Applies all pending Alembic database migrations (`upgrade head`) |
| `npm run api:seed` | `make seed` | Seeds database with demo tenant (Calder Freightways) and test user accounts |
| `npm run api:revision -- -m "msg"` | `make revision m="msg"` | Auto-generates a new Alembic migration schema file |
| `npm run api:migrate:down` | - | Rolls back the latest Alembic database migration (`downgrade -1`) |

---

### 4. Testing, Quality & Linting Commands

| Command | Alternative (`make`) | Description |
| :--- | :--- | :--- |
| `npm run api:test` | `make test-api` | Runs API test suite using `pytest` |
| `npm run lint` | `make lint-web` | Lints Next.js application using ESLint |
| `npm run api:lint` | `make lint-api` | Lints FastAPI backend using Ruff |
| `npm run api:format` | - | Auto-formats FastAPI Python codebase using Ruff |
| `npm run typecheck` | `make typecheck` | Runs TypeScript typechecker (`tsc`) and Python typechecker (`mypy`) |
| `make check` | `make check` | Runs full CI check pipeline (`lint` + `typecheck` + `test`) |

---

### 5. Production Build Commands

| Command | Description |
| :--- | :--- |
| `npm run build` | Compiles optimized Next.js production build (`apps/web`) |
| `npm run start` | Runs the Next.js production build server |

---

## 🛠️ Cross-Platform Helper Script (`scripts/api.mjs`)

The repository includes a cross-platform helper script (`node scripts/api.mjs`) that automatically locates and uses the Python virtual environment across Windows (`.venv\Scripts\python.exe`) and macOS/Linux (`.venv/bin/python`).

All `npm run api:*` commands wrap this script so you don't need to manually activate virtual environments across different operating systems.

---

## 🌐 Environment & Port Mapping Summary

| Service | Protocol | Host & Port | Environment Variable / Config |
| :--- | :--- | :--- | :--- |
| **Next.js Web Frontend** | HTTP | `http://localhost:3000` | Defined in `apps/web/.env.local` |
| **FastAPI Backend** | HTTP | `http://localhost:8000` | Defined in `apps/api/.env` |
| **Swagger API Docs** | HTTP | `http://localhost:8000/docs` | Built-in FastAPI OpenAPI interactive UI |
| **PostgreSQL Database** | TCP | `localhost:5432` (Native) / `5433` (Docker) | `DATABASE_URL` in `apps/api/.env` |
| **Redis Cache** | TCP | `localhost:6379` | `REDIS_URL` in `apps/api/.env` |

---

## 🔑 Demo Login Credentials

When running with `NEXT_PUBLIC_USE_MOCK_API=true` or after running `npm run api:seed`, use these credentials to sign in:

| Email | Password | Role | Permissions |
| :--- | :--- | :--- | :--- |
| `admin@calderfreight.test` | `Sprint1demo!` | Administrator | Full access, settings & audit logs |
| `manager@calderfreight.test` | `Sprint1demo!` | Sales Manager | User list (read-only), pipeline access |
| `rep@calderfreight.test` | `Sprint1demo!` | Sales Representative | Core sales workflows, no admin settings |
| `finance@calderfreight.test` | `Sprint1demo!` | Read-Only | Read access across records |
