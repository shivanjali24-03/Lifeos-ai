# LifeOS AI

LifeOS AI is a personal life-management dashboard with authenticated task management. The current foundation uses React, Vite, TypeScript, Express, PostgreSQL, Prisma, and JWT authentication. The repository roadmap adds notes, semantic search, and an AI assistant in later phases.

## Requirements

- Node.js 24 (use `nvm use 24` if you use nvm)
- Docker with Docker Compose
- npm

## 1. Start PostgreSQL

From the repository root:

```bash
docker compose up -d postgres
docker compose ps
```

The local PostgreSQL service uses the `pgvector/pgvector:pg16` image and a named volume for persistent data.

## 2. Configure environment variables

```bash
cp lifeos-ai_backend/.env.example lifeos-ai_backend/.env
cp lifeos-ai_frontend/.env.example lifeos-ai_frontend/.env
openssl rand -hex 32
```

Replace `JWT_SECRET` in the backend `.env` with the generated value. Replace the database URL placeholders with your local values: host `localhost`, database `lifeos_ai`, user `lifeos`, and password `lifeos_local_dev` (matching `docker-compose.yml`). Set `CORS_ORIGIN=http://localhost:5173` and `VITE_API_URL=http://localhost:5000/api` for local development. The example files contain placeholders only; never commit real secrets. `DATABASE_URL` is the application connection string and `DIRECT_URL` is the direct connection used for Prisma migrations (use your Neon direct URL for `DIRECT_URL` when deploying to Neon).

## 3. Install dependencies and migrate the database

```bash
cd lifeos-ai_backend
npm install
npx prisma generate
npx prisma migrate deploy
```

For a new local database where you are actively developing schema changes, `npm run db:migrate` runs `prisma migrate dev`.

## 4. Run the backend

```bash
cd lifeos-ai_backend
npm run dev
```

Health check: `http://localhost:5000/api/health`.

## 5. Run the frontend

In another terminal:

```bash
cd lifeos-ai_frontend
npm install
npm run dev
```

The frontend reads its backend base URL from `VITE_API_URL` (default: `http://localhost:5000/api`).

## Scripts

Backend: `npm run build`, `npm test`, `npm run db:generate`, `npm run db:migrate`, `npm run db:deploy`, `npm run db:studio`.

## Security notes

- Authentication uses JWTs; `userId` is derived from the verified token, not request payloads.
- Task queries are scoped to the authenticated user.
- Password hashes are never included in public API responses.
- Do not commit `.env` files or production credentials.

## GitHub branch protection

Repository settings are hosted on GitHub and cannot be applied by a source archive. After pushing this work, create a ruleset for `main` (and optionally `develop`) in **Settings → Rules → Rulesets**: require a pull request before merging, require the `test-and-build` status check, and block force pushes/deletion. The `test-and-build` workflow runs on pull requests and pushes to `develop`/`main`.

## Dependency lockfiles

The previous lockfiles contained the removed database/authentication packages. Run `npm install` in each app directory after receiving this migration to generate fresh lockfiles for the new dependency manifests.
