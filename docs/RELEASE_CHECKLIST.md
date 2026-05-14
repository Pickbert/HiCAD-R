# Release Checklist

Use this checklist before tagging or deploying a HiCAD-R release.

## Before Release

- Confirm `CHANGELOG.md` has a dated entry with user-facing changes.
- Confirm `README.md`, `.env.production.example`, and deployment docs match the release behavior.
- Rotate or verify production secrets outside git: JWT access, JWT refresh, payment callback secret, and AI provider keys.
- Confirm the payment provider remains the mock provider or document the real provider rollout.
- Verify the target data directory backup policy. The current repository uses JSON persistence by default.

## Verification

Run the full local quality gate:

```bash
bash -n start.sh
pnpm format:check
pnpm lint
pnpm test
pnpm typecheck
pnpm build
pnpm audit:prod
pnpm bundle:check
pnpm test:e2e
pnpm ci:quality
```

Run deployment smoke checks:

```bash
docker compose up --build app
curl -fsS http://127.0.0.1:3000/api/health
docker compose --profile postgres config
```

## Deployment

- Build artifacts from a clean checkout.
- Apply `.env.production` on the server; do not rely on example values.
- Put Nginx or another reverse proxy in front of the app and disable buffering for SSE routes.
- Verify `/api/health`, `/api/docs`, login, model save, publish, share preview, STL export, and admin access.
- Watch logs after release and confirm sensitive values are redacted.

## After Release

- Tag the release and push the tag.
- Archive Playwright screenshots or release smoke evidence when needed.
- Open follow-up issues for any deferred migration work, especially database repository migration.
