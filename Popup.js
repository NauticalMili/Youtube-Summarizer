// Model toggle functionality
const modelToggle = document.getElementById('model-toggle');
const modelIndicator = document.getElementById('model-indicator');
const apiSettings = document.getElementById('api-settings');
const lengthControl = document.getElementById('length-control');

let isApiMode = false;

modelToggle.addEventListener('click', function() {
    isApiMode = !isApiMode;
    
    if (isApiMode) {
        modelToggle.classList.add('active');
        modelIndicator.textContent = 'API Mode';
        apiSettings.classList.add('show');
        lengthControl.style.display = 'none';
    } else {
        modelToggle.classList.remove('active');
        modelIndicator.textContent = 'Local Model';
        apiSettings.classList.remove('show');
        lengthControl.style.display = 'flex';
    }
});

// Summarization functionality
const btn = document.getElementById("summarize");
const p = document.getElementById("output");
const summaryContainer = document.getElementById("summary");
const loadingDiv = document.getElementById("loading");

// Add status display elements
function updateVideoStatus(status, videoId) {
    const statusDiv = document.getElementById("video-status") || createStatusDiv();
    const isBlocked = status === "blocked";
    
    statusDiv.innerHTML = `
        <div class="status-indicator ${isBlocked ? 'blocked' : 'approved'}">
            <span class="status-icon">${isBlocked ? '🔒' : '✅'}</span>
            <span class="status-text">${isBlocked ? 'Video Blocked' : 'Video Approved'}</span>
        </div>
        <div class="video-id">Video ID: ${videoId || 'Unknown'}</div>
    `;
}

function createStatusDiv() {
    const statusDiv = document.createElement('div');
    statusDiv.id = 'video-status';
    statusDiv.style.cssText = `
        margin-bottom: 15px;
        padding: 10px;
        border-radius: 8px;
        background: #f5f5f5;
        font-size: 12px;
    `;
    
    // Insert before the summarize button
    const container = btn.parentElement;
    container.insertBefore(statusDiv, btn);
    
    return statusDiv;
}

// Check current video status on popup load
chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
    if (tabs[0] && (tabs[0].url.includes('youtube.com/watch') || tabs[0].url.includes('youtu.be/'))) {
        chrome.tabs.sendMessage(tabs[0].id, { action: "getVideoStatus" }, function(response) {
            if (chrome.runtime.lastError) {
                console.log('Content script not responding:', chrome.runtime.lastError.message);
                return;
            }
            
            if (response) {
                updateVideoStatus(response.isBlocked ? "blocked" : "approved", response.videoId);
            }
        });
    }
});

