# CurlDesk Development Guidelines

This document is the working contract for Codex and other contributors modifying CurlDesk.

## Project overview

- CurlDesk is a local-first desktop curl workbench.
- The desktop shell and backend use Go with Wails 3.
- The UI is React, TypeScript, Vite, Tailwind CSS, and shadcn/ui components.
- Frontend source lives in `frontend/`; Go application code lives at the repository root.

## UI rules

- All visible UI text must be English until i18n is introduced.
- Use existing shadcn/ui components for interactive UI, dialogs, menus, buttons, tooltips, tabs, sidebars, separators, and form controls.
- Do not introduce native controls or standalone custom UI components when an existing shadcn/ui component covers the use case.
- If shadcn/ui does not provide a needed pattern, compose a small wrapper from existing shadcn/ui components and document why.
- Preserve the existing restrained desktop-workbench visual language: compact headers, clear separators, subtle active states, and theme-aware colors.
- Every icon-only action needs an accessible `aria-label` and a tooltip.
- Keep light, dark, and system appearance modes working for every new UI surface.

## State and persistence

- User preferences are stored locally under the `curldesk-settings` key.
- Keep settings backward compatible when adding fields; provide defaults in `defaultSettings`.
- Curl files remain local workspace files and should continue to use the existing `WorkspaceService` APIs.
- Do not add a remote service or telemetry without explicit product approval.

## Versioning and releases

- The frontend display version is sourced from `frontend/package.json` and injected by `frontend/vite.config.ts` as `__APP_VERSION__`.
- Keep `build/config.yml` `info.version` synchronized with the package version for Wails packaging.
- Use semantic versions such as `0.1.0`; release tags should use the matching `v0.1.0` form.
- Update checks compare the injected app version with the latest GitHub Release tag.

## Local development

From the repository root:

```bash
make install
make dev
```

Useful commands:

```bash
make build       # Build the frontend and desktop application
make clean       # Remove generated build output
make test        # Run Go tests
```

If Wails development is unavailable, validate the frontend directly:

```bash
cd frontend
./node_modules/.bin/vite build
./node_modules/.bin/tsc --noEmit
```

Do not run package installation with `sudo`; use the project-local pnpm setup.

## Change and verification rules

- Inspect the existing implementation before editing and keep unrelated user changes intact.
- Use `apply_patch` for source edits.
- After UI changes, run both the Vite production build and TypeScript check.
- Check for accidental non-English text with `rg -n "[一-龥]" frontend/src frontend/public`.
- Check the final diff before committing.
- Use focused commits with an imperative subject, for example `feat: add update checker`.
- Never commit secrets, generated `node_modules`, or build artifacts.

## Common pitfalls

- CodeMirror packages must resolve to one compatible `@codemirror/state` instance; keep its direct dependency explicit.
- Wails dev mode may report an optional `custom.js` 404; the project includes a placeholder under `frontend/public/wails/`.
- A blank page usually indicates a React runtime error. Check the browser console first, especially provider and CodeMirror extension errors.
- Keep tooltip content inside the shared `TooltipProvider`; do not mount standalone Radix tooltips outside it.
