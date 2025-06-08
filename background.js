// Background service worker for YouTube Guardian

// Handle extension installation/update
chrome.runtime.onInstalled.addListener((details) => {
    console.log('YouTube Guardian installed/updated');
    
    // Set up declarative content rules
    chrome.declarativeContent.onPageChanged.removeRules(undefined, () => {
        chrome.declarativeContent.onPageChanged.addRules([{
            conditions: [
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { hostEquals: 'www.youtube.com' }
                }),
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { hostEquals: 'youtube.com' }
                }),
                new chrome.declarativeContent.PageStateMatcher({
                    pageUrl: { hostEquals: 'youtu.be' }
                })
            ],
            actions: [new chrome.declarativeContent.ShowPageAction()]
        }]);
    });
});

// Handle tab updates to ensure content script is injected
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('youtube.com') || tab.url.includes('youtu.be')) {
            // Ensure content script is loaded
            chrome.scripting.executeScript({
                target: { tabId: tabId },
                files: ['content.js']
            }).catch(err => {
                // Content script might already be loaded
                console.log('Content script injection note:', err.message);
            });
        }
    }
});

// Listen for navigation within YouTube (SPA navigation)
chrome.webNavigation.onHistoryStateUpdated.addListener((details) => {
    if (details.url.includes('youtube.com/watch')) {
        // Send message to content script about navigation
        chrome.tabs.sendMessage(details.tabId, { 
            action: "navigationUpdate", 
            url: details.url 
        }).catch(err => {
            console.log('Navigation message failed:', err.message);
        });
    }
}, {
    url: [
        { hostContains: 'youtube.com' }
    ]
});

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === 'checkServerStatus') {
        // Check if Flask server is running
        fetch('http://127.0.0.1:5000/health')
            .then(response => response.json())
            .then(data => {
                sendResponse({ serverRunning: true, data: data });
            })
            .catch(error => {
                sendResponse({ serverRunning: false, error: error.message });
            });
        return true; // Will respond asynchronously
    }
    
    if (message.action === 'getApprovedVideos') {
        // Get list of approved videos
        chrome.storage.local.get(null, (items) => {
            const approvedVideos = {};
            for (const [key, value] of Object.entries(items)) {
                if (key.startsWith('approved_') && value === true) {
                    approvedVideos[key.replace('approved_', '')] = true;
                }
            }
            sendResponse({ approvedVideos });
        });
        return true;
    }
    
    if (message.action === 'clearApprovedVideos') {
        // Clear all approved videos (for testing/reset)
        chrome.storage.local.get(null, (items) => {
            const keysToRemove = Object.keys(items).filter(key => key.startsWith('approved_'));
            if (keysToRemove.length > 0) {
                chrome.storage.local.remove(keysToRemove, () => {
                    sendResponse({ cleared: keysToRemove.length });
                });
            } else {
                sendResponse({ cleared: 0 });
            }
        });
        return true;
    }
});

// Cleanup old storage entries periodically (keep only last 100 approved videos)
chrome.alarms.create('cleanupStorage', { 
    delayInMinutes: 60, 
    periodInMinutes: 60 * 24 // Daily cleanup
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'cleanupStorage') {
        chrome.storage.local.get(null, (items) => {
            const approvedEntries = Object.entries(items)
                .filter(([key, value]) => key.startsWith('approved_') && value === true)
                .sort(([a], [b]) => b.localeCompare(a)) // Sort by key (newest first)
                .slice(100); // Keep only first 100
            
            if (approvedEntries.length > 0) {
                const keysToRemove = approvedEntries.map(([key]) => key);
                chrome.storage.local.remove(keysToRemove);
                console.log(`Cleaned up ${keysToRemove.length} old approved video entries`);
            }
        });
    }
});

// Handle extension startup
chrome.runtime.onStartup.addListener(() => {
    console.log('YouTube Guardian service worker started');
});