// panel.js — Home tab: stats, topic bars, recommendations, setup, tabs

let userData = null;

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
    if (msg.payload.solved && msg.payload.solved.length > 0) {
      userData = msg.payload;
    } else if (msg.payload.currentProblem) {
      // Partial update (SPA navigation)
      if (userData) {
        userData.currentProblem = msg.payload.currentProblem;
        userData.currentCode = msg.payload.currentCode;
      }
    }
    if (userData) {
      renderHome(userData);
    }
  }
});

// Also try to load cached data on panel open
async function loadCachedData() {
  const ready = await checkSetup();
  if (!ready) return;

  try {
    // Try session storage first (set by background.js)
    const session = await chrome.storage.session.get('lcpath_current_data');
    if (session.lcpath_current_data) {
      userData = session.lcpath_current_data;
      renderHome(userData);
      return;
    }
  } catch (e) {
    // session storage might not be available
  }

  // Try local cache
  const stored = await chrome.storage.local.get(['lcpath_solved_cache', 'username']);
  if (stored.lcpath_solved_cache) {
    userData = {
      solved: stored.lcpath_solved_cache,
      currentProblem: { title: null, tags: [], difficulty: 'Unknown' },
      currentCode: null,
      username: stored.username
    };
    renderHome(userData);
  }
}

loadCachedData();


// ─── RENDER STATS ───

function renderStats(solved) {
  const easy = solved.filter(p => p.difficulty === 'Easy').length;
  const med = solved.filter(p => p.difficulty === 'Medium').length;

  document.getElementById('solved-count').textContent = `${solved.length} solved`;
  document.getElementById('stat-solved').textContent = solved.length;
  document.getElementById('stat-streak').textContent = '—'; // Would need submission dates to compute
  document.getElementById('stat-ratio').textContent = easy > 0 || med > 0
    ? `${Math.round((easy + med) / Math.max(solved.length, 1) * 100)}%`
    : '—';
}


// ─── TOPIC STRENGTH ───

// Map of popular LeetCode problems → topic tags
// In production, this would be fetched from a more complete source
const TOPIC_MAP = {
  'two-sum': ['Array', 'Hash Table'],
  'valid-anagram': ['Hash Table', 'String'],
  'binary-search': ['Binary Search'],
  'best-time-to-buy-and-sell-stock': ['Array', 'DP'],
  'maximum-subarray': ['Array', 'DP'],
  'merge-two-sorted-lists': ['Linked List'],
  'valid-parentheses': ['Stack', 'String'],
  'climbing-stairs': ['DP'],
  'invert-binary-tree': ['Tree', 'BFS'],
  'linked-list-cycle': ['Linked List', 'Two Pointers'],
  'reverse-linked-list': ['Linked List'],
  'contains-duplicate': ['Array', 'Hash Table'],
  'product-of-array-except-self': ['Array'],
  'maximum-depth-of-binary-tree': ['Tree', 'BFS'],
  'same-tree': ['Tree'],
  'subtree-of-another-tree': ['Tree'],
  'lowest-common-ancestor-of-a-binary-search-tree': ['Tree'],
  'balanced-binary-tree': ['Tree'],
  'coin-change': ['DP'],
  'number-of-islands': ['Graph', 'BFS'],
  'course-schedule': ['Graph', 'Topological Sort'],
  'implement-trie-prefix-tree': ['Trie'],
  'word-search': ['Backtracking'],
  'group-anagrams': ['Hash Table', 'String'],
  'top-k-frequent-elements': ['Hash Table', 'Heap'],
  'encode-and-decode-strings': ['String'],
  'longest-substring-without-repeating-characters': ['Sliding Window', 'Hash Table'],
  'longest-repeating-character-replacement': ['Sliding Window'],
  'minimum-window-substring': ['Sliding Window'],
  'container-with-most-water': ['Two Pointers'],
  '3sum': ['Two Pointers', 'Array'],
  'trapping-rain-water': ['Two Pointers', 'Stack'],
  'merge-intervals': ['Array', 'Sorting'],
  'insert-interval': ['Array'],
  'non-overlapping-intervals': ['DP', 'Greedy'],
  'meeting-rooms': ['Array', 'Sorting'],
  'rotate-image': ['Array', 'Matrix'],
  'spiral-matrix': ['Array', 'Matrix'],
  'set-matrix-zeroes': ['Array', 'Matrix'],
  'house-robber': ['DP'],
  'house-robber-ii': ['DP'],
  'unique-paths': ['DP'],
  'jump-game': ['DP', 'Greedy'],
  'decode-ways': ['DP', 'String'],
  'combination-sum': ['Backtracking'],
  'permutations': ['Backtracking'],
  'subsets': ['Backtracking'],
  'word-break': ['DP'],
  'longest-increasing-subsequence': ['DP', 'Binary Search'],
  'pacific-atlantic-water-flow': ['Graph', 'BFS'],
  'clone-graph': ['Graph', 'BFS'],
  'design-add-and-search-words-data-structure': ['Trie'],
  'kth-smallest-element-in-a-bst': ['Tree', 'Binary Search'],
  'construct-binary-tree-from-preorder-and-inorder-traversal': ['Tree'],
  'binary-tree-level-order-traversal': ['Tree', 'BFS'],
  'validate-binary-search-tree': ['Tree'],
  'serialize-and-deserialize-binary-tree': ['Tree'],
  'find-median-from-data-stream': ['Heap'],
  'merge-k-sorted-lists': ['Linked List', 'Heap'],
  'remove-nth-node-from-end-of-list': ['Linked List', 'Two Pointers'],
  'reorder-list': ['Linked List'],
};

