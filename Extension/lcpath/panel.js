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
      if (msg.payload.userStats === undefined) return;
      userData = msg.payload;
    } else {
      if (msg.payload.userStats) userData.userStats = msg.payload.userStats;
      if (msg.payload.currentProblem) userData.currentProblem = msg.payload.currentProblem;
      if (msg.payload.currentCode !== undefined) userData.currentCode = msg.payload.currentCode;
      if (msg.payload.submissionResult !== undefined) userData.submissionResult = msg.payload.submissionResult;
      if (msg.payload.username) userData.username = msg.payload.username;
    }
    renderHome(userData);
  }
});

// Request a fresh code snapshot from the content script
function requestFreshCode() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'FETCH_CODE' }).catch(() => {});
  });
}

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
          if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'REFETCH_DATA' }).catch(() => {});
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
let currentTopicIndex = 0;
let lastTopicsRefreshAt = 0; // solved count at last topic refresh

document.getElementById('reshuffle-recs-btn').addEventListener('click', () => {
  if (currentRecs.length > 0) {
    currentRecIndex = (currentRecIndex + 3) % currentRecs.length;
    renderRecommendationsState();
  }
});

document.getElementById('reshuffle-topics-btn').addEventListener('click', () => {
  if (currentTopics.length > 0) {
    currentTopicIndex = (currentTopicIndex + 2) % currentTopics.length;
    renderTopicsState();
  }
});

async function forceReloadAI(type = 'both') {
  if (!userData || !userData.userStats) return;
  const isProblems = (type === 'problems');
  const btnId = isProblems ? 'reload-recs-btn' : 'reload-topics-btn';
  const containerId = isProblems ? 'recommendations' : 'learn-next';
  
  const btn = document.getElementById(btnId);
  const container = document.getElementById(containerId);
  
  // Show visual loading state
  btn.classList.add('loading-spin');
  btn.style.pointerEvents = 'none';
  
  const prevHtml = container.innerHTML;
  
  if (isProblems) {
    container.innerHTML = '<div class="loading">🧠 AI is analyzing your history...<br><span style="font-size:10px; opacity:0.7">This may take a few seconds</span></div>';
  } else {
    container.innerHTML = '<div class="loading">Generating fresh topics...</div>';
  }
  
  try {
    const recs = await fetchRecommendations(userData.userStats, userData.currentProblem, type);
    
    const cacheData = await chrome.storage.local.get('lcpath_recs_cache');
    let mergedRecs = cacheData.lcpath_recs_cache?.recs || { problems: currentRecs, topics: currentTopics };
    
    if (isProblems) {
      mergedRecs.problems = recs.problems || [];
      renderRecommendations({ problems: mergedRecs.problems }, userData.userStats.allSolved || [], false);
    } else {
      mergedRecs.topics = recs.topics || [];
      currentTopics = mergedRecs.topics;
      currentTopicIndex = 0;
      if (currentTopics.length > 2) {
        document.getElementById('reshuffle-topics-btn').style.display = 'inline-block';
      }
      renderTopicsState();
    }
    
    // Save to cache
    await chrome.storage.local.set({
      lcpath_recs_cache: {
        solvedCount: userData.userStats.stats.all || 0,
        lastTopicsRefreshAt: userData.userStats.stats.all || 0,
        recs: mergedRecs
      }
    });
  } catch(e) {
    console.error('Failed to reload AI', e);
    container.innerHTML = prevHtml;
    alert("Failed to reach AI. Please try again.");
  }
  
  btn.classList.remove('loading-spin');
  btn.style.pointerEvents = 'auto';
}

document.getElementById('reload-recs-btn').addEventListener('click', () => forceReloadAI('problems'));
document.getElementById('reload-topics-btn').addEventListener('click', () => forceReloadAI('topics'));

