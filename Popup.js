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

// Simple markdown to HTML converter
function markdownToHtml(markdown) {
    let html = markdown;
    
    // Convert headers (### -> <h3>, ## -> <h2>, # -> <h1>)
    html = html.replace(/^### (.*$)/gm, '<h3 style="color: #ff4444; font-size: 16px; margin: 15px 0 10px 0; font-weight: 600;">$1</h3>');
    html = html.replace(/^## (.*$)/gm, '<h2 style="color: #ff4444; font-size: 18px; margin: 15px 0 10px 0; font-weight: 600;">$1</h2>');
    html = html.replace(/^# (.*$)/gm, '<h1 style="color: #ff4444; font-size: 20px; margin: 15px 0 10px 0; font-weight: 600;">$1</h1>');
    
    // Convert bold text (**text** -> <strong>text</strong>)
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong style="color: #ffffff; font-weight: 600;">$1</strong>');
    
    // Convert italic text (*text* -> <em>text</em>)
    html = html.replace(/\*(.*?)\*/g, '<em style="color: #cccccc; font-style: italic;">$1</em>');
    
    // Convert code blocks (```code``` -> <pre><code>code</code></pre>)
    html = html.replace(/```(.*?)```/gs, '<pre style="background: rgba(255,255,255,0.1); padding: 10px; border-radius: 6px; margin: 8px 0; overflow-x: auto; font-family: monospace; font-size: 12px; border-left: 3px solid #ff4444;"><code>$1</code></pre>');
    
    // Convert inline code (`code` -> <code>code</code>)
    html = html.replace(/`([^`]+)`/g, '<code style="background: rgba(255,255,255,0.15); padding: 2px 6px; border-radius: 3px; font-family: monospace; font-size: 12px; color: #ff6666;">$1</code>');
    
    // Convert bullet points (- item -> <li>item</li>)
    html = html.replace(/^- (.*$)/gm, '<li style="margin: 5px 0; list-style: none; position: relative; padding-left: 20px;">$1</li>');
    html = html.replace(/(<li[^>]*>.*<\/li>)/s, '<ul style="margin: 10px 0; padding: 0;">$1</ul>');
    
    // Add bullet points manually
    html = html.replace(/<li([^>]*)>/g, '<li$1><span style="color: #ff4444; position: absolute; left: 0;">•</span>');
    
    // Convert numbered lists (1. item -> <ol><li>item</li></ol>)
    html = html.replace(/^\d+\. (.*$)/gm, '<li style="margin: 5px 0; padding-left: 5px;">$1</li>');
    
    // Convert line breaks to <br>
    html = html.replace(/\n/g, '<br>');
    
    // Clean up multiple <br> tags
    html = html.replace(/<br><br>/g, '<br>');
    
    return html;
}

// Alternative: Simple text formatting without full markdown
function formatText(text) {
    let formatted = text;
    
    // Convert headers to styled text
    formatted = formatted.replace(/^### (.*$)/gm, '<div style="color: #ff4444; font-size: 16px; font-weight: 600; margin: 15px 0 8px 0; border-bottom: 1px solid rgba(255,68,68,0.3); padding-bottom: 4px;">$1</div>');
    formatted = formatted.replace(/^## (.*$)/gm, '<div style="color: #ff4444; font-size: 18px; font-weight: 600; margin: 15px 0 8px 0; border-bottom: 1px solid rgba(255,68,68,0.3); padding-bottom: 4px;">$1</div>');
    formatted = formatted.replace(/^# (.*$)/gm, '<div style="color: #ff4444; font-size: 20px; font-weight: 600; margin: 15px 0 8px 0; border-bottom: 1px solid rgba(255,68,68,0.3); padding-bottom: 4px;">$1</div>');
    
    // Convert bold and italic
    formatted = formatted.replace(/\*\*(.*?)\*\*/g, '<span style="font-weight: 600; color: #ffffff;">$1</span>');
    formatted = formatted.replace(/\*(.*?)\*/g, '<span style="font-style: italic; color: #cccccc;">$1</span>');
    
    // Convert simple lists
    formatted = formatted.replace(/^- (.*$)/gm, '<div style="margin: 4px 0; padding-left: 15px; position: relative;"><span style="color: #ff4444; position: absolute; left: 0;">•</span>$1</div>');
    
    // Convert line breaks
    formatted = formatted.replace(/\n/g, '<br>');
    
    return formatted;
}

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
        const model = document.getElementById("model-name").value.trim();
        const apiKey = document.getElementById("api-key").value.trim();
        const proxyUrl = document.getElementById("proxy-url").value.trim();
    
        if (!model || !apiKey || !proxyUrl) {
            p.innerHTML = "Please fill in all API fields.";
            summaryContainer.classList.add('show');
            loadingDiv.style.display = 'none';
            btn.disabled = false;
            btn.innerHTML = "Check Video";
            return;
        }
    
        chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
            const url = tabs[0].url;
    
            if (!url.includes('youtube.com/watch') && !url.includes('youtu.be/')) {
                p.innerHTML = "Please navigate to a YouTube video page.";
                summaryContainer.classList.add('show');
                loadingDiv.style.display = 'none';
                btn.disabled = false;
                btn.innerHTML = "Check Video";
                return;
            }
    
            // First, get the transcript from your local server
            const transcriptUrl = `http://127.0.0.1:5000/transcript?url=${encodeURIComponent(url)}`;
            
            fetch(transcriptUrl)
                .then(response => response.json())
                .then(transcriptData => {
                    if (!transcriptData.transcript) {
                        throw new Error(transcriptData.error || "No transcript available");
                    }
    
                    // Now send the transcript to the Chutes.ai API
                    const userPrompt = `Please analyze this YouTube video transcript and provide a summary. Also determine if the content is appropriate for children. Here is the transcript: ${transcriptData.transcript}`;
    
                    return fetch(proxyUrl, {
                        method: "POST",
                        headers: {
                            "Authorization": `Bearer ${apiKey}`,
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            model: model,
                            messages: [
                                { role: "system", content: "You are a helpful assistant that analyzes YouTube video content. Determine if content is appropriate for children and provide a summary." },
                                { role: "user", content: userPrompt }
                            ],
                            temperature: 0.7,
                            max_tokens: 32000
                        })
                    });
                })
                .then(async (response) => {
                    loadingDiv.style.display = 'none';
                    if (!response.ok) {
                        const err = await response.json();
                        throw new Error(err.detail || "API error");
                    }
                    return response.json();
                })
                .then((data) => {
                    const result = data.choices?.[0]?.message?.content || "No summary received.";
                    
                    // Apply markdown formatting to the result
                    p.innerHTML = markdownToHtml(result);
                    
                    summaryContainer.classList.add('show');
                    
                    // You might want to parse the API response to determine if it's kid-safe
                    // For now, assuming approved since external API handled it
                    updateVideoStatus("approved", extractVideoId(url));
                    btn.innerHTML = "Check Video";
                })
                .catch((err) => {
                    p.innerHTML = `<div style='background: #ffeaea; color: #722c2c; padding: 12px; border-radius: 8px; border-left: 4px solid #ff4444;'>❌ ${err.message}</div>`;
                    summaryContainer.classList.add('show');
                    updateVideoStatus("blocked", extractVideoId(url));
                    btn.innerHTML = "Check Video";
                })
                .finally(() => {
                    btn.disabled = false;
                });
        });
    
        return; // Important to prevent fallback to local mode
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
                    // Apply formatting to the summary
                    p.innerHTML = formatText(response.summary);
                    
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
                        
                        btn.innerHTML = "Video Blocked";
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
document.addEventListener('DOMContentLoaded', function () {
    const dashboardLink = document.getElementById('open-dashboard');
    
    dashboardLink.addEventListener('click', function (e) {
        e.preventDefault(); // Stop default anchor behavior

        // Open your sticky/persistent dashboard window
        window.open(
            chrome.runtime.getURL("temp.html"), // or "app.html" if you renamed it
            "yt_guardian_dashboard", // reuse window name to avoid duplicates
            "width=500,height=600,resizable=yes"
        );

        // Close the current extension popup window
        window.close();
    });
});

// Initialize manual controls
document.addEventListener('DOMContentLoaded', addManualControls);