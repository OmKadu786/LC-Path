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
- **Smart "Do Next" Recommendations:** Generates exactly 20 tailored problem recommendations designed to fill your weakest topic gaps while building on what you already know.
- **Learn Next:** Automatically tracks your progress and rotates your recommended study topics every 5 solved problems.
- **AI Chat Assistant & Socratic Coach:** A free-form chat interface powered by the DeepSeek API. The AI acts as a Socratic coach, reading your live code and submission errors in real-time to give you subtle hints without spoiling the answer.
- **Live Code Polling:** Your code editor state syncs silently in the background every 4 seconds, so the AI always knows exactly what you're working on.
- **Privacy First:** Your data stays local. The solved list is cached in `chrome.storage`, and your DeepSeek API key is stored securely on your device.

## Architecture
- **Content Script (`content.js`):** Injected into LeetCode to extract your solved list and problem tags. 
- **Side Panel UI (`panel.html`):** The main interface with two tabs: **Home** (stats, topic strengths, recommendations) and **Chat** (AI conversation).
- **DeepSeek API:** Uses the highly affordable and powerful `deepseek-chat` model to generate recommendations and chat responses.

## Installation
1. Clone or download this repository.
2. **Start the Backend:**
   - Navigate to the `Extension/backend/` folder in your terminal.
   - Run `npm install`.
   - Create a `.env` file and add your DeepSeek API key inside it (`DEEPSEEK_API_KEY=your_key`).
   - Run `npm start` to run the proxy server on `localhost:3000`.
3. **Load the Extension:**
   - Open your Chromium browser (Chrome, Brave, Edge) and navigate to `chrome://extensions`.
   - Enable **Developer mode** in the top-right corner.
   - Click **Load unpacked** and select the `Extension/lcpath/` folder.
4. Go to any LeetCode problem page, click the LCPath icon in your browser toolbar to open the side panel, and start learning!
