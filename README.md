# HSR Academy

This repository contains the frontend and backend for the SR Academy checkout flow.

## Project structure

- `index.html` — static frontend served by GitHub Pages
- `server.js` — Express backend for Razorpay order creation and payment verification
- `package.json` — backend dependencies and startup script
- `.gitignore` — ignores `node_modules/` and `.env`
- `.env.example` — example environment variables for backend deployment

## How to deploy

### 1. Deploy the backend

Deploy `server.js` to a Node-capable hosting service like Render, Heroku, or Vercel (serverless). Configure the following environment variables on the host:

- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `EMAIL_FROM`
- `COURSE_DRIVE_LINK`

### 2. Configure the frontend

In `index.html`, replace the placeholder `https://YOUR_BACKEND_URL` with your deployed backend URL.

### 3. Serve frontend on GitHub Pages

Push the static `index.html` and other frontend files to GitHub. GitHub Pages will serve the frontend, and the frontend will call the backend at the configured URL.

## Files to commit

Commit:
- `index.html`
- `server.js`
- `package.json`
- `README.md`
- `.gitignore`
- `.env.example`

Do not commit:
- `.env`
- `node_modules/`

## Local development

Run the backend locally:

```bash
npm install
npm start
```

Open the page at:

```text
http://localhost:3000
```

The local frontend will use the local backend automatically.
