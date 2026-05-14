# Changelog

All notable changes to HiCAD-R are tracked here.

## Unreleased

- Added P2 engineering assets for deployment: Dockerfile, Docker Compose, PM2 config, Nginx example, production env example, release checklist, and contribution guide.
- Added Prettier and ESLint flat configuration with root `format`, `format:check`, and `lint` scripts.
- Added Swagger/OpenAPI endpoints at `/api/docs` and `/api/openapi.json`.
- Added static asset cache headers for built frontend assets.
- Added log redaction for API keys, JWTs, Authorization headers, refresh tokens, and payment signatures.
- Kept Monaco and Three.js split into async chunks and added route-view lazy loading for non-workspace views.
- Extended typed frontend API wrappers for model save, update, publish, unpublish, share, and export tracking.

## 1.0.0

- Initial HiCAD-R baseline with P1 frontend, CAD/rendering, and testing/quality milestones.
