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

function getCurrentCode() {
  // Try Monaco editor (LeetCode's main editor)
  const viewLines = document.querySelectorAll('.view-lines .view-line');
  if (viewLines.length > 0) {
    return [...viewLines].map(line => line.textContent).join('\n');
  }

  // Try textarea fallback
  const textarea = document.querySelector('textarea.inputarea');
  if (textarea) {
    return textarea.value;
  }

  return null;
}


// ─── 4. FETCH SOLVED PROBLEMS VIA LEETCODE GRAPHQL API ───

async function fetchSolvedProblems(username) {
  // Use LeetCode's public GraphQL API — more stable than DOM scraping
  const query = `
    query recentAcSubmissions($username: String!, $limit: Int!) {
      recentAcSubmissionList(username: $username, limit: $limit) {
        title
        titleSlug
      }
    }
  `;

  try {
    const res = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query,
        variables: { username, limit: 200 }
      })
    });

    const data = await res.json();
    const submissions = data?.data?.recentAcSubmissionList || [];

    // Deduplicate by titleSlug
    const seen = new Set();
    const problems = [];
    for (const sub of submissions) {
      if (!seen.has(sub.titleSlug)) {
        seen.add(sub.titleSlug);
        problems.push({
          title: sub.title,
          slug: sub.titleSlug,
          difficulty: 'Unknown' // We'll enrich this later if needed
        });
      }
    }

    return problems;
  } catch (e) {
    console.error('LCPath: GraphQL fetch failed, falling back to DOM scrape', e);
    return fallbackDOMScrape(username);
  }
}

// Fallback: fetch profile page and parse DOM
async function fallbackDOMScrape(username) {
  try {
    const url = `https://leetcode.com/u/${username}/`;
    const res = await fetch(url);
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const rows = doc.querySelectorAll('.ac-solved-problems tr, table tr');
    const problems = [];

    rows.forEach(row => {
      const link = row.querySelector('a');
      const diffCell = row.querySelector('td:nth-child(2)');
      if (!link) return;
      problems.push({
        title: link.textContent.trim(),
        slug: link.href?.split('/problems/')?.[1]?.replace('/', '') || '',
        difficulty: diffCell?.textContent?.trim() || 'Unknown'
      });
    });

    return problems;
  } catch (e) {
    console.error('LCPath: DOM scrape also failed', e);
    return [];
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
      payload: { solved: [], currentProblem: getCurrentProblemData(), currentCode: null, username: null }
    });
    return;
  }

  // Check cache
  let solved = stored[CACHE_KEY];
  const stale = !stored.lcpath_cache_time || (Date.now() - stored.lcpath_cache_time > CACHE_TTL);

  if (!solved || stale) {
    solved = await fetchSolvedProblems(username);
    await chrome.storage.local.set({
      [CACHE_KEY]: solved,
      lcpath_cache_time: Date.now()
    });
  }

  const currentProblem = getCurrentProblemData();
  const currentCode = getCurrentCode();

  // Send to panel
  chrome.runtime.sendMessage({
    type: 'LCPATH_DATA',
    payload: { solved, currentProblem, currentCode, username }
  });
}

// Run on load
main();

// Re-run on SPA navigation (LeetCode uses client-side routing)
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    setTimeout(() => {
      injectButton();
      // Re-scrape current problem data and code
      const currentProblem = getCurrentProblemData();
      const currentCode = getCurrentCode();
      chrome.runtime.sendMessage({
        type: 'LCPATH_DATA',
        payload: { currentProblem, currentCode }
      });
    }, 2000);
  }
});
observer.observe(document.body, { childList: true, subtree: true });
