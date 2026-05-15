// background.js — service worker for LCPath
// Handles: toolbar icon click → open side panel, relay messages

// When the user clicks the LCPath toolbar icon, open the side panel
chrome.action.onClicked.addListener(async (tab) => {
  try {
    await chrome.sidePanel.open({ tabId: tab.id });
  } catch (e) {
    console.error('LCPath: could not open side panel', e);
  }
});

// Enable side panel for all LeetCode tabs automatically
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
  .catch(e => console.error('LCPath: setPanelBehavior error', e));

// Relay messages from content script to the side panel
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'LCPATH_DATA') {
    // Store the data so the panel can retrieve it when it opens
    chrome.storage.session.set({ lcpath_current_data: message.payload });
  }

  if (message.type === 'OPEN_SIDE_PANEL') {
    // Triggered when user clicks the injected LCPath button on the page
    chrome.sidePanel.open({ tabId: sender.tab.id })
      .catch(e => console.error('LCPath: could not open side panel from button', e));
  }
});
