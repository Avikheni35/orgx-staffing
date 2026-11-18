# Contributing to OrgX Staffing Platform

## Development Setup

### Prerequisites
- Node.js 20+
- MongoDB running at `mongodb://localhost:27017`

### Install
```bash
npm install
```

### Run in development mode
```bash
npm run dev
# Server: http://localhost:5000
# Client: http://localhost:3000
```

### Seed demo data
```bash
cd server && npx tsx src/scripts/seed.ts
```

---

## Project Structure

```
client/   React + Vite frontend (port 3000)
server/   Express API           (port 5000)
```

The Vite dev server proxies `/api/*` and `/uploads/*` to the Express server — no CORS config needed locally.

---

## Running Tests

```bash
npm test               # run once
npm run test:watch     # watch mode
```

Tests use Vitest with `vi.mock()` for MongoDB models — no real database required.

---

## TypeScript

```bash
npm run build -w server    # check server types
npm run typecheck -w client  # check client types
```

Both must pass with zero errors before submitting a PR.

---

## Code Style

- TypeScript strict mode throughout
- Zod schemas for all request body validation
- All UI strings go in `client/src/i18n/locales/de.json` first, then `en.json`
- No hardcoded strings in React components

---

## Submitting a Pull Request

1. Fork the repo and create a branch from `master`
2. Make your changes with focused, atomic commits
3. Ensure `npm test` and both typecheck commands pass
4. Open a PR with a clear description of what and why

---

## Reporting Bugs

Use the [Bug Report](.github/ISSUE_TEMPLATE/bug_report.md) issue template.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](LICENSE).