async function fetchRecommendations(userStats, currentProblem, type = 'both') {
  const topTags = userStats.tags.slice(0, 5).map(t => t.tagName).join(', ');
  const solvedList = (userStats.allSolved && userStats.allSolved.length > 0) 
    ? userStats.allSolved.join(', ')
    : userStats.recent.slice(0, 15).join(', ');
    
  const solvedCount = userStats.stats.all || 0;
  let difficultyDistribution = "";
  if (solvedCount < 300) {
    difficultyDistribution = "CRITICAL: Since the user has less than 300 solved problems, your 12 recommendations MUST follow this exact distribution: At least 6 'Easy' problems, exactly 1 'Hard' problem, and the rest 'Medium'.";
  } else {
    difficultyDistribution = "Since the user has over 300 solved problems, make the difficulty of the 12 recommendations proportional to their experience, but you MUST include at least 1 'Hard' problem and several 'Medium' problems.";
  }

  let formatInstruction = "";
  if (type === 'problems') {
    formatInstruction = `Return a JSON object with exactly 12 problem recommendations (no topics). Example format:
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
  ]
}`;
  } else if (type === 'topics') {
    formatInstruction = `Return a JSON object with exactly 4 topic recommendations (no problems). Example format:
{
  "topics": [
    {
      "name": "Topic Name",
      "why": "one sentence reason why they should focus on this"
    }
  ]
}`;
  } else {
    formatInstruction = `Return a JSON object with exactly 12 problem recommendations and 4 topic recommendations. Example format:
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
}`;
  }

  const prompt = `You are a LeetCode study coach. The user has solved ${userStats.stats.all} problems in their lifetime.
Their strongest topics are: ${topTags}.
They have solved the following problems: ${solvedList}.
They are currently looking at: ${currentProblem?.title || 'unknown'} (${currentProblem?.tags?.join(', ') || 'no tags'}).

${formatInstruction}

Focus on filling their weakest topic gaps while building on what they know. Do NOT recommend any problem they have already solved. ${type !== 'topics' ? difficultyDistribution : ''}`;

  const res = await fetch('https://lc-path.onrender.com/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 3000
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

function renderRecommendations(recs, solvedList = [], isMerge = false) {
  const incomingProblems = Array.isArray(recs) ? recs : (recs.problems || []);

  // Normalise solved titles for fast lookup (lowercase, strip punctuation)
  const solvedSet = new Set(
    solvedList.map(t => t.toLowerCase().replace(/[^a-z0-9]/g, ''))
  );

  // Filter out problems the user has already solved
  const filtered = incomingProblems.filter(r => {
    const titleKey = (r.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const slugKey  = (r.slug  || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    return !solvedSet.has(titleKey) && !solvedSet.has(slugKey);
  });

  if (isMerge) {
    // Merge new recs into existing pool, avoid duplicates
    const existingSlugs = new Set(currentRecs.map(r => r.slug));
    const newRecs = filtered.filter(r => !existingSlugs.has(r.slug));
    currentRecs = [...currentRecs, ...newRecs];
  } else {
    currentRecs = filtered;
    currentRecIndex = 0;
  }

  if (!isMerge && recs.topics !== undefined) {
    currentTopics = Array.isArray(recs) ? [] : (recs.topics || []);
    currentTopicIndex = 0;
    if (currentTopics.length > 2) {
      document.getElementById('reshuffle-topics-btn').style.display = 'inline-block';
    }
  }

  if (currentRecs.length > 3) {
    document.getElementById('reshuffle-recs-btn').style.display = 'inline-block';
  }

  // Always show the AI reload buttons if we successfully got any recs
  document.getElementById('reload-recs-btn').style.display = 'inline-block';
  document.getElementById('reload-topics-btn').style.display = 'inline-block';

  renderRecommendationsState();
  if (!isMerge && recs.topics !== undefined) renderTopicsState();
}

function renderRecommendationsState() {
  const container = document.getElementById('recommendations');

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

  document.querySelectorAll('#recommendations .why-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const box = document.getElementById(`why-${btn.dataset.why}`);
      if (box) box.classList.toggle('show');
    });
  });
}

function renderTopicsState() {
  const topicsContainer = document.getElementById('learn-next');

  // Show 2 topics at a time, cycling through the full list
  let displayTopics = [];
  if (currentTopics.length > 0) {
    for (let i = 0; i < 2; i++) {
      displayTopics.push(currentTopics[(currentTopicIndex + i) % currentTopics.length]);
    }
  }

  topicsContainer.innerHTML = displayTopics.length ? displayTopics.map((t, i) => `
    <div class="rec-card" style="border-left-color: #f39c12;">
      <div class="rec-title" style="margin-bottom: 4px;">📘 ${t.name}</div>
      <div class="rec-meta">
        <button class="why-btn" data-why="topic-${i}">why →</button>
      </div>
      <div class="why-box" id="why-topic-${i}">${t.why}</div>
    </div>`
  ).join('') : '<div class="loading">No topic suggestions found.</div>';

  document.querySelectorAll('#learn-next .why-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const box = document.getElementById(`why-${btn.dataset.why}`);
      if (box) box.classList.toggle('show');
    });
  });
}

