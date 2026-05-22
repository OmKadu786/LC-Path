# 📚 LCPath Documentation

Welcome to the official documentation for **LCPath**, the AI-powered LeetCode study planner and Socratic coding coach.

## 📑 Table of Contents
1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Features](#features)
4. [Local Development Setup](#local-development-setup)
5. [Monetization & Licensing](#monetization--licensing)
6. [Deployment](#deployment)

---

## 1. Overview
LCPath is a Chrome Extension designed to help software engineers study for algorithmic interviews efficiently. Instead of grinding blindly, LCPath uses AI to analyze a user's LeetCode history and recommend the exact problems they need to solve to fill their knowledge gaps. When a user gets stuck, the AI acts as a Socratic coach, providing subtle hints rather than giving away the answer.

---

## 2. Architecture
The project is split into three main components:

### A. The Chrome Extension (`/Extension/lcpath/`)
* **`manifest.json` (Manifest V3):** The configuration file.
* **`content.js` (Isolated World):** Injected into LeetCode pages. Scrapes problem data, user stats, and submission results.
* **`code-reader.js` (Main World):** Bypasses Content Security Policy (CSP) to read live code directly from the Monaco editor instance via custom DOM events.
* **`panel.js` & `panel.html`:** The side panel UI where the user views recommendations and chats with the AI.
* **`chat.js`:** Handles the AI prompt engineering, ensuring the AI acts Socratically and has full context of the user's code and errors.

### B. The Node.js Backend (`/Extension/backend/`)
* **`server.js`:** A lightweight Express server acting as a proxy between the extension and the DeepSeek API.
* **Security:** Implements Rate Limiting (15 req/min), CORS (locked to the Chrome Extension origin), and Helmet for headers.
* **Token Limits:** Configured to handle up to 3000 tokens to support large JSON recommendation payloads.

### C. The Landing Page (`/LandingPage/`)
* A highly optimized, single-file HTML landing page using Tailwind CSS via CDN and Lucide icons. Designed for maximum conversion and easy deployment on Vercel.

---

## 3. Features
* **Smart "Do Next" Pool:** Generates 20 personalized problem recommendations based on the user's solved history and topic strengths.
* **Learn Next Topics:** Recommends specific algorithmic concepts to study, refreshing every 5 solved problems.
* **Socratic AI Coach:** Reads live code and submission errors (Wrong Answer, Runtime Error) to provide targeted hints.
* **Live Code Polling:** The AI always sees the most recent editor state, updating silently in the background every 4 seconds when the chat tab is open.

---

## 4. Local Development Setup

### Prerequisites
* Node.js installed.
* A DeepSeek API Key.

### Running the Backend
1. Navigate to the backend folder: `cd Extension/backend`
2. Install dependencies: `npm install`
3. Create a `.env` file and add your API key: `DEEPSEEK_API_KEY=your_key_here`
4. Start the server: `npm run dev` (Runs on `localhost:3000`)

### Loading the Extension
1. Open Chrome and go to `chrome://extensions/`.
2. Enable **Developer Mode** (top right).
3. Click **Load unpacked**.
4. Select the `Extension/lcpath/` directory.
5. Go to LeetCode, and click the LCPath icon in the Chrome toolbar to open the side panel.

---

## 5. Monetization & Licensing
*See `MONETIZATION.md` for deep strategic details.*

LCPath uses a Freemium model powered by **Lemon Squeezy**:
* **Free Tier:** 5 AI hints per day.
* **Pro Tier:** Unlimited chats, unlocked via a License Key.
* **Validation Flow (WIP):** 
  1. User buys Pro on Lemon Squeezy.
  2. Lemon Squeezy generates a License Key.
  3. User enters the key in the extension.
  4. Extension sends the key to the Node.js backend.
  5. Backend validates the key with Lemon Squeezy and unlocks features.

---

## 6. Deployment
* **Backend:** Hosted on Render.com (Web Service pointing to `Extension/backend`).
* **Landing Page:** Hosted on Vercel (Project pointing to `LandingPage`).
* **Extension:** Packaged as a `.zip` and uploaded to the Chrome Web Store Developer Dashboard.
