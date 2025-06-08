// Model toggle functionality
const modelToggle = document.getElementById('model-toggle');
const modelIndicator = document.getElementById('model-indicator');
const apiSettings = document.getElementById('api-settings');
const localModels = document.getElementById('local-models');

let isApiMode = false;

modelToggle.addEventListener('click', function() {
    isApiMode = !isApiMode;
    
    if (isApiMode) {
        modelToggle.classList.add('active');
        modelIndicator.textContent = 'API Mode';
        apiSettings.classList.add('show');
        localModels.style.display = 'none';
    } else {
        modelToggle.classList.remove('active');
        modelIndicator.textContent = 'Local Model';
        apiSettings.classList.remove('show');
        localModels.style.display = 'flex';
    }
});

// Local model selection
const modelOptions = document.querySelectorAll('.model-option');
const lengthControl = document.getElementById('length-control');

modelOptions.forEach(option => {
    option.addEventListener('click', function() {
        modelOptions.forEach(opt => opt.classList.remove('active'));
        this.classList.add('active');
        
        const selectedModel = this.getAttribute('data-model');
        // Show/hide length control based on selected model
        if (selectedModel === 'LSA') {
            lengthControl.style.display = 'flex';
        } else {
            lengthControl.style.display = 'none';
        }
    });
});

// Summarization functionality
const btn = document.getElementById("summarize");
const p = document.getElementById("output");
const summaryContainer = document.getElementById("summary"); // Add reference to summary container

btn.addEventListener("click", function() {
    p.innerHTML = "";
    summaryContainer.classList.remove('show'); // Hide summary container initially
    btn.disabled = true;
    btn.innerHTML = "Summarizing...";

    // Get selected model
    const activeModelElement = document.querySelector('.model-option.active');
    const selectedModel = activeModelElement ? activeModelElement.getAttribute('data-model') : 'LSA';

    // Only proceed if model is LSA
    if (selectedModel !== 'LSA') {
        p.innerHTML = "This model is not yet supported.";
        summaryContainer.classList.add('show'); // Show summary container for error message
        btn.disabled = false;
        btn.innerHTML = "Summarize";
        return;
    }

    chrome.tabs.query({ currentWindow: true, active: true }, function(tabs) {
        const url = tabs[0].url;
        const maxLength = document.getElementById("max_length").value || 150;

        const xhr = new XMLHttpRequest();
        xhr.open("GET", "http://127.0.0.1:5000/summary?url=" + encodeURIComponent(url) + "&max_length=" + maxLength, true);

        xhr.onload = function() {
            if (xhr.status === 200) {
                try {
                    const response = JSON.parse(xhr.responseText);
                    p.innerHTML = response.summary || "No summary found.";
                    summaryContainer.classList.add('show'); // Show summary container on success
                } catch (e) {
                    p.innerHTML = "Failed to parse response.";
                    summaryContainer.classList.add('show'); // Show summary container for error
                }
            } else if (xhr.status === 404) {
                p.innerHTML = "No subtitles available for this video";
                summaryContainer.classList.add('show'); // Show summary container for 404 error
            } else {
                p.innerHTML = "Error: " + xhr.status;
                summaryContainer.classList.add('show'); // Show summary container for other errors
            }
            btn.disabled = false;
            btn.innerHTML = "Summarize";
        };

        xhr.onerror = function() {
            p.innerHTML = "Request failed.";
            summaryContainer.classList.add('show'); // Show summary container for request error
            btn.disabled = false;
            btn.innerHTML = "Summarize";
        };

        xhr.send();
    });
});