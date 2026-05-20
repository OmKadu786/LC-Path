const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// ── Security Headers (Issue #7) ──
app.use(helmet());

// ── CORS: locked to Chrome Extension origin (Issue #6) ──
// Chrome extensions send requests with origin "chrome-extension://<id>"
// We allow null/undefined origin too (for local testing via curl etc.)
app.use(cors({
  origin: function (origin, callback) {
    // Allow Chrome extension requests (origin starts with chrome-extension://)
    // Allow requests with no origin (curl, Render health checks)
    if (!origin || origin.startsWith('chrome-extension://')) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  }
}));

app.use(express.json({ limit: '10kb' })); // Limit body size

// ── Rate Limiting (Issue #2 & AI/LLM) ──
const limiter = rateLimit({
  windowMs: 60 * 1000,  // 1 minute
  max: 15,              // Max 15 requests per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests. Please slow down.' }
});
app.use('/api/chat', limiter);

// ── API Key ──
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;

if (!DEEPSEEK_API_KEY) {
  console.error('❌ ERROR: Missing DEEPSEEK_API_KEY in .env file.');
  process.exit(1);
}

// ── Server-side constants (Issue #3 & AI/LLM) ──
const MAX_TOKENS_CAP = 3000;
const TEMPERATURE_CAP = 1.0;
const MAX_MESSAGES = 20;

// Proxy endpoint for LCPath extension
app.post('/api/chat', async (req, res) => {
  const requestId = Math.random().toString(36).substring(7);
  console.log(`[${requestId}] Incoming chat request...`);

  try {
    const { messages, temperature, max_tokens } = req.body;

    // Input validation (Issue #3)
    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: 'Messages must be a non-empty array.' });
    }
    if (messages.length > MAX_MESSAGES) {
      return res.status(400).json({ error: `Too many messages. Max is ${MAX_MESSAGES}.` });
    }
    // Ensure every message has a valid role and string content
    const validRoles = ['user', 'assistant', 'system'];
    for (const msg of messages) {
      if (!validRoles.includes(msg.role) || typeof msg.content !== 'string') {
        return res.status(400).json({ error: 'Invalid message format.' });
      }
    }

    // Server-side caps — client cannot override these (Issue #3 & AI/LLM)
    const safeMaxTokens = Math.min(Number(max_tokens) || MAX_TOKENS_CAP, MAX_TOKENS_CAP);
    const safeTemperature = Math.min(Math.max(Number(temperature) || 0.7, 0), TEMPERATURE_CAP);

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify({
        model: 'deepseek-chat',
        messages: messages,
        temperature: safeTemperature,
        max_tokens: safeMaxTokens
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error(`[${requestId}] DeepSeek API Error:`, err);
      // Do NOT forward raw API error to client (Issue #9)
      return res.status(502).json({ error: 'AI service error. Please try again.' });
    }

    const data = await response.json();
    console.log(`[${requestId}] Success: Response sent`);
    res.json(data);

  } catch (error) {
    // Never leak stack traces to client (Issue #9)
    console.error(`[${requestId}] Server Error:`, error);
    res.status(500).json({ error: 'Internal Server Error.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 LCPath Backend running on http://localhost:${PORT}`);
  console.log(`Using DeepSeek API for chat completions.`);
  console.log(`Waiting for requests from the Chrome Extension...`);
});
