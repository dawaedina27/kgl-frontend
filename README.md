# Karibu Groceries LTD Frontend

Static frontend for Karibu Groceries LTD.  
This UI is built with plain HTML, CSS, and JavaScript (no frontend framework).

## What It Includes

- Landing page: [`public/index.html`](./public/index.html)
- Login page: [`public/login.html`](./public/login.html)
- Role dashboards/pages:
  - Director: `public/pages/director/*`
  - Manager: `public/pages/manager/*`
  - Sales Agent: `public/pages/sales-agent/*`
- Shared assets:
  - Styles: `public/assets/css/*`
  - Scripts: `public/assets/js/*`
  - Images: `public/assets/images/*`

## How This Frontend Connects to Backend

Most scripts call backend endpoints under `/api`.

API base behavior used in several files:
- If running on `localhost` or `127.0.0.1` from a non-`4000` port, API requests default to:
  - `http://localhost:4000/api`
- Otherwise, API requests use:
  - `${window.location.origin}/api`

This allows:
- local split setup (frontend served separately, backend on `:4000`)
- same-origin setup (backend serving frontend + API together)

## Running the Frontend

### Option 1 (recommended): Run through backend server

The backend already serves `frontend/public` as static files.

1. Configure and run backend (see `../backend/README.md`).
2. Open:
   - `http://localhost:4000/`

### Option 2: Serve frontend separately (for UI-only work)

Use any static server from the `frontend` folder.

Example using Node:
```bash
npx serve public
```

If served on a different local port, scripts will still target backend at `http://localhost:4000/api`.

## Login and Session Storage

On successful login, frontend stores:
- `token`
- `name`
- `username`
- `role`
- `branch`

in `localStorage` and redirects based on role:
- `Manager` -> `pages/manager/dashboard.html`
- `Director` -> `pages/director/dashboard.html`
- `SalesAgent` -> `pages/sales-agent/dashboard.html`

## Project Structure

```text
frontend/
  public/
    index.html
    assets/
      css/
      js/
      images/
    pages/
      director/
      manager/
      sales-agent/
```

## Common Frontend Tasks

- Update login behavior: `public/assets/js/auth.js`
- Update director user management: `public/assets/js/director-user-management.js`
- Update page styles:
  - shared tokens: `public/assets/css/theme.css`
  - page-level styles: matching files in `public/assets/css/`

## Troubleshooting

- Blank/failed API responses:
  - confirm backend is running on `http://localhost:4000`
  - check browser DevTools -> Network tab for failing request path/status
- CORS errors:
  - set `CORS_ORIGIN` in backend `.env` to your frontend origin
  - restart backend after changing env vars
- Login succeeds but wrong redirect:
  - verify backend user role matches one of `Manager`, `Director`, `SalesAgent`

## Notes

- This folder does not require a package manager for normal use.
- Keep secrets out of frontend files; use backend environment variables for sensitive configuration.
