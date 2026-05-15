# LCPath 



## Overview
**LCPath** is an AI-powered Chrome extension designed to act as your personalized LeetCode study coach. It injects a side panel into every LeetCode problem page, reading your history and providing actionable recommendations to optimize your interview prep.

## The Problem
When grinding LeetCode, it's easy to lose track of what topics you're actually strong in, and what you should study next. Existing tools either lack personalization or fail to provide conversational, context-aware guidance tailored to your specific history. 

## The Solution
LCPath solves this by automatically scraping your solved problem list from your LeetCode profile, computing your topic-level strength locally, and sending that context to the DeepSeek API. The result is highly personalized next-problem recommendations and a chat assistant that knows exactly what you've already mastered.

## Features
- **Automated Context Gathering:** A content script runs on `leetcode.com` to safely scrape your solved problems and the current problem's tags.
- **Topic Strength Analysis:** Computes your strongest and weakest topics (e.g., Arrays, Hash maps, Two pointers) based on your solved history.
- **Smart "Do Next" Recommendations:** Generates exactly 3 tailored problem recommendations designed to fill your weakest topic gaps while building on what you already know. Includes an explanation of *why* the problem was chosen for you.
- **AI Chat Assistant:** A free-form chat interface powered by the DeepSeek API. Ask for a weekly study plan, request algorithmic explanations, or get hints on your current problem—the AI always responds with your full LeetCode history as context.
- **Privacy First:** Your data stays local. The solved list is cached in `chrome.storage`, and your DeepSeek API key is stored securely on your device.

## Architecture
- **Content Script (`content.js`):** Injected into LeetCode to extract your solved list and problem tags. 
- **Side Panel UI (`panel.html`):** The main interface with two tabs: **Home** (stats, topic strengths, recommendations) and **Chat** (AI conversation).
- **DeepSeek API:** Uses the highly affordable and powerful `deepseek-chat` model to generate recommendations and chat responses.

## Installation
1. Clone or download this repository.
2. **Start the Backend:**
   - Navigate to the `backend/` folder in your terminal.
   - Run `npm install`.
   - Copy `.env.example` to `.env` and add your DeepSeek API key inside it.
   - Run `npm start` to run the proxy server on `localhost:3000`.
3. **Load the Extension:**
   - Open your Chromium browser (Chrome, Brave, Edge) and navigate to `chrome://extensions` (or `brave://extensions`).
   - Enable **Developer mode** in the top-right corner.
   - Click **Load unpacked** and select the `lcpath/` folder (the lowercase one).
4. Go to any LeetCode page, click the new green LCPath button in the top navigation bar, and enter your LeetCode username to get started!
