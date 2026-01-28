# Deployment Guide (0 Cost)

This guide explains how to deploy the **Invesa** application using free tier services.

## 1. Database: Neon (PostgreSQL)

1.  Go to [Neon.tech](https://neon.tech/) and sign up.
2.  Create a new project.
3.  Copy the **Connection String** (e.g., `postgres://user:pass@ep-xyz.aws.neon.tech/neondb?sslmode=require`).
4.  This will be your `DATABASE_URL`.

## 2. Backend: Render

1.  Go to [Render.com](https://render.com/) and sign up.
2.  Click **New +** -> **Web Service**.
3.  Connect your GitHub repository.
4.  Select the `server` directory as the Root Directory (if asked, or rely on `render.yaml`).
5.  **Environment Variables**: Add the following:
    *   `NODE_ENV`: `production`
    *   `DATABASE_URL`: (Paste from Neon)
    *   `JWT_ACCESS_SECRET`: (Generate a random string)
    *   `JWT_REFRESH_SECRET`: (Generate a random string)
    *   `FRONTEND_ORIGIN`: `https://your-vercel-app-name.vercel.app` (You will get this in Step 3)
    *   `EMAIL_USER`: (Your Gmail)
    *   `EMAIL_APP_PASSWORD`: (Your Gmail App Password)
6.  Deploy. Render will automatically install dependencies and start the server.

## 3. Frontend: Vercel

1.  Go to [Vercel.com](https://vercel.com/) and sign up.
2.  Click **Add New...** -> **Project**.
3.  Import your GitHub repository.
4.  Framework Preset: **Next.js** (Auto-detected).
5.  **Environment Variables**:
    *   No strictly required env vars for the frontend if using `vercel.json` rewrites, but if you hardcoded `API_BASE_URL` in `config/index.js`, update it.
    *   Ideally, set `NEXT_PUBLIC_API_BASE_URL` to your Render Backend URL (e.g., `https://invesa-backend.onrender.com`).
6.  Deploy.

## 4. Finalizing

1.  Once Vercel is deployed, copy the domain (e.g., `https://invesa.vercel.app`).
2.  Go back to Render Dashboard -> Environment Variables.
3.  Update `FRONTEND_ORIGIN` with this URL.
4.  Update `vercel.json` "destination" if you haven't already.

Done! Your app is live with:
*   Frontend: Vercel (Edge Network)
*   Backend: Render (Free Tier Node.js)
*   Database: Neon (Serverless Postgres)
