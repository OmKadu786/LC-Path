# 🚀 LCPath: Production & Hosting Guide

This document outlines the exact, step-by-step technical roadmap to take LCPath from a local development tool (`localhost:3000`) to a live, monetized, and highly scalable Chrome Extension product.

---

## ☁️ Phase 1: Host the Node.js Backend

Your backend server (`server.js`) must be running 24/7 on a public URL to serve recommendations when your computer is off. **Render.com** is highly recommended for Node.js backends.

1. **Create an account on Render:** Go to [Render.com](https://render.com) and link your GitHub account.
2. **Deploy the Web Service:**
   * Click **New +** and select **Web Service**.
   * Choose your `LC-Path` repository.
   * **Root Directory:** Set this to `Extension/backend` (this is critical because `server.js` and `package.json` are inside this folder).
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
3. **Configure Environment Variables:**
   * In the Render dashboard for your new service, navigate to the **Environment** tab.
   * Add a secret variable: `DEEPSEEK_API_KEY` and paste your actual API key.
4. **Deploy:** Click **Create Web Service**. Within 2 minutes, Render will provide you with a live URL (e.g., `https://lcpath-api.onrender.com`).

---

## 🔗 Phase 2: Update the Chrome Extension

Now that your backend is in the cloud, you must update the extension code to point to it.

1. Open `Extension/lcpath/panel.js`.
2. Find the `fetch` call inside the `fetchRecommendations` function:
   ```javascript
   const res = await fetch('http://localhost:3000/api/chat', {
   ```
3. Replace the `localhost` URL with your new live Render URL:
   ```javascript
   const res = await fetch('https://YOUR-RENDER-URL.onrender.com/api/chat', {
   ```
4. Do the same for `lcpath/chat.js` if it contains any hardcoded localhost URLs.

---

## 💳 Phase 3: Implement Authentication & The Paywall (Stripe)

To charge users, they need to log in to the extension. When they pay, your database will record their status.

### 1. The Database (Supabase)
* Go to [Supabase](https://supabase.com) and create a free project.
* Create a table called `users` with columns: `id`, `email`, `is_pro` (boolean, default: false).
* Enable **Google OAuth** authentication in the Supabase dashboard so users can click a single "Login with Google" button inside your side panel.

### 2. The Payments (Stripe)
* Create a [Stripe](https://stripe.com) account.
* Create your two Products:
  * **$4.99/mo** (Recurring)
  * **$29.99** (One-Time Payment)
* Generate a **Stripe Payment Link** for each tier. You will embed these links directly into your Chrome Extension's upgrade screen or your landing page.

### 3. The Webhook (Connecting Stripe to Supabase)
* When a user successfully pays on Stripe, Stripe will instantly send a "Webhook" to your backend.
* You will add a new endpoint to your `server.js` (e.g., `app.post('/api/webhook')`).
* This endpoint will read the Stripe payload, find the user's email in your Supabase database, and switch their `is_pro` status to `true`.

### 4. Lock the AI
* Update `server.js` so that whenever the extension requests recommendations, it first queries Supabase.
* If `is_pro == false` and their 15 free trial credits are gone, return a `403 Forbidden` response. The Chrome extension will catch this and display your "Upgrade to Pro" screen with the Stripe links.

---

## 🌐 Phase 4: Publish to the Chrome Web Store

1. **Zip the Extension:** 
   * Compress the entire `lcpath/` directory into a file called `lcpath.zip`. (Do **not** include the `backend` folder).
2. **Developer Dashboard:** 
   * Go to the [Chrome Web Store Developer Dashboard](https://chrome.google.com/webstore/developer/dashboard).
   * Pay the one-time **$5 developer registration fee**.
3. **Upload & Details:**
   * Upload `lcpath.zip`.
   * Fill out the store listing. You will need:
     * A high-quality 128x128 icon.
     * A promotional banner image (1280x800).
     * 3-5 screenshots showing the Topic Strength bars and the AI Chat Coach.
     * A clear, SEO-optimized description explaining how it helps students pass technical interviews.
4. **Submit for Review:** Google will review the code to ensure it's safe. Approval usually takes between 24 and 72 hours. Once approved, LCPath is live for the world to download!
