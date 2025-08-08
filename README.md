# Modern Proxy (flat repo)

Simple, modern proxy that rewrites HTML and streams non-HTML assets. Login-protected with password `314159`.

## Files
- `server.js` — main Express server and proxy logic
- `index.html` — proxy UI (single page with input + iframe)
- `login.html` — password gate
- `package.json` — dependencies and scripts

## Install & Run
```bash
npm install
npm start
# then visit http://localhost:3000/login
