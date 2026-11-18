# OrgX Staffing Platform

A multi-tenant B2B SaaS platform for German temporary staffing agencies (*Zeitarbeitsvermittlung*). Manages workers, shifts, AÜG compliance, contracts, invoicing, and client portals — all in one system.

![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20.x-339933?logo=nodedotjs&logoColor=white)
![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-7.x-47A248?logo=mongodb&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## Features

### Worker Management
- Worker profiles with encrypted sensitive fields (IBAN, Steuernummer, Sozialversicherungsnummer)
- Digital onboarding with document upload
- Magic-link authentication (no password required for workers)
- Worker availability calendar

### Shift & Assignment
- Create and publish shifts with skill requirements
- Automatic AÜG compliance checks (Arbeitnehmerüberlassungsgesetz)
  - 9-month equal-pay warning
  - 18-month hard block with override log
- 11-hour minimum rest enforcement (ArbZG §5)
- Mindestlohn validation (MiLoG — currently €12.82/h)
- Recurring shift templates

### Contracts & Documents
- Auto-generated PDF contracts from configurable templates
- `{{placeholder}}` substitution engine
- Contract auto-void on shift overlap

### Invoicing & Billing
- Invoice generation with PDF export
- Credit notes
- Invoice ageing reports
- Stripe subscription billing (Starter / Growth / Pro / Enterprise)

### Portals
| Portal | Role | Path |
|---|---|---|
| Agency dashboard | `agency_admin`, `disponent` | `/app/` |
| Worker portal | `worker` | `/worker/` |
| Client portal | `business_contact` | `/client/` |
| Super admin | `super_admin` | `/superadmin/` |

### Compliance & Security
- DSGVO Art. 17 (right to erasure) and Art. 20 (data portability)
- HGB §257 10-year audit log with 10-year TTL index
- AES-256-GCM field encryption for sensitive worker data
- 2FA / OTP for agency staff (configurable per tenant)
- Bcrypt password hashing (12 rounds), account lockout after 5 failed attempts

---

## Tech Stack

| Layer | Technology |
|---|---|
| **API** | Express.js 4, TypeScript, Zod validation |
| **Database** | MongoDB 7 + Mongoose 8 |
| **Auth** | JWT (access 15 min in-memory + refresh 7d HttpOnly cookie) |
| **Frontend** | React 18, Vite, MUI v5, Zustand, React Query v5 |
| **i18n** | react-i18next (German + English) |
| **PDF** | Puppeteer (headless Chrome) |
| **Email** | Nodemailer (SMTP or console fallback in dev) |
| **SMS** | Twilio (optional) |
| **Billing** | Stripe |
| **Monitoring** | Sentry |
| **Push** | Web Push (VAPID) |
| **Testing** | Vitest |

---

## Quick Start

### Prerequisites
- Node.js 20+
- MongoDB running at `mongodb://localhost:27017`

### Install & run
```bash
npm install
npm run dev
# Server: http://localhost:5000
# Client: http://localhost:3000
```

### Seed demo data
```bash
cd server && npx tsx src/scripts/seed.ts
```

Default seed credentials (override with env vars):

| Account | Email | Password env var |
|---|---|---|
| Super admin | `admin@platform.de` | `SEED_SUPER_PASSWORD` |
| Agency admin | `agentur@demo.de` | `SEED_DEMO_PASSWORD` |
| Demo worker | `worker@demo.de` | magic link only |

---

## Configuration

Copy `server/.env.example` to `server/.env` and fill in the values.

```bash
cp server/.env.example server/.env
```

Key variables:

| Variable | Description | Required in prod |
|---|---|---|
| `JWT_ACCESS_SECRET` | 64-char random string | ✅ |
| `JWT_REFRESH_SECRET` | 64-char random string | ✅ |
| `MONGODB_URI` | MongoDB connection string | ✅ |
| `FIELD_ENCRYPTION_KEY` | 64-char hex string (`openssl rand -hex 32`) | ✅ |
| `CLIENT_URL` | Frontend origin (CORS) | ✅ |
| `STRIPE_SECRET_KEY` | Stripe secret key | optional |
| `SMTP_HOST` | SMTP server (blank → emails printed to console) | optional |
| `TWILIO_ACCOUNT_SID` | Twilio SMS (optional) | optional |

Generate secrets:
```bash
openssl rand -hex 32   # JWT secrets and FIELD_ENCRYPTION_KEY
```

---

## Project Structure

```
m1/
├── client/          # React + Vite frontend
│   └── src/
│       ├── api/     # Axios API clients
│       ├── pages/   # Route-level page components
│       ├── stores/  # Zustand state
│       └── i18n/    # de.json / en.json translations
└── server/          # Express API
    └── src/
        ├── config/  # env.ts, db.ts
        ├── middleware/  # auth, rbac, tenant, upload, validate
        ├── models/  # Mongoose models
        ├── routes/  # Express routers
        ├── services/# Business logic
        ├── utils/   # pdf, email, crypto, audit, notify
        └── scripts/ # seed, create_user, set_passwords
```

---

## Testing

```bash
npm test               # run all tests once
npm run test:watch     # watch mode
```

Tests cover auth, compliance rules (AÜG, ArbZG, MiLoG), crypto utilities, and shift lifecycle.

---

## License

MIT
