// content.js — runs on every leetcode.com page
// Responsibilities:
//   1. Inject an "LCPath" button into LeetCode's navbar
//   2. Scrape the user's solved problems (with caching)
//   3. Read the current problem's title, difficulty, tags, and code
//   4. Send all data to the side panel via chrome.runtime messages

const CACHE_KEY = 'lcpath_solved_cache';
const CACHE_TTL = 6 * 60 * 60 * 1000; // 6 hours

// ─── Selectors (update these if LeetCode changes their DOM) ───
const SELECTORS = {
  // Problem page
  problemTitle: '[data-cy="question-title"], .text-title-large a, h4.text-title-large',
  difficultyBadge: '[diff], .text-difficulty-easy, .text-difficulty-medium, .text-difficulty-hard, .css-10o4wqw',
  topicTags: 'a.topic-tag__1jni, a[href*="/tag/"]',
  codeEditor: '.view-lines, .monaco-editor .view-line, textarea.inputarea',

  // Navbar injection targets
  // Problemset page: inject next to "Store" in the top nav
  problemsetNav: 'nav[role="tablist"], .flex.items-center .hidden.md\\:flex, #navbar-right-container',
  // Problem page: inject next to the sparkle/Ask Leet button in the top center bar
  problemTopBar: '.flex.items-center.gap-2, [class*="action-buttons"], .relative.flex.items-center',
};


// ─── 1. INJECT LCPATH BUTTON INTO LEETCODE UI ───

function injectButton() {
  // Don't double-inject
  if (document.querySelector('.lcpath-inject-btn')) return;

  const btn = document.createElement('button');
  btn.className = 'lcpath-inject-btn';
  btn.innerHTML = `<span class="lcpath-icon">🧭</span> LCPath`;
  btn.title = 'Open LCPath side panel';

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    chrome.runtime.sendMessage({ type: 'OPEN_SIDE_PANEL' });
  });

  // Try to inject into the problem page top bar first (next to Ask Leet / Submit)
  if (window.location.pathname.includes('/problems/') && !window.location.pathname.endsWith('/problemset/')) {
    const topBar = findElement(SELECTORS.problemTopBar);
    if (topBar) {
      topBar.appendChild(btn);
      return;
    }
  }

  // Otherwise try the main navbar (problemset page, next to Store)
  const navbar = findElement(SELECTORS.problemsetNav);
  if (navbar) {
    navbar.appendChild(btn);
    return;
  }

  // Fallback: just append to body as a floating button
  btn.style.cssText = `
    position: fixed;
    bottom: 24px;
    right: 24px;
    z-index: 99999;
    padding: 10px 18px;
    border-radius: 24px;
    box-shadow: 0 4px 16px rgba(0,0,0,0.3);
    font-size: 14px;
  `;
  document.body.appendChild(btn);
}

function findElement(selectorString) {
  // Try each selector separated by commas
  const selectors = selectorString.split(',').map(s => s.trim());
  for (const selector of selectors) {
    try {
      const el = document.querySelector(selector);
      if (el) return el;
    } catch (e) {
      // Invalid selector, skip
    }
  }
  return null;
}


// ─── 2. SCRAPE CURRENT PROBLEM DATA ───

function getCurrentProblemData() {
  const titleEl = findElement(SELECTORS.problemTitle);
  const title = titleEl?.textContent?.trim() || null;

  const diffEl = findElement(SELECTORS.difficultyBadge);
  const difficulty = diffEl?.textContent?.trim() || 'Unknown';

  const tagEls = document.querySelectorAll(SELECTORS.topicTags);
  const tags = [...tagEls].map(el => el.textContent.trim()).filter(t => t.length > 0);

  return { title, tags, difficulty };
}


// ─── 3. READ CODE FROM THE EDITOR ───

