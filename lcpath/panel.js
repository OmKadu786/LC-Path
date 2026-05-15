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
    if (!userData) {
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

  try {
    // Try session storage first (set by background.js)
    const session = await chrome.storage.session.get('lcpath_current_data');
    if (session.lcpath_current_data) {
      userData = session.lcpath_current_data;
      renderHome(userData);
      return;
    }
  } catch (e) {}

  // Try local cache
  const stored = await chrome.storage.local.get(['lcpath_user_stats', 'username']);
  if (stored.lcpath_user_stats) {
    userData = {
      userStats: stored.lcpath_user_stats,
      currentProblem: { title: null, tags: [], difficulty: 'Unknown' },
      currentCode: null,
      username: stored.username
    };
    renderHome(userData);
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

function renderTopicBars(tags) {
  const container = document.getElementById('topic-bars');

  if (!tags || tags.length === 0) {
    container.innerHTML = '<div class="loading" style="font-size:12px;">Not enough data yet — keep solving!</div>';
    return;
  }

  // We use the highest solved tag count to determine the 100% width of the bars
  const max = Math.max(...tags.map(t => t.problemsSolved), 1);

  // Take top 8 tags for the UI
  const displayTags = tags.slice(0, 8);

  container.innerHTML = displayTags.map(({ tagName, problemsSolved }) => {
    const pct = Math.round((problemsSolved / max) * 100);
    const cls = pct > 65 ? 'strong' : pct > 35 ? 'medium' : 'weak';
    return `
      <div class="bar-row">
        <span class="bar-label" title="${tagName}">${tagName.length > 12 ? tagName.substring(0, 10) + '..' : tagName}</span>
        <div class="bar-bg">
          <div class="bar-fill ${cls}" style="width:${pct}%"></div>
        </div>
        <span class="bar-pct">${problemsSolved}</span>
      </div>`;
  }).join('');
}


// ─── RECOMMENDATIONS (via DeepSeek) ───

async function fetchRecommendations(userStats, currentProblem) {
  const topTags = userStats.tags.slice(0, 5).map(t => t.tagName).join(', ');
  const recent = userStats.recent.slice(0, 10).join(', ');
  const prompt = `You are a LeetCode study coach. The user has solved ${userStats.stats.all} problems in their lifetime.
Their strongest topics are: ${topTags}.
They recently solved: ${recent}.
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

async function renderHome(data) {
  if (!data || !data.userStats || !data.userStats.stats) {
    const container = document.getElementById('recommendations');
    if (container) {
      container.innerHTML = '<div class="error">Data format error or LeetCode username not found. Please double check your username and refresh the LeetCode page.</div>';
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