async function renderHome(data) {
  if (!data || !data.userStats || !data.userStats.stats) {
    const container = document.getElementById('recommendations');
    if (container) {
      if (data && data.userStats && data.userStats.error) {
        // Actual error from GraphQL
        container.innerHTML = `
          <div class="error" style="margin-bottom:10px;">${data.userStats.error}</div>
          <button id="retry-btn" class="btn-primary" style="width:100%">Retry Fetching Data</button>
        `;
        document.getElementById('retry-btn').addEventListener('click', () => {
          document.getElementById('retry-btn').textContent = 'Retrying...';
          chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
            if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'REFETCH_DATA' }).catch(() => {});
          });
        });
        document.getElementById('topic-bars').innerHTML = '<div class="error">Failed to load topic stats.</div>';
      } else {
        // Just loading/waiting for content script
        container.innerHTML = '<div class="loading">Syncing data from LeetCode...</div>';
        document.getElementById('topic-bars').innerHTML = '<div class="loading" style="padding:12px;">Waiting...</div>';
      }
    }
    return;
  }
  
  const { userStats, currentProblem } = data;
  renderStats(userStats.stats);
  renderTopicBars(userStats.tags);

  const solvedList = userStats.allSolved || [];
  const totalSolved = userStats.stats.all || 0;

  // If we already have a pool, re-filter it on each solve rather than full refetch
  if (currentRecs.length > 0) {
    const solvedSet = new Set(solvedList.map(t => t.toLowerCase().replace(/[^a-z0-9]/g, '')));
    currentRecs = currentRecs.filter(r => {
      const titleKey = (r.title || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      const slugKey  = (r.slug  || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      return !solvedSet.has(titleKey) && !solvedSet.has(slugKey);
    });
    renderRecommendationsState();

    // If pool is running low (< 4 left), silently fetch 20 more and merge in
    if (currentRecs.length < 4) {
      fetchRecommendations(userStats, currentProblem)
        .then(recs => renderRecommendations(recs, solvedList, true))
        .catch(() => {});
    }

    // Refresh Learn Next topics every 5 problems solved
    const solvedSinceTopicRefresh = totalSolved - lastTopicsRefreshAt;
    if (solvedSinceTopicRefresh >= 5) {
      fetchRecommendations(userStats, currentProblem)
        .then(recs => {
          const newTopics = Array.isArray(recs) ? [] : (recs.topics || []);
          if (newTopics.length > 0) {
            currentTopics = newTopics;
            currentTopicIndex = 0;
            lastTopicsRefreshAt = totalSolved;
            if (currentTopics.length > 2) {
              document.getElementById('reshuffle-topics-btn').style.display = 'inline-block';
            }
            renderTopicsState();

            // Update cache with new topics
            chrome.storage.local.set({
              lcpath_recs_cache: {
                solvedCount: totalSolved,
                lastTopicsRefreshAt: lastTopicsRefreshAt,
                recs: { problems: currentRecs, topics: currentTopics }
              }
            });
          }
        })
        .catch(() => {});
    }

    return;
  }

  try {
    // Check if we have cached recommendations for this exact solved count
    const cache = await chrome.storage.local.get(['lcpath_recs_cache']);
    if (cache.lcpath_recs_cache && cache.lcpath_recs_cache.solvedCount === totalSolved) {
      console.log('LCPath: Loaded recommendations from cache');
      lastTopicsRefreshAt = cache.lcpath_recs_cache.lastTopicsRefreshAt || 0;
      renderRecommendations(cache.lcpath_recs_cache.recs, solvedList);
      return;
    }

    const recs = await fetchRecommendations(userStats, currentProblem);
    lastTopicsRefreshAt = userStats.stats.all || 0;
    
    // Save to cache
    await chrome.storage.local.set({
      lcpath_recs_cache: {
        solvedCount: totalSolved,
        lastTopicsRefreshAt: lastTopicsRefreshAt,
        recs: recs
      }
    });

    renderRecommendations(recs, solvedList);
  } catch (e) {
    console.error('LCPath: recommendation fetch failed', e);
    const errorHtml = `<div class="error">Could not load recommendations.<br/><span style="font-size:10px; opacity:0.8">${e.message || e.toString()}</span></div>`;
    document.getElementById('recommendations').innerHTML = errorHtml;
    const learnNextContainer = document.getElementById('learn-next');
    if (learnNextContainer) {
      learnNextContainer.innerHTML = errorHtml;
    }
  }
}


// ─── TAB SWITCHING ───

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab, .tab-content').forEach(el => el.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');

    if (tab.dataset.tab === 'chat') {
      // Start polling for fresh code while on Chat tab
      if (typeof startCodePolling === 'function') startCodePolling();
    } else {
      // Stop polling when leaving Chat tab
      if (typeof stopCodePolling === 'function') stopCodePolling();
    }
  });
});
