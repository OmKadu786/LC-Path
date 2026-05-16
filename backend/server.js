const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
  console.error("❌ ERROR: Missing DEEPSEEK_API_KEY in .env file.");
  process.exit(1);
}

// Proxy endpoint for LCPath extension
app.post('/api/chat', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Incoming chat request...`);

  try {
    const { messages, temperature, max_tokens } = req.body;

    if (!messages || !Array.isArray(messages)) {
      console.error(`[${requestId}] Error: Invalid messages format`);
      return res.status(400).json({ error: "Messages are required and must be an array" });
    }

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 1500
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[${requestId}] DeepSeek API Error:`, err);
      return res.status(response.status).json({ error: "API request failed", details: err });
    }

    const data = await response.json();
    console.log(`[${requestId}] Success: Response sent`);
    res.json(data);

  } catch (error) {
    console.error(`[${requestId}] Server Error:`, error);
    res.status(500).json({ error: 'Internal Server Error', message: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 LCPath Backend running on http://localhost:${PORT}`);
  console.log(`Using DeepSeek API for chat completions.`);
  console.log(`Waiting for requests from the Chrome Extension...`);
});
