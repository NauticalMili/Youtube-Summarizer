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

btn.addEventListener("click", function() {
    // Reset UI
    p.innerHTML = "";
    summaryContainer.classList.remove('show');
    loadingDiv.style.display = 'block';
    btn.disabled = true;
    btn.innerHTML = "Summarizing...";

    // Check if we're in API mode
    if (isApiMode) {
        p.innerHTML = "API mode is not yet supported.";
        summaryContainer.classList.add('show');
        loadingDiv.style.display = 'none';
        btn.disabled = false;
        btn.innerHTML = "Summarize";
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
            btn.innerHTML = "Summarize";
            return;
        }

        const maxLength = document.getElementById("max_length").value || 150;
        const requestUrl = `http://127.0.0.1:5000/summary?url=${encodeURIComponent(url)}&max_length=${maxLength}`;
        
        console.log('Making request to:', requestUrl);

        const xhr = new XMLHttpRequest();
        xhr.open("GET", requestUrl, true);
        
        // Set timeout
        xhr.timeout = 30000; // 30 seconds

        xhr.onload = function() {
            loadingDiv.style.display = 'none';
            
            try {
                const response = JSON.parse(xhr.responseText);
                console.log('Response:', response);
                
                if (response.summary) {
                    p.innerHTML = response.summary;
                    
                    // Add status information
                    if (response.status === "allowed") {
                        p.innerHTML += "<br><br><span style='color: #4CAF50; font-weight: bold;'>Content approved for viewing</span>";
                        // Send message to content script to unblock video
                        chrome.tabs.sendMessage(tabs[0].id, { action: "unblockVideo" }, function(response) {
                            if (chrome.runtime.lastError) {
                                console.log('Content script not responding:', chrome.runtime.lastError.message);
                            }
                        });
                    } else {
                        p.innerHTML += "<br><br><span style='color: #ff4444; font-weight: bold;'>Content blocked - not suitable for children</span>";
                    }
                } else if (response.error) {
                    p.innerHTML = `Error: ${response.error}`;
                } else {
                    p.innerHTML = "No summary available.";
                }
                
                summaryContainer.classList.add('show');
                
            } catch (e) {
                console.error('Failed to parse response:', e);
                p.innerHTML = "Failed to parse server response.";
                summaryContainer.classList.add('show');
            }
            
            btn.disabled = false;
            btn.innerHTML = "Summarize";
        };

        xhr.onerror = function() {
            loadingDiv.style.display = 'none';
            p.innerHTML = "Failed to connect to the local server. Make sure the Flask server is running on http://127.0.0.1:5000";
            summaryContainer.classList.add('show');
            btn.disabled = false;
            btn.innerHTML = "Summarize";
        };

        xhr.ontimeout = function() {
            loadingDiv.style.display = 'none';
            p.innerHTML = "Request timed out. The video might be too long to process.";
            summaryContainer.classList.add('show');
            btn.disabled = false;
            btn.innerHTML = "Summarize";
        };

        xhr.send();
    });
});