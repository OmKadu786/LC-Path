// chat.js — Chat tab + DeepSeek API + Progressive Hints

const chatMessages = document.getElementById('chat-messages');
const chatInput = document.getElementById('chat-input');
const chatSend = document.getElementById('chat-send');
const hintBtn = document.getElementById('hint-btn');
const contextPill = document.getElementById('context-pill');

let chatHistory = []; // [{role, content}] — full conversation context
let hintCount = 0;

// ─── USAGE TRACKING (FREE TIER LIMIT) ───
async function checkFreeTierLimit() {
  const data = await chrome.storage.local.get(['lcpath_usage', 'lcpath_is_pro']);
  if (data.lcpath_is_pro) return true; // Pro users have no limit

  const today = new Date().toDateString();
  let usage = data.lcpath_usage || { date: today, count: 0 };
  
  if (usage.date !== today) {
    usage = { date: today, count: 0 };
  }

  if (usage.count >= 5) {
    return false;
  }
  return true;
}

async function incrementUsage() {
  const data = await chrome.storage.local.get(['lcpath_usage', 'lcpath_is_pro']);
  if (data.lcpath_is_pro) return;

  const today = new Date().toDateString();
  let usage = data.lcpath_usage || { date: today, count: 0 };
  
  if (usage.date !== today) {
    usage = { date: today, count: 0 };
  }
  
  usage.count += 1;
  await chrome.storage.local.set({ lcpath_usage: usage });
}

// Load history from storage on init
async function loadChatHistory() {
  const data = await chrome.storage.local.get(['lcpath_chat_history', 'lcpath_hint_count']);
  if (data.lcpath_chat_history) {
    chatHistory = data.lcpath_chat_history;
    // Render existing history
    chatMessages.innerHTML = '';
    chatHistory.forEach(msg => {
      if (msg.role !== 'system') {
        const uiRole = msg.role === 'assistant' ? 'ai' : 'user';
        addMessageToUI(uiRole, msg.content, true);
      }
    });
  }
  if (data.lcpath_hint_count !== undefined) {
    hintCount = data.lcpath_hint_count;
    updateHintButtonUI();
  }
}

async function saveChatHistory() {
  await chrome.storage.local.set({
    lcpath_chat_history: chatHistory,
    lcpath_hint_count: hintCount
  });
}

loadChatHistory();


// ─── UPDATE CONTEXT PILL ───

function updateContextPill() {
  if (userData && userData.userStats) {
    let pill = `📋 knows your ${userData.userStats.stats.all} solved problems`;
    if (userData.currentCode) pill += ` + your code`;
    if (userData.submissionResult) pill += ` + ${userData.submissionResult.verdict || 'result'}`;
    contextPill.textContent = pill;
  }
}

// Watch for userData changes (set by panel.js)
const contextInterval = setInterval(() => {
  if (userData) {
    updateContextPill();
    clearInterval(contextInterval);
  }
}, 500);

// ─── LIVE CODE POLLING ───
// While the Chat tab is open, refresh the user's code every 4 seconds
// so the AI always sees the latest version without requiring a tab switch.
let codePollingInterval = null;

function startCodePolling() {
  if (codePollingInterval) return;
  codePollingInterval = setInterval(() => {
    if (typeof requestFreshCode === 'function') requestFreshCode();
  }, 4000);
}

function stopCodePolling() {
  clearInterval(codePollingInterval);
  codePollingInterval = null;
}

// Start polling immediately if Chat tab is already active on load
if (document.getElementById('tab-chat')?.classList.contains('active')) {
  startCodePolling();
}


// ─── BUILD SYSTEM PROMPT ───

function buildSystemPrompt(userStats, currentProblem, currentCode, submissionResult) {
  const stats = userStats?.stats || { all: 0, easy: 0, medium: 0, hard: 0 };
  const tags = userStats?.tags || [];

  const topTags = tags.slice(0, 10).map(t => `${t.tagName} (${t.problemsSolved})`).join(', ');
  const solvedList = (userStats?.allSolved && userStats.allSolved.length > 0)
    ? userStats.allSolved.join(', ')
    : (userStats?.recent || []).slice(0, 15).join(', ');

  const current = currentProblem?.title
    ? `Working on: ${currentProblem.title} [${currentProblem.tags?.join(', ') || 'no tags'}]`
    : 'Browsing LeetCode.';

  const codeContext = currentCode
    ? `\n\nCURRENT CODE:\n\`\`\`\n${currentCode}\n\`\`\``
    : '';

  let resultContext = '';
  if (submissionResult) {
    resultContext = `\n\nSUBMISSION RESULT: ${submissionResult.verdict || 'Unknown'}`;
    if (submissionResult.errorMsg) resultContext += `\nError: ${submissionResult.errorMsg}`;
    if (submissionResult.lastInput) resultContext += `\nTest Input: ${submissionResult.lastInput}`;
    if (submissionResult.lastOutput) resultContext += `\nGot Output: ${submissionResult.lastOutput}`;
    if (submissionResult.lastExpected) resultContext += `\nExpected:   ${submissionResult.lastExpected}`;
  }

  return `You are LCPath, a Socratic LeetCode coach.
Context: User has solved ${stats.all} problems. Top topics: ${topTags}.
${current}${codeContext}${resultContext}

GOAL: Guide the user to solve the problem themselves using the Socratic method.
RULES:
1. By default, do NOT generate full solutions unprompted. Use hints, questions, and nudges instead.
   EXCEPTION: If the user explicitly asks to see the full code, their code, or a complete solution, provide it clearly and completely — do not refuse.
2. Use the Socratic method: ask guiding questions, point out edge cases, or give small logic nudges.
3. If their code has a bug, describe the logical flaw or an input that breaks it — don't just rewrite it.
4. If there is a SUBMISSION RESULT, proactively reference the specific error, input, and expected vs actual output.
5. Be concise, technical, and encouraging.`;
}


// ─── SEND MESSAGE ───

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;

  const canSend = await checkFreeTierLimit();
  if (!canSend) {
    addMessageToUI('ai', "🔒 **Daily Limit Reached**\n\nYou've used all 5 of your free AI hints/messages for today! Come back tomorrow or upgrade to a Pro plan for unlimited coaching.");
    chatInput.value = '';
    return;
  }

  chatInput.value = '';

  // Render user message
  addMessageToUI('user', text);
  chatHistory.push({ role: 'user', content: text });
  saveChatHistory();

  // Thinking indicator
  const thinkingEl = addMessageToUI('ai', '...');
  thinkingEl.classList.add('loading');

  // Snapshot the latest code right before building the prompt
  // This ensures we have the current editor state even if polling hasn't fired yet
  if (typeof requestFreshCode === 'function') {
    requestFreshCode();
    await new Promise(r => setTimeout(r, 400)); // brief wait for round-trip
  }

  try {
    const systemPrompt = buildSystemPrompt(
      userData?.userStats,
      userData?.currentProblem,
      userData?.currentCode,
      userData?.submissionResult
    );

    const res = await fetch('https://lc-path.onrender.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory
        ],
        temperature: 0.5,
        max_tokens: 800
      })
    });

    const data = await res.json();
    if (!data.choices || !data.choices[0]) throw new Error('Invalid API response');

    const reply = data.choices[0].message.content;

    thinkingEl.classList.remove('loading');
    thinkingEl.innerHTML = formatMessage(reply);
    chatHistory.push({ role: 'assistant', content: reply });
    saveChatHistory();
    await incrementUsage();

  } catch (e) {
    thinkingEl.classList.remove('loading');
    thinkingEl.textContent = 'Error reaching AI Backend. Check your server and API key.';
    thinkingEl.classList.add('error');
    console.error('LCPath chat error:', e);
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}


// ─── FORMAT MESSAGE (parse code blocks like LLMs) ───

function formatMessage(text) {
  // First escape the entire text to prevent HTML injection and preserve HTML tags as text
  const escapedText = escapeHtml(text);

  // Use a temporary map to store code blocks and avoid newline replacement inside them
  const codeBlocks = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  let formatted = escapedText.replace(codeBlockRegex, (match, lang, code) => {
    const id = `__CODE_BLOCK_${codeBlocks.length}__`;
    const language = lang || 'code';
    const escapedCode = code.trim();
    codeBlocks.push({
      id,
      html: `
        <div class="chat-code-block">
          <div class="chat-code-header">
            <span>${language}</span>
            <button class="copy-code-btn" title="Copy code">📋</button>
          </div>
          <div class="chat-code-content">${highlightSyntax(escapedCode, language)}</div>
        </div>`
    });
    return id;
  });

  // Replace inline `code` with styled spans
  formatted = formatted.replace(/`([^`]+)`/g, '<code class="inline-code">$1</code>');

  // Replace newlines with <br> safely
  formatted = formatted.replace(/\n/g, '<br>');

  // Bold text
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

  // Put code blocks back
  codeBlocks.forEach(block => {
    formatted = formatted.replace(block.id, block.html);
  });

  return formatted;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function highlightSyntax(code, lang) {
  // Basic syntax highlighting for common languages
  const keywords = {
    python: ['def', 'class', 'return', 'if', 'else', 'elif', 'for', 'while', 'in', 'not', 'and', 'or', 'import', 'from', 'as', 'try', 'except', 'finally', 'with', 'yield', 'lambda', 'pass', 'break', 'continue', 'True', 'False', 'None', 'async', 'await', 'self'],
    javascript: ['function', 'const', 'let', 'var', 'return', 'if', 'else', 'for', 'while', 'class', 'new', 'this', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'typeof', 'instanceof', 'true', 'false', 'null', 'undefined'],
    cpp: ['int', 'void', 'char', 'bool', 'float', 'double', 'string', 'vector', 'class', 'struct', 'return', 'if', 'else', 'for', 'while', 'switch', 'case', 'break', 'continue', 'public', 'private', 'protected', 'virtual', 'override', 'const', 'auto', 'nullptr', 'true', 'false', 'new', 'delete', 'this', 'template', 'typename', 'using', 'namespace', 'std', 'include'],
    java: ['class', 'public', 'private', 'protected', 'static', 'void', 'int', 'String', 'boolean', 'return', 'if', 'else', 'for', 'while', 'new', 'this', 'super', 'import', 'try', 'catch', 'throw', 'throws', 'final', 'abstract', 'interface', 'extends', 'implements', 'null', 'true', 'false'],
  };

  const langKeywords = keywords[lang?.toLowerCase()] || keywords.python;

  const commentPattern = `(\\/\\/.*$|#.*$)`;
  const stringPattern = `(&quot;.*?&quot;|&#39;.*?&#39;|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')`;
  const numberPattern = `\\b(\\d+)\\b`;
  const keywordPattern = `\\b(${langKeywords.join('|')})\\b`;

  const combinedRegex = new RegExp(`${commentPattern}|${stringPattern}|${numberPattern}|${keywordPattern}`, 'gm');

  return code.replace(combinedRegex, (match, comment, string, number, keyword) => {
    if (comment) return `<span class="hl-comment">${comment}</span>`;
    if (string) return `<span class="hl-string">${string}</span>`;
    if (number) return `<span class="hl-number">${number}</span>`;
    if (keyword) return `<span class="hl-keyword">${keyword}</span>`;
    return match;
  });
}


// ─── COPY CODE BUTTON & EVENT DELEGATION (Manifest V3 Compliant) ───

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback for older browsers or restricted environments
  return new Promise((resolve, reject) => {
    try {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      const successful = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (successful) {
        resolve();
      } else {
        reject(new Error('execCommand copy failed'));
      }
    } catch (err) {
      reject(err);
    }
  });
}

chatMessages.addEventListener('click', (e) => {
  const btn = e.target.closest('.copy-code-btn');
  if (!btn) return;

  const codeBlock = btn.closest('.chat-code-block');
  if (!codeBlock) return;

  const codeContentEl = codeBlock.querySelector('.chat-code-content');
  if (!codeContentEl) return;

  const code = codeContentEl.textContent;
  copyToClipboard(code).then(() => {
    const originalText = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = originalText; }, 1500);
  }).catch(err => {
    console.error('Failed to copy code:', err);
  });
});


// ─── ADD MESSAGE TO CHAT ───

function addMessageToUI(role, text, shouldFormat = true) {
  const el = document.createElement('div');
  el.className = `msg msg-${role}`;
  if (role === 'ai') {
    el.innerHTML = shouldFormat ? formatMessage(text) : text;
  } else {
    el.textContent = text;
  }
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}

// Helper for hint button UI
function updateHintButtonUI() {
  if (hintCount < 3) {
    hintBtn.textContent = `💡 Hint (${hintCount + 1}/3)`;
  } else if (hintCount === 3) {
    hintBtn.textContent = '💻 Reveal Solution';
  } else {
    hintBtn.textContent = '✅ All hints revealed';
    hintBtn.disabled = true;
  }
}


// ─── PROGRESSIVE HINTS ───

async function requestHint() {
  if (hintCount > 3) return;

  const problemTitle = userData?.currentProblem?.title;

  if (!problemTitle) {
    addMessageToUI('ai', "I can't see which problem you're on. Navigate to a LeetCode problem page first!");
    return;
  }

  const canSend = await checkFreeTierLimit();
  if (!canSend) {
    addMessageToUI('ai', "🔒 **Daily Limit Reached**\n\nYou've used all 5 of your free AI hints/messages for today! Come back tomorrow or upgrade to a Pro plan for unlimited coaching.");
    return;
  }

  const hintLevels = [
    `Give a very subtle hint for the LeetCode problem "${problemTitle}". Just mention the general approach or data structure to think about. Do NOT give the solution. Be brief (2-3 sentences). If you know what's wrong with their approach, mention it vaguely.`,
    `Give a more detailed hint for the LeetCode problem "${problemTitle}". Explain the algorithm pattern to use and walk through the key insight. Do NOT write the full code, but you can describe the steps. Keep it to 3-4 sentences.`,
    `Give a very detailed hint for the LeetCode problem "${problemTitle}" that almost reveals the solution. Explain the exact data structure, the key trick, and walk through the logic step by step. You can include pseudocode but not the exact solution yet.`,
    `Give the complete, optimal solution for the LeetCode problem "${problemTitle}" in Python. Include the code in a python code block with comments explaining each step. Also briefly explain the time and space complexity.`
  ];

  // Switch to chat tab
  document.querySelectorAll('.tab, .tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab')[1].classList.add('active');
  document.getElementById('tab-chat').classList.add('active');

  // Grab the latest code from the editor when switching to Chat
  if (typeof requestFreshCode === 'function') {
    requestFreshCode();
    await new Promise(r => setTimeout(r, 400)); // brief wait for round-trip
  }

  const currentCode = userData?.currentCode;
  const codeContext = currentCode
    ? `\n\nThe user's current code:\n\`\`\`\n${currentCode}\n\`\`\``
    : '';

  const prompt = hintLevels[hintCount] + codeContext;

  // Show thinking indicator
  const thinkingEl = addMessageToUI('ai', '...');
  thinkingEl.classList.add('loading');

  try {
    const systemPrompt = buildSystemPrompt(
      userData?.userStats,
      userData?.currentProblem,
      userData?.currentCode
    );

    const res = await fetch('https://lc-path.onrender.com/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.4, // Low temperature for consistent hints
        max_tokens: hintCount === 3 ? 800 : 400
      })
    });

    const data = await res.json();
    if (!data.choices || !data.choices[0]) throw new Error('Invalid API response');

    const reply = data.choices[0].message.content;

    thinkingEl.classList.remove('loading');
    thinkingEl.innerHTML = formatMessage(reply);

    // Also add to history so AI knows what hints were given
    chatHistory.push({ role: 'assistant', content: `[Hint ${hintCount + 1}] ${reply}` });
    saveChatHistory();
    await incrementUsage();

  } catch (e) {
    thinkingEl.classList.remove('loading');
    thinkingEl.textContent = 'Error getting hint. Check your API key.';
    thinkingEl.classList.add('error');
    console.error('Hint error:', e);
  }

  hintCount++;
  updateHintButtonUI();

  chatMessages.scrollTop = chatMessages.scrollHeight;
}


// ─── EVENT LISTENERS ───

chatSend.addEventListener('click', sendMessage);

// Clear history button (optional, but good for UX)
const clearBtn = document.createElement('button');
clearBtn.textContent = '🗑️';
clearBtn.title = 'Clear History';
clearBtn.className = 'clear-chat-btn';
clearBtn.onclick = async () => {
  if (confirm('Clear chat history?')) {
    chatHistory = [];
    hintCount = 0;
    await saveChatHistory();
    chatMessages.innerHTML = '';
    updateHintButtonUI();
    addMessageToUI('ai', 'Chat history cleared. How can I help you today?');
  }
};
document.querySelector('.chat-input-area').prepend(clearBtn);

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

hintBtn.addEventListener('click', requestHint);