function computeTopicStrength(solved) {
  const counts = {};
  solved.forEach(p => {
    const tags = TOPIC_MAP[p.slug] || [];
    tags.forEach(tag => { counts[tag] = (counts[tag] || 0) + 1; });
  });
  const max = Math.max(...Object.values(counts), 1);
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([topic, count]) => ({ topic, pct: Math.round((count / max) * 100) }));
}

function renderTopicBars(solved) {
  const topics = computeTopicStrength(solved);
  const container = document.getElementById('topic-bars');

  if (topics.length === 0) {
    container.innerHTML = '<div class="loading" style="font-size:12px;">Not enough data yet — keep solving!</div>';
    return;
  }

  container.innerHTML = topics.map(({ topic, pct }) => {
    const cls = pct > 65 ? 'strong' : pct > 35 ? 'medium' : 'weak';
    return `
      <div class="bar-row">
        <span class="bar-label">${topic}</span>
        <div class="bar-bg">
          <div class="bar-fill ${cls}" style="width:${pct}%"></div>
        </div>
        <span class="bar-pct">${pct}%</span>
      </div>`;
  }).join('');
}


// ─── RECOMMENDATIONS (via DeepSeek) ───

async function fetchRecommendations(solved, currentProblem) {
  const solvedTitles = solved.map(p => p.title).join(', ');
  const prompt = `You are a LeetCode study coach. The user has solved these problems: ${solvedTitles}.
They are currently looking at: ${currentProblem?.title || 'unknown'} (${currentProblem?.tags?.join(', ') || 'no tags'}).

Return exactly 3 next problem recommendations as JSON (no markdown fences, just the JSON array):
[
  {
    "title": "Problem Name",
    "difficulty": "Easy|Medium|Hard",
    "topic": "main topic tag",
    "why": "one sentence reason based on their history"
  }
]
Focus on filling their weakest topic gaps while building on what they know.`;

  const res = await fetch('http://localhost:3000/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 400
    })
  });

  const data = await res.json();
  let text = data.choices[0].message.content.trim();

  // Strip markdown code fences if present
  text = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

  return JSON.parse(text);
}

function renderRecommendations(recs) {
  const container = document.getElementById('recommendations');
  container.innerHTML = recs.map((r, i) => `
    <div class="rec-card">
      <div class="rec-title">${r.title}</div>
      <div class="rec-meta">
        <span class="badge diff-${r.difficulty.toLowerCase()}">${r.difficulty}</span>
        <span class="topic-tag">${r.topic}</span>
        <button class="why-btn" data-why="${i}">why →</button>
      </div>
      <div class="why-box" id="why-${i}">${r.why}</div>
    </div>`
  ).join('');

  container.querySelectorAll('.why-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const box = document.getElementById(`why-${btn.dataset.why}`);
      box.classList.toggle('show');
    });
  });
}

async function renderHome({ solved, currentProblem }) {
  renderStats(solved);
  renderTopicBars(solved);

  try {
    const recs = await fetchRecommendations(solved, currentProblem);
    renderRecommendations(recs);
  } catch (e) {
    console.error('LCPath: recommendation fetch failed', e);
    document.getElementById('recommendations').innerHTML =
      '<div class="error">Could not load recommendations. Is your backend server running?</div>';
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