// Content scripts run in an isolated world — window.monaco is inaccessible directly.
// We inject a tiny <script> into the actual page context, read the code into a
// hidden <meta> tag, then retrieve it from the content script.
function getCurrentCode() {
  return new Promise((resolve) => {
    // Remove any stale bridge element
    const old = document.getElementById('__lcpath_code_bridge');
    if (old) old.remove();

    // Inject a script that runs in PAGE context (has access to window.monaco)
    const script = document.createElement('script');
    script.textContent = `
      (function() {
        try {
          let code = null;
          // Try Monaco API
          const editors = window.monaco?.editor?.getEditors?.() ||
                          window.monaco?.editor?.getModels?.()?.map(m => ({ getModel: () => m })) || [];
          if (editors.length > 0) {
            code = editors[0].getModel?.()?.getValue?.();
          }
          // Fallback to any model
          if (!code) {
            const models = window.monaco?.editor?.getModels?.() || [];
            for (const m of models) {
              const v = m.getValue?.();
              if (v && v.trim().length > 0) { code = v; break; }
            }
          }
          if (code) {
            let el = document.getElementById('__lcpath_code_bridge');
            if (!el) { el = document.createElement('meta'); el.id = '__lcpath_code_bridge'; document.head.appendChild(el); }
            el.setAttribute('data-code', encodeURIComponent(code));
          }
        } catch(e) {}
      })();
    `;
    document.head.appendChild(script);
    script.remove();

    // Give page script a tick to run
    setTimeout(() => {
      const bridge = document.getElementById('__lcpath_code_bridge');
      if (bridge) {
        const encoded = bridge.getAttribute('data-code');
        bridge.remove();
        if (encoded) return resolve(decodeURIComponent(encoded));
      }

      // Fallbacks if injection didn't work
      const textarea = document.querySelector('.monaco-editor textarea');
      if (textarea && textarea.value && textarea.value.trim().length > 0) {
        return resolve(textarea.value);
      }
      const viewLines = document.querySelectorAll('.view-lines .view-line');
      if (viewLines.length > 0) {
        return resolve([...viewLines].map(l => l.textContent).join('\n'));
      }
      resolve(null);
    }, 200);
  });
}

// ─── 4. READ SUBMISSION RESULT (errors, test cases, diffs) ───

function getSubmissionResult() {
  try {
    // Result verdict (Accepted, Wrong Answer, Runtime Error, etc.)
    const verdictEl = document.querySelector('[data-e2e-locator="submission-result"], .text-red-s, .text-green-s, [class*="result-state"]');
    const verdict = verdictEl?.textContent?.trim() || null;

    // Runtime error message
    const errorMsgEl = document.querySelector('[class*="error-message"], .font-mono.text-xs, [class*="runtime-error"]');
    const errorMsg = errorMsgEl?.textContent?.trim() || null;

    // Test case details
    const getText = (label) => {
      const els = [...document.querySelectorAll('div, span, p')];
      const labelEl = els.find(e => e.textContent.trim() === label && e.children.length === 0);
      return labelEl?.parentElement?.querySelector('pre, code, .font-mono')?.textContent?.trim() || null;
    };

    // Try to get input/output/expected from result panel
    const allPres = [...document.querySelectorAll('.test-case-area pre, [class*="testcase"] pre, .font-menlo')];
    const inputEl   = document.querySelector('[data-e2e-locator="console-stdin"]');
    const outputEl  = document.querySelector('[data-e2e-locator="console-stdout"]');
    
    // Generic scrape of Last Executed Input / Output / Expected
    const panels = [...document.querySelectorAll('[class*="result"] [class*="panel"], .result-container')];
    
    let lastInput = null, lastOutput = null, lastExpected = null;
    document.querySelectorAll('div').forEach(div => {
      const text = div.textContent.trim();
      const next = div.nextElementSibling;
      if (text === 'Last Executed Input' && next) lastInput  = next.textContent.trim();
      if (text === 'Output'              && next) lastOutput = next.textContent.trim();
      if (text === 'Expected Output'     && next) lastExpected = next.textContent.trim();
    });

    if (!verdict && !errorMsg && !lastInput) return null;

    return { verdict, errorMsg, lastInput, lastOutput, lastExpected };
  } catch (e) {
    return null;
  }
}


// ─── 4. FETCH FULL USER STATS VIA LEETCODE GRAPHQL API ───

function getCSRFToken() {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

async function fetchAllSolvedProblems() {
  try {
    const res = await fetch('/api/problems/all/');
    if (!res.ok) return [];
    const data = await res.json();
    return data.stat_status_pairs
      .filter(p => p.status === 'ac')
      .map(p => p.stat.question__title);
  } catch (e) {
    console.error('LCPath: fetchAllSolvedProblems error', e);
    return [];
  }
}

async function fetchUserStats(username) {
  const query = `
    query userProfile($username: String!) {
      matchedUser(username: $username) {
        submitStats {
          acSubmissionNum {
            difficulty
            count
          }
        }
        tagProblemCounts {
          advanced { tagName problemsSolved }
          intermediate { tagName problemsSolved }
          fundamental { tagName problemsSolved }
        }
      }
      recentAcSubmissionList(username: $username, limit: 15) {
        title
        titleSlug
      }
    }
  `;

  try {
    const res = await fetch('/graphql', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'x-csrftoken': getCSRFToken()
      },
      body: JSON.stringify({
        query,
        variables: { username }
      })
    });

    const data = await res.json();
    
    if (data.errors) {
      return { error: 'GraphQL Error: ' + JSON.stringify(data.errors) };
    }
    
    // Format the response into a clean object
    const matchedUser = data?.data?.matchedUser;
    const recent = data?.data?.recentAcSubmissionList || [];
    
    if (!matchedUser) return { error: 'Username not found on LeetCode' };

    // Flatten tags
    const tags = [
      ...(matchedUser.tagProblemCounts.advanced || []),
      ...(matchedUser.tagProblemCounts.intermediate || []),
      ...(matchedUser.tagProblemCounts.fundamental || [])
    ].sort((a, b) => b.problemsSolved - a.problemsSolved);

    // Get difficulty counts
    const stats = {};
    matchedUser.submitStats.acSubmissionNum.forEach(s => {
      stats[s.difficulty.toLowerCase()] = s.count;
    });

    const allSolved = await fetchAllSolvedProblems();

    return {
      stats: stats, // { all: 100, easy: 30, medium: 50, hard: 20 }
      tags: tags.slice(0, 15), // top 15 tags
      recent: recent.map(r => r.title),
      allSolved: allSolved
    };

  } catch (e) {
    console.error('LCPath: GraphQL fetch failed', e);
    return { error: e.toString() };
  }
}


// ─── 5. MAIN: GATHER DATA AND SEND TO PANEL ───

async function main() {
  // Wait a moment for LeetCode's SPA to fully render
  await new Promise(r => setTimeout(r, 1500));

  // Inject the button
  injectButton();

  const stored = await chrome.storage.local.get(['username', CACHE_KEY, 'lcpath_cache_time']);
  const username = stored.username;

  if (!username) {
    // User hasn't set up yet — just send empty data, panel will show setup screen
    chrome.runtime.sendMessage({
      type: 'LCPATH_DATA',
      payload: { userStats: null, currentProblem: getCurrentProblemData(), currentCode: null, username: null }
    });
    return;
  }

  // Check cache
  let userStats = stored[CACHE_KEY];
  const stale = !stored.lcpath_cache_time || (Date.now() - stored.lcpath_cache_time > CACHE_TTL);

  if (!userStats || stale) {
    userStats = await fetchUserStats(username);
    if (userStats) {
      await chrome.storage.local.set({
        [CACHE_KEY]: userStats,
        lcpath_cache_time: Date.now()
      });
    }
  }

  const currentProblem = getCurrentProblemData();
  const currentCode = await getCurrentCode();
  const submissionResult = getSubmissionResult();

  // Send to panel
  chrome.runtime.sendMessage({
    type: 'LCPATH_DATA',
    payload: { userStats, currentProblem, currentCode, submissionResult, username }
  });

  // Monaco may not be fully loaded yet — retry code read after 3 more seconds
  setTimeout(async () => {
    const retryCode = await getCurrentCode();
    if (retryCode && retryCode !== currentCode) {
      chrome.runtime.sendMessage({
        type: 'LCPATH_DATA',
        payload: { currentCode: retryCode }
      });
    }
  }, 3000);
}

// Run on load
main();

// Re-run on SPA navigation (LeetCode uses client-side routing)
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    const prevUrl = lastUrl;
    lastUrl = location.href;

    // Detect when user lands on a submission result page
    // LeetCode URL pattern: /submissions/detail/<id>/
    const justSubmitted = location.href.includes('/submissions/') ||
                          location.href.includes('/submit/');
    const cameFromProblem = prevUrl.includes('/problems/');

    if (justSubmitted || cameFromProblem) {
      // Bust the cache so updated stats get fetched fresh
      chrome.storage.local.remove([CACHE_KEY, 'lcpath_cache_time'], () => {
        console.log('LCPath: cache busted after submission, will refresh stats');
      });
    }

    setTimeout(async () => {
      injectButton();
      const currentProblem = getCurrentProblemData();
      const currentCode = await getCurrentCode();
      const submissionResult = getSubmissionResult();
      chrome.runtime.sendMessage({
        type: 'LCPATH_DATA',
        payload: { currentProblem, currentCode, submissionResult }
      });
    }, 2000);
  }
});
// Watch for submission result panel appearing WITHOUT url change
// Guard against infinite loop: getCurrentCode() injects a <script> tag which triggers this observer.
let resultObserverDebounce = null;
let isReadingCode = false;
const resultObserver = new MutationObserver((mutations) => {
  if (isReadingCode) return; // Ignore mutations caused by our own script injection

  // Only fire if a new node was added that looks like a result panel (avoid firing on every keystroke)
  const relevant = mutations.some(m =>
    [...m.addedNodes].some(n => n.nodeType === 1 &&
      (n.textContent?.includes('Wrong Answer') ||
       n.textContent?.includes('Runtime Error') ||
       n.textContent?.includes('Accepted') ||
       n.textContent?.includes('Time Limit') ||
       n.textContent?.includes('Memory Limit') ||
       n.textContent?.includes('Compile Error'))
    )
  );
  if (!relevant) return;

  clearTimeout(resultObserverDebounce);
  resultObserverDebounce = setTimeout(async () => {
    const result = getSubmissionResult();
    if (result) {
      isReadingCode = true;
      const currentCode = await getCurrentCode();
      isReadingCode = false;
      chrome.runtime.sendMessage({
        type: 'LCPATH_DATA',
        payload: { submissionResult: result, currentCode }
      });
    }
  }, 1200);
});
resultObserver.observe(document.body, { childList: true, subtree: true });
observer.observe(document.body, { childList: true, subtree: true });

// Listen for manual refetch from panel
chrome.runtime.onMessage.addListener(async (msg) => {
  if (msg.type === 'REFETCH_DATA') {
    // Clear old data and try again
    chrome.storage.local.remove([CACHE_KEY, 'lcpath_cache_time'], () => {
      main();
    });
  }

  // Panel opened or switched to chat tab — send a fresh code snapshot
  if (msg.type === 'FETCH_CODE') {
    const currentCode = await getCurrentCode();
    const submissionResult = getSubmissionResult();
    chrome.runtime.sendMessage({
      type: 'LCPATH_DATA',
      payload: { currentCode, submissionResult }
    });
  }
});
