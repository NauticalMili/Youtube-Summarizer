(function() {
    let isVideoBlocked = true;
    let blocker = null;
    let currentVideoId = null;
    let checkInterval = null;

    // Create the blocking overlay
    function createBlocker() {
        if (blocker) return;
        
        blocker = document.createElement("div");
        blocker.id = "youtube-guardian-blocker";
        blocker.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100vw;
            height: 100vh;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            z-index: 999999;
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            color: white;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            text-align: center;
            padding: 20px;
            box-sizing: border-box;
        `;

        const icon = document.createElement("div");
        icon.innerHTML = "🛡️";
        icon.style.fontSize = "64px";
        icon.style.marginBottom = "20px";

        const title = document.createElement("h1");
        title.textContent = "YouTube Guardian";
        title.style.fontSize = "36px";
        title.style.margin = "0 0 20px 0";
        title.style.fontWeight = "300";

        const message = document.createElement("p");
        message.textContent = "This video needs to be checked for kid-safe content.";
        message.style.fontSize = "18px";
        message.style.margin = "0 0 30px 0";
        message.style.opacity = "0.9";

        const instruction = document.createElement("p");
        instruction.innerHTML = "Click the <strong>YouTube Guardian</strong> extension icon to check this video.";
        instruction.style.fontSize = "16px";
        instruction.style.margin = "0";
        instruction.style.opacity = "0.8";

        blocker.appendChild(icon);
        blocker.appendChild(title);
        blocker.appendChild(message);
        blocker.appendChild(instruction);

        document.body.appendChild(blocker);
        
        // Disable page scrolling
        document.body.style.overflow = 'hidden';
    }

    // Remove the blocking overlay
    function removeBlocker() {
        if (blocker && blocker.parentNode) {
            blocker.parentNode.removeChild(blocker);
            blocker = null;
        }
        document.body.style.overflow = '';
        isVideoBlocked = false;
    }

    // Extract video ID from current URL
    function getCurrentVideoId() {
        const url = window.location.href;
        const match = url.match(/[?&]v=([^&]+)/);
        return match ? match[1] : null;
    }

    // Check if current video is approved
    function checkVideoApproval() {
        const videoId = getCurrentVideoId();
        if (!videoId) return;

        // If video changed, block it initially
        if (videoId !== currentVideoId) {
            currentVideoId = videoId;
            isVideoBlocked = true;
            
            // Check if this video was previously approved
            chrome.storage.local.get([`approved_${videoId}`], (result) => {
                if (result[`approved_${videoId}`]) {
                    // Previously approved
                    isVideoBlocked = false;
                    if (blocker) removeBlocker();
                } else {
                    // Not approved, show blocker
                    createBlocker();
                }
            });
        }
    }

    // Handle video navigation (YouTube is a SPA)
    function handleNavigation() {
        // Clear existing interval
        if (checkInterval) {
            clearInterval(checkInterval);
        }
        
        // Check video status immediately and then periodically
        checkVideoApproval();
        checkInterval = setInterval(checkVideoApproval, 1000);
    }

    // Listen for messages from popup
    chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
        if (msg.action === "unblockVideo") {
            const videoId = getCurrentVideoId();
            if (videoId) {
                // Store approval status
                chrome.storage.local.set({[`approved_${videoId}`]: true});
                removeBlocker();
                sendResponse({success: true});
            }
        } else if (msg.action === "blockVideo") {
            const videoId = getCurrentVideoId();
            if (videoId) {
                // Remove approval status
                chrome.storage.local.remove([`approved_${videoId}`]);
                isVideoBlocked = true;
                createBlocker();
                sendResponse({success: true});
            }
        } else if (msg.action === "getVideoStatus") {
            sendResponse({
                isBlocked: isVideoBlocked,
                videoId: getCurrentVideoId()
            });
        }
    });

    // Override video play functionality
    function blockVideoPlayback() {
        if (!isVideoBlocked) return;

        const videos = document.querySelectorAll('video');
        videos.forEach(video => {
            if (video.paused === false) {
                video.pause();
            }
            // Prevent play events
            video.addEventListener('play', (e) => {
                if (isVideoBlocked) {
                    e.preventDefault();
                    e.stopPropagation();
                    video.pause();
                }
            }, true);
        });
    }

    // Observe for video elements and navigation changes
    const observer = new MutationObserver((mutations) => {
        let shouldCheck = false;
        
        mutations.forEach((mutation) => {
            // Check for URL changes or new video elements
            if (mutation.type === 'childList') {
                const hasVideoElements = Array.from(mutation.addedNodes).some(node => 
                    node.nodeType === 1 && (
                        node.tagName === 'VIDEO' || 
                        node.querySelector && node.querySelector('video')
                    )
                );
                if (hasVideoElements) shouldCheck = true;
            }
        });

        if (shouldCheck) {
            setTimeout(checkVideoApproval, 100);
        }

        // Block video playback if needed
        blockVideoPlayback();
    });

    // Start observing
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });

    // Handle navigation in SPA
    let lastUrl = location.href;
    new MutationObserver(() => {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(handleNavigation, 100);
        }
    }).observe(document, {subtree: true, childList: true});

    // Initial setup
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', handleNavigation);
    } else {
        handleNavigation();
    }

    // Periodic check to ensure blocking is maintained
    setInterval(() => {
        if (isVideoBlocked && !blocker) {
            createBlocker();
        }
        blockVideoPlayback();
    }, 2000);
})();