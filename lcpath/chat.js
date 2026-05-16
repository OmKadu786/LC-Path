// chat.js — Chat tab + DeepSeek API + Progressive Hints

const chatMessages = document.getElementById('chat-messages');
const chatInput    = document.getElementById('chat-input');
const chatSend     = document.getElementById('chat-send');
const hintBtn      = document.getElementById('hint-btn');
const contextPill  = document.getElementById('context-pill');

let chatHistory = []; // [{role, content}] — full conversation context
let hintCount = 0;


// ─── UPDATE CONTEXT PILL ───

function updateContextPill() {
  if (userData && userData.userStats) {
    contextPill.textContent = `📋 knows your ${userData.userStats.stats.all} solved problems`;
    if (userData.currentCode) {
      contextPill.textContent += ` + your code`;
    }
  }
}

// Watch for userData changes (set by panel.js)
const contextInterval = setInterval(() => {
  if (userData) {
    updateContextPill();
    clearInterval(contextInterval);
  }
}, 500);


// ─── BUILD SYSTEM PROMPT ───

function buildSystemPrompt(userStats, currentProblem, currentCode) {
  const stats = userStats?.stats || { all: 0, easy: 0, medium: 0, hard: 0 };
  const tags = userStats?.tags || [];
  
  const topTags = tags.slice(0, 10).map(t => `${t.tagName} (${t.problemsSolved})`).join(', ');
  const solvedList = (userStats?.allSolved && userStats.allSolved.length > 0)
    ? userStats.allSolved.join(', ')
    : (userStats?.recent || []).slice(0, 15).join(', ');

  const current = currentProblem?.title
    ? `The user is currently working on: ${currentProblem.title} [${currentProblem.tags?.join(', ') || 'no tags'}]`
    : 'The user is browsing LeetCode.';

  const codeContext = currentCode
    ? `\n\nThe user's current code:\n\`\`\`\n${currentCode}\n\`\`\``
    : '';

  return `You are LCPath, a personalized LeetCode study coach.
You know exactly which problems the user has solved in their lifetime.

LIFETIME STATS:
Total Solved: ${stats.all} (Easy: ${stats.easy}, Medium: ${stats.medium}, Hard: ${stats.hard})
Top Topics: ${topTags}

SOLVED PROBLEMS:
${solvedList}

${current}${codeContext}

Use this context to give highly personalized advice.
CRITICAL INSTRUCTIONS:
1. NEVER GIVE THE FULL SOLUTION OR EXACT CODE immediately unless the user explicitly demands it (e.g. "show me the code").
2. ALWAYS use the Socratic method. Guide the user to the answer by giving subtle hints, pointing out flaws in their logic, or asking guiding questions.
3. If they show code with a bug, point them to the exact line and explain why it fails, but let them fix it themselves.
4. Be concise and conversational. No fluff.`;
}


// ─── SEND MESSAGE ───

async function sendMessage() {
  const text = chatInput.value.trim();
  if (!text) return;
  chatInput.value = '';

  // Render user message
  addMessage('user', text);
  chatHistory.push({ role: 'user', content: text });

  // Thinking indicator
  const thinkingEl = addMessage('ai', '...');
  thinkingEl.classList.add('loading');

  try {
    const systemPrompt = buildSystemPrompt(
      userData?.userStats,
      userData?.currentProblem,
      userData?.currentCode
    );

    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          ...chatHistory
        ],
        temperature: 0.8,
        max_tokens: 800
      })
    });

    const data = await res.json();
    const reply = data.choices[0].message.content;

    thinkingEl.classList.remove('loading');
    thinkingEl.innerHTML = formatMessage(reply);
    chatHistory.push({ role: 'assistant', content: reply });

  } catch (e) {
    thinkingEl.classList.remove('loading');
    thinkingEl.textContent = 'Error reaching DeepSeek. Check your API key in settings.';
    thinkingEl.classList.add('error');
    console.error('LCPath chat error:', e);
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}


// ─── FORMAT MESSAGE (parse code blocks like LLMs) ───

function formatMessage(text) {
  // Replace ```lang\ncode\n``` blocks with styled code blocks
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;

  let formatted = text.replace(codeBlockRegex, (match, lang, code) => {
    const language = lang || 'code';
    const escapedCode = escapeHtml(code.trim());
    return `
      <div class="chat-code-block">
        <div class="chat-code-header">
          <span>${language}</span>
          <button class="copy-code-btn" onclick="copyCode(this)" title="Copy code">📋</button>
        </div>
        <div class="chat-code-content">${highlightSyntax(escapedCode, language)}</div>
      </div>`;
  });

  // Replace inline `code` with styled spans
  formatted = formatted.replace(/`([^`]+)`/g, '<code style="background:#333;padding:2px 6px;border-radius:4px;font-family:monospace;font-size:12px;">$1</code>');

  // Replace newlines with <br> (but not inside code blocks)
  formatted = formatted.replace(/\n/g, '<br>');

  // Bold text
  formatted = formatted.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

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

  // Highlight comments
  code = code.replace(/(\/\/.*$|#.*$)/gm, '<span class="hl-comment">$1</span>');

  // Highlight strings
  code = code.replace(/(&quot;.*?&quot;|&#39;.*?&#39;|".*?"|'.*?')/g, '<span class="hl-string">$1</span>');

  // Highlight numbers
  code = code.replace(/\b(\d+)\b/g, '<span class="hl-number">$1</span>');

  // Highlight keywords
  langKeywords.forEach(kw => {
    const regex = new RegExp(`\\b(${kw})\\b`, 'g');
    code = code.replace(regex, '<span class="hl-keyword">$1</span>');
  });

  return code;
}


// ─── COPY CODE BUTTON ───

window.copyCode = function(btn) {
  const codeBlock = btn.closest('.chat-code-block');
  const code = codeBlock.querySelector('.chat-code-content').textContent;
  navigator.clipboard.writeText(code).then(() => {
    const originalText = btn.textContent;
    btn.textContent = '✓';
    setTimeout(() => { btn.textContent = originalText; }, 1500);
  });
};


// ─── ADD MESSAGE TO CHAT ───

function addMessage(role, text) {
  const el = document.createElement('div');
  el.className = `msg msg-${role}`;
  if (role === 'ai') {
    el.innerHTML = formatMessage(text);
  } else {
    el.textContent = text;
  }
  chatMessages.appendChild(el);
  chatMessages.scrollTop = chatMessages.scrollHeight;
  return el;
}


// ─── PROGRESSIVE HINTS ───

async function requestHint() {
  if (hintCount > 3) return;

  const problemTitle = userData?.currentProblem?.title;

  if (!problemTitle) {
    addMessage('ai', "I can't see which problem you're on. Navigate to a LeetCode problem page first!");
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

  const currentCode = userData?.currentCode;
  const codeContext = currentCode
    ? `\n\nThe user's current code:\n\`\`\`\n${currentCode}\n\`\`\``
    : '';

  const prompt = hintLevels[hintCount] + codeContext;

  // Show thinking indicator
  const thinkingEl = addMessage('ai', '...');
  thinkingEl.classList.add('loading');

  try {
    const systemPrompt = buildSystemPrompt(
      userData?.userStats,
      userData?.currentProblem,
      userData?.currentCode
    );

    const res = await fetch('http://localhost:3000/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: hintCount === 3 ? 800 : 400
      })
    });

    const data = await res.json();
    const reply = data.choices[0].message.content;

    thinkingEl.classList.remove('loading');
    thinkingEl.innerHTML = formatMessage(reply);

  } catch (e) {
    thinkingEl.classList.remove('loading');
    thinkingEl.textContent = 'Error getting hint. Check your API key.';
    thinkingEl.classList.add('error');
  }

  hintCount++;

  // Update button text
  if (hintCount < 3) {
    hintBtn.textContent = `💡 Hint (${hintCount + 1}/3)`;
  } else if (hintCount === 3) {
    hintBtn.textContent = '💻 Show Code';
  } else {
    hintBtn.textContent = '✅ All hints revealed';
    hintBtn.disabled = true;
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}


// ─── EVENT LISTENERS ───

chatSend.addEventListener('click', sendMessage);

chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

hintBtn.addEventListener('click', requestHint);
