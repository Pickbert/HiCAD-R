# Contributing

Thanks for improving HiCAD-R.

## Local Setup

```bash
pnpm install
cp .env.example .env
./start.sh
```

The app defaults to JSON persistence in `data/`. Keep local data, secrets, screenshots, and test output out of commits.

## Development Flow

- Prefer small, focused changes.
- Keep shared types in `shared/` when behavior crosses backend and frontend.
- Add tests near the changed behavior.
- Do not commit generated build output from `frontend/dist`, `backend/dist`, or `shared/dist`.
- Keep unrelated local changes out of your commit.

## Quality Gate

Before opening a pull request, run:

```bash
pnpm format:check
pnpm lint
pnpm test
pnpm typecheck
pnpm build
pnpm bundle:check
```

For release-level changes, also run:

```bash
pnpm audit:prod
pnpm test:e2e
pnpm ci:quality
```

## API And Security

- API routes should stay under `/api`.
- Add or update Swagger metadata for new controllers and DTOs.
- Never log secrets directly. Use the redaction helper when logging structured errors or upstream payloads.
- Production deployments must use random JWT and payment callback secrets.

## Attribution

HiCAD-R is derived from [MrXujiang/HiCAD](https://github.com/MrXujiang/HiCAD). Keep the GPL license and attribution intact when redistributing.
