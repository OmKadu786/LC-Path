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
  try {
    const { messages, temperature, max_tokens } = req.body;
    
    // We add the API key here on the server so the extension doesn't need it
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 800
      })
    });
    
    if (!response.ok) {
      const err = await response.text();
      console.error("DeepSeek API Error:", err);
      return res.status(response.status).json({ error: "API request failed" });
    }
    
    const data = await response.json();
    res.json(data);
    
  } catch (error) {
    console.error("Server Error:", error);
    res.status(500).json({ error: 'Failed to fetch from DeepSeek' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 LCPath Backend running on http://localhost:${PORT}`);
  console.log(`Waiting for requests from the Chrome Extension...`);
});