btn.addEventListener("click", function() {
    // Reset UI
    p.innerHTML = "";
    summaryContainer.classList.remove('show');
    loadingDiv.style.display = 'block';
    btn.disabled = true;
    btn.innerHTML = "Analyzing...";

    // Check if we're in API mode
    if (isApiMode) {
        p.innerHTML = "API mode is not yet supported.";
        summaryContainer.classList.add('show');
        loadingDiv.style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = "Check Video";
        return;
    }

    chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
        const url = tabs[0].url;
        
        // Check if we're on a YouTube page
        if (!url.includes('youtube.com/watch') && !url.includes('youtu.be/')) {
            p.innerHTML = "Please navigate to a YouTube video page.";
            summaryContainer.classList.add('show');
            loadingDiv.style.display = 'none';
            btn.disabled = false;
            btn.innerHTML = "Check Video";
            return;
        }

        const maxLength = document.getElementById("max_length")?.value || 150;
        const requestUrl = `http://127.0.0.1:5000/summary?url=${encodeURIComponent(url)}&max_length=${maxLength}`;
        
        console.log('Making request to:', requestUrl);

        const xhr = new XMLHttpRequest();
        xhr.open("GET", requestUrl, true);
        
        // Set timeout
        xhr.timeout = 60000; // 60 seconds for longer videos

        xhr.onload = function() {
            loadingDiv.style.display = 'none';
            
            try {
                const response = JSON.parse(xhr.responseText);
                console.log('Response:', response);
                
                if (response.summary) {
                    p.innerHTML = response.summary;
                    
                    // Handle approval/blocking logic
                    if (response.status === "allowed") {
                        p.innerHTML += "<br><br><div style='background: #e8f5e8; color: #2d5a2d; padding: 12px; border-radius: 8px; font-weight: bold; border-left: 4px solid #4CAF50;'>Content approved for viewing</div>";
                        
                        // Update status display
                        updateVideoStatus("approved", extractVideoId(url));
                        
                        // Send message to content script to unblock video
                        chrome.tabs.sendMessage(tabs[0].id, { action: "unblockVideo" }, function(response) {
                            if (chrome.runtime.lastError) {
                                console.log('Content script not responding:', chrome.runtime.lastError.message);
                            } else {
                                console.log('Video unblocked successfully');
                            }
                        });
                        
                        btn.innerHTML = "Video Approved";
                        btn.style.background = '#4CAF50';
                        btn.style.color = 'white';
                        
                    } else {
                        p.innerHTML += "<br><br><div style='background: #ffeaea; color: #722c2c; padding: 12px; border-radius: 8px; font-weight: bold; border-left: 4px solid #ff4444;'>Content blocked - not suitable for children</div>";
                        
                        // Update status display
                        updateVideoStatus("blocked", extractVideoId(url));
                        
                        // Ensure video remains blocked
                        chrome.tabs.sendMessage(tabs[0].id, { action: "blockVideo" }, function(response) {
                            if (chrome.runtime.lastError) {
                                console.log('Content script not responding:', chrome.runtime.lastError.message);
                            }
                        });
                        
                        btn.innerHTML = "🔒 Video Blocked";
                        btn.style.background = '#ff4444';
                        btn.style.color = 'white';
                    }
                } else if (response.error) {
                    p.innerHTML = `<div style='background: #fff3cd; color: #856404; padding: 12px; border-radius: 8px; border-left: 4px solid #ffc107;'>⚠️ Error: ${response.error}</div>`;
                    updateVideoStatus("blocked", extractVideoId(url));
                    btn.innerHTML = "Analysis Failed";
                    btn.style.background = '#ffc107';
                    btn.style.color = '#212529';
                } else {
                    p.innerHTML = "<div style='background: #fff3cd; color: #856404; padding: 12px; border-radius: 8px; border-left: 4px solid #ffc107;'>⚠️ No summary available.</div>";
                    updateVideoStatus("blocked", extractVideoId(url));
                }
                
                summaryContainer.classList.add('show');
                
            } catch (e) {
                console.error('Failed to parse response:', e);
                p.innerHTML = "<div style='background: #ffeaea; color: #722c2c; padding: 12px; border-radius: 8px; border-left: 4px solid #ff4444;'>❌ Failed to parse server response.</div>";
                summaryContainer.classList.add('show');
                updateVideoStatus("blocked", extractVideoId(url));
                btn.innerHTML = "Analysis Failed";
                btn.style.background = '#ff4444';
                btn.style.color = 'white';
            }
            
            btn.disabled = false;
        };

        xhr.onerror = function() {
            loadingDiv.style.display = 'none';
            p.innerHTML = "<div style='background: #ffeaea; color: #722c2c; padding: 12px; border-radius: 8px; border-left: 4px solid #ff4444;'>❌ Failed to connect to the local server.<br><small>Make sure the Flask server is running on http://127.0.0.1:5000</small></div>";
            summaryContainer.classList.add('show');
            updateVideoStatus("blocked", extractVideoId(url));
            btn.disabled = false;
            btn.innerHTML = "🔌 Server Error";
            btn.style.background = '#ff4444';
            btn.style.color = 'white';
        };

        xhr.ontimeout = function() {
            loadingDiv.style.display = 'none';
            p.innerHTML = "<div style='background: #fff3cd; color: #856404; padding: 12px; border-radius: 8px; border-left: 4px solid #ffc107;'>⏱️ Request timed out.<br><small>The video might be too long to process.</small></div>";
            summaryContainer.classList.add('show');
            updateVideoStatus("blocked", extractVideoId(url));
            btn.disabled = false;
            btn.innerHTML = "Timeout";
            btn.style.background = '#ffc107';
            btn.style.color = '#212529';
        };

        xhr.send();
    });
});

// Helper function to extract video ID
function extractVideoId(url) {
    const patterns = [
        /[?&]v=([^&]+)/,
        /youtu\.be\/([^?]+)/,
        /embed\/([^?]+)/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// Add manual unblock button for testing/overrides
function addManualControls() {
    const controlsDiv = document.createElement('div');
    controlsDiv.style.cssText = `
        margin-top: 10px;
        padding: 10px;
        background: #f8f9fa;
        border-radius: 8px;
        display: none;
    `;
    controlsDiv.id = 'manual-controls';
    
    const unblockBtn = document.createElement('button');
    unblockBtn.textContent = 'Force Unblock';
    unblockBtn.style.cssText = `
        background: #28a745;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        margin-right: 10px;
        cursor: pointer;
    `;
    
    const blockBtn = document.createElement('button');
    blockBtn.textContent = 'Force Block';
    blockBtn.style.cssText = `
        background: #dc3545;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 4px;
        cursor: pointer;
    `;
    
    unblockBtn.addEventListener('click', () => {
        chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "unblockVideo" });
            updateVideoStatus("approved", extractVideoId(tabs[0].url));
        });
    });
    
    blockBtn.addEventListener('click', () => {
        chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "blockVideo" });
            updateVideoStatus("blocked", extractVideoId(tabs[0].url));
        });
    });
    
    controlsDiv.appendChild(unblockBtn);
    controlsDiv.appendChild(blockBtn);
    
    // Add toggle for manual controls
    const toggleBtn = document.createElement('button');
    toggleBtn.textContent = 'Show Manual Controls';
    toggleBtn.style.cssText = `
        background: #6c757d;
        color: white;
        border: none;
        padding: 6px 12px;
        border-radius: 4px;
        font-size: 11px;
        margin-top: 10px;
        cursor: pointer;
    `;
    
    toggleBtn.addEventListener('click', () => {
        const isVisible = controlsDiv.style.display !== 'none';
        controlsDiv.style.display = isVisible ? 'none' : 'block';
        toggleBtn.textContent = isVisible ? 'Show Manual Controls' : 'Hide Manual Controls';
    });
    
    summaryContainer.appendChild(toggleBtn);
    summaryContainer.appendChild(controlsDiv);
}

// Initialize manual controls
document.addEventListener('DOMContentLoaded', addManualControls);