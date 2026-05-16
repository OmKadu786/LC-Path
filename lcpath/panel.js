// panel.js — Home tab: stats, topic bars, recommendations, setup, tabs

let userData = null;

// ─── INIT ───

// ─── SETUP SCREEN ───

async function checkSetup() {
  const { username } = await chrome.storage.local.get(['username']);

  if (!username) {
    document.getElementById('setup-screen').classList.remove('hidden');
    return false;
  }

  document.getElementById('setup-screen').classList.add('hidden');
  return true;
}

document.getElementById('save-setup').addEventListener('click', async () => {
  const username = document.getElementById('input-username').value.trim();

  if (!username) return;

  await chrome.storage.local.set({
    username: username
  });

  document.getElementById('setup-screen').classList.add('hidden');

  // Trigger a data refresh by reloading
  location.reload();
});

document.getElementById('settings-btn').addEventListener('click', () => {
  document.getElementById('setup-screen').classList.remove('hidden');
  // Pre-fill existing values
  chrome.storage.local.get(['username'], (data) => {
    document.getElementById('input-username').value = data.username || '';
  });
});


// ─── LISTEN FOR DATA FROM CONTENT SCRIPT ───

chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type === 'LCPATH_DATA') {
    if (!userData) {
      if (msg.payload.userStats === undefined) return; // Ignore partial SPA updates if not initialized
      userData = msg.payload;
    } else {
      if (msg.payload.userStats) userData.userStats = msg.payload.userStats;
      if (msg.payload.currentProblem) userData.currentProblem = msg.payload.currentProblem;
      if (msg.payload.currentCode !== undefined) userData.currentCode = msg.payload.currentCode;
      if (msg.payload.username) userData.username = msg.payload.username;
    }
    renderHome(userData);
  }
});

// Also try to load cached data on panel open
async function loadCachedData() {
  const ready = await checkSetup();
  if (!ready) return;

  let sessionData = null;
  try {
    // Try session storage first (set by background.js)
    const session = await chrome.storage.session.get('lcpath_current_data');
    if (session.lcpath_current_data) {
      sessionData = session.lcpath_current_data;
    }
  } catch (e) {}

  // Try local cache
  const stored = await chrome.storage.local.get(['lcpath_solved_cache', 'username']);
  
  let dataLoaded = false;

  if (stored.lcpath_solved_cache) {
    dataLoaded = true;
    userData = {
      userStats: stored.lcpath_solved_cache,
      currentProblem: sessionData?.currentProblem || { title: null, tags: [], difficulty: 'Unknown' },
      currentCode: sessionData?.currentCode !== undefined ? sessionData.currentCode : null,
      username: stored.username
    };
    renderHome(userData);
  } else if (sessionData && sessionData.userStats) {
    dataLoaded = true;
    userData = sessionData;
    renderHome(userData);
  }

  // If no data loaded after 2 seconds, auto-retry silently, but show the fallback UI just in case
  if (!dataLoaded) {
    setTimeout(() => {
      if (!userData) {
        // Auto-retry fetch
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'REFETCH_DATA' });
        });
        renderHome(null);
      }
    }, 2000);
  }
}

loadCachedData();


// ─── RENDER STATS ───

function renderStats(stats) {
  const all = stats.all || 0;
  const easy = stats.easy || 0;
  const med = stats.medium || 0;

  document.getElementById('solved-count').textContent = `${all} solved`;
  document.getElementById('stat-solved').textContent = all;
  document.getElementById('stat-streak').textContent = '—'; // Hard to get via GraphQL easily
  document.getElementById('stat-ratio').textContent = all > 0
    ? `${Math.round(((easy + med) / all) * 100)}%`
    : '—';
}

// ─── TOPIC STRENGTH ───

const TOTAL_PROBLEMS_PER_TAG = {
  "Array": 2145, "String": 867, "Hash Table": 808, "Math": 666,
  "Dynamic Programming": 653, "Sorting": 512, "Greedy": 460,
  "Depth-First Search": 337, "Binary Search": 333, "Database": 310,
  "Bit Manipulation": 281, "Matrix": 274, "Tree": 262,
  "Breadth-First Search": 257, "Two Pointers": 251, "Prefix Sum": 245,
  "Heap (Priority Queue)": 214, "Simulation": 207, "Counting": 203,
  "Graph Theory": 181, "Binary Tree": 180, "Stack": 179,
  "Sliding Window": 164, "Enumeration": 146, "Design": 136,
  "Backtracking": 113, "Union-Find": 99, "Number Theory": 94,
  "Linked List": 82, "Ordered Set": 76, "Segment Tree": 75,
  "Monotonic Stack": 73, "Divide and Conquer": 65, "Trie": 61,
  "Combinatorics": 61, "Bitmask": 55, "Queue": 54, "Recursion": 51,
  "Geometry": 45, "Binary Indexed Tree": 44, "Memoization": 43,
  "Binary Search Tree": 42, "Hash Function": 42, "Topological Sort": 40,
  "Shortest Path": 38, "String Matching": 37, "Rolling Hash": 32,
  "Game Theory": 30, "Interactive": 25, "Data Stream": 24,
  "Monotonic Queue": 23, "Brainteaser": 21, "Merge Sort": 15,
  "Doubly-Linked List": 15, "Randomized": 12, "Counting Sort": 11,
  "Concurrency": 9, "Iterator": 9, "Sweep Line": 8,
  "Suffix Array": 8, "Quickselect": 8, "Probability and Statistics": 7,
  "Bucket Sort": 6, "Minimum Spanning Tree": 6, "Reservoir Sampling": 4,
  "Shell": 4, "Radix Sort": 3, "Eulerian Circuit": 3,
  "Rejection Sampling": 2, "Strongly Connected Component": 2,
  "Biconnected Component": 1, "Ordered Map": 0
};

function renderTopicBars(tags) {
  const container = document.getElementById('topic-bars');

  const userTagsMap = new Map(tags.map(t => [t.tagName, t.problemsSolved]));
  
  // Base popular tags to fall back on if the user hasn't solved enough
  const popularTags = [
    'Array', 'String', 'Hash Table', 'Math', 'Dynamic Programming', 
    'Sorting', 'Greedy', 'Depth-First Search'
  ];

  let displayTags = [...tags];

  // If user has < 8 tags, pad with popular tags they haven't done
  for (const p of popularTags) {
    if (displayTags.length >= 8) break;
    if (!userTagsMap.has(p)) {
      displayTags.push({ tagName: p, problemsSolved: 0 });
    }
  }

  // Ensure we show top 8
  displayTags = displayTags.slice(0, 8);

  container.innerHTML = displayTags.map(({ tagName, problemsSolved }) => {
    const total = TOTAL_PROBLEMS_PER_TAG[tagName] || 100;
    // Calculate percentage based on total problems for that tag, max 100%
    const pct = Math.min(Math.round((problemsSolved / total) * 100), 100);
    
    return `
      <div class="bar-row">
        <span class="bar-label" title="${tagName}">${tagName.length > 12 ? tagName.substring(0, 10) + '..' : tagName}</span>
        <div class="bar-bg">
          <div class="bar-fill" style="width:${pct}%; background: var(--primary);"></div>
        </div>
        <span class="bar-pct">${problemsSolved}/${total}</span>
      </div>`;
  }).join('');
}


// ─── RECOMMENDATIONS (via DeepSeek) ───

let currentRecs = [];
let currentTopics = [];
let currentRecIndex = 0;

document.getElementById('reload-recs-btn').addEventListener('click', () => {
  if (currentRecs.length > 0) {
    currentRecIndex = (currentRecIndex + 3) % currentRecs.length;
    renderRecommendationsState();
  }
});

async function fetchRecommendations(userStats, currentProblem) {
  const topTags = userStats.tags.slice(0, 5).map(t => t.tagName).join(', ');
  const solvedList = (userStats.allSolved && userStats.allSolved.length > 0) 
    ? userStats.allSolved.join(', ')
    : userStats.recent.slice(0, 15).join(', ');
    
  const easyRequirement = (userStats.stats.all || 0) < 500 
    ? "Include at least 1 'Easy' problem." 
    : "";

  const prompt = `You are a LeetCode study coach. The user has solved ${userStats.stats.all} problems in their lifetime.
Their strongest topics are: ${topTags}.
They have solved the following problems: ${solvedList}.
They are currently looking at: ${currentProblem?.title || 'unknown'} (${currentProblem?.tags?.join(', ') || 'no tags'}).

Return a JSON object with exactly 9 problem recommendations and 2 topic recommendations (no markdown fences, just the JSON object):
{
  "problems": [
    {
      "id": 3,
      "title": "Longest Substring Without Repeating Characters",
      "slug": "longest-substring-without-repeating-characters",
      "difficulty": "Easy|Medium|Hard",
      "topic": "main topic tag",
      "why": "one sentence reason based on their history"
    }
  ],
  "topics": [
    {
      "name": "Topic Name",
      "why": "one sentence reason why they should focus on this"
    }
  ]
}
Focus on filling their weakest topic gaps while building on what they know. ${easyRequirement}`;

  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 1500
    })
  });

  const data = await res.json();
  if (!data.choices || !data.choices[0]) throw new Error('Invalid API response');
  let text = data.choices[0].message.content.trim();

  // Robust JSON extraction
  try {
    // Try to find JSON within code blocks first
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) {
      text = match[1].trim();
    } else {
      // Look for the first '{' and last '}'
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start !== -1 && end !== -1) {
        text = text.substring(start, end + 1);
      }
    }
    return JSON.parse(text);
  } catch (e) {
    console.error("Failed to parse recommendations JSON:", text);
    throw new Error("Failed to parse AI recommendations");
  }
}

function renderRecommendations(recs) {
  currentRecs = Array.isArray(recs) ? recs : (recs.problems || []);
  currentTopics = Array.isArray(recs) ? [] : (recs.topics || []);
  currentRecIndex = 0;
  
  if (currentRecs.length > 3) {
    document.getElementById('reload-recs-btn').style.display = 'block';
  }

  renderRecommendationsState();
}

function renderRecommendationsState() {
  const container = document.getElementById('recommendations');
  const topicsContainer = document.getElementById('learn-next');

  // Grab 3 problems to show based on current index, wrapping around if needed
  let displayRecs = [];
  if (currentRecs.length > 0) {
    for (let i = 0; i < 3; i++) {
      displayRecs.push(currentRecs[(currentRecIndex + i) % currentRecs.length]);
    }
  }

  container.innerHTML = displayRecs.map((r, i) => `
    <div class="rec-card">
      <div class="rec-title"><span style="color:var(--text-muted); font-size:11px; font-weight:normal; margin-right:4px;">${r.id || ''}.</span>${r.title}</div>
      <div class="rec-meta">
        <span class="badge diff-${r.difficulty.toLowerCase()}">${r.difficulty}</span>
        <span class="topic-tag">${r.topic}</span>
        <div class="btn-group">
          <a href="https://leetcode.com/problems/${r.slug}/" target="_blank" class="start-btn">Start ↗</a>
          <button class="why-btn" data-why="prob-${i}">why →</button>
        </div>
      </div>
      <div class="why-box" id="why-prob-${i}">${r.why}</div>
    </div>`
  ).join('');

  topicsContainer.innerHTML = currentTopics.length ? currentTopics.map((t, i) => `
    <div class="rec-card" style="border-left-color: #f39c12;">
      <div class="rec-title" style="margin-bottom: 4px;">📘 ${t.name}</div>
      <div class="rec-meta">
        <button class="why-btn" data-why="topic-${i}">why →</button>
      </div>
      <div class="why-box" id="why-topic-${i}">${t.why}</div>
    </div>`
  ).join('') : '<div class="loading">No topic suggestions found.</div>';

  document.querySelectorAll('.why-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const box = document.getElementById(`why-${btn.dataset.why}`);
      if (box) box.classList.toggle('show');
    });
  });
}

async function renderHome(data) {
  if (!data || !data.userStats || !data.userStats.stats) {
    const container = document.getElementById('recommendations');
    const debugStr = data ? JSON.stringify(data).substring(0, 150) : "data is null";
    const errMsg = data?.userStats?.error ? data.userStats.error : "Missing stats. Debug: " + debugStr;
    if (container) {
      container.innerHTML = `
        <div class="error" style="margin-bottom:10px;">${errMsg}</div>
        <button id="retry-btn" class="btn-primary" style="width:100%">Retry Fetching Data</button>
      `;
      document.getElementById('retry-btn').addEventListener('click', () => {
        document.getElementById('retry-btn').textContent = 'Retrying...';
        chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
          if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'REFETCH_DATA' });
        });
      });
    }
    document.getElementById('topic-bars').innerHTML = '<div class="error">Failed to load topic stats.</div>';
    return;
  }
  
  const { userStats, currentProblem } = data;
  renderStats(userStats.stats);
  renderTopicBars(userStats.tags);

  try {
    const recs = await fetchRecommendations(userStats, currentProblem);
    renderRecommendations(recs);
  } catch (e) {
    console.error('LCPath: recommendation fetch failed', e);
    document.getElementById('recommendations').innerHTML =
      `<div class="error">Could not load recommendations.<br/><span style="font-size:10px; opacity:0.8">${e.message || e.toString()}</span></div>`;
  }
}


// ─── TAB SWITCHING ───

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab, .tab-content').forEach(el => el.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
  });
});
