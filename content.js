(function() {
    let isVideoBlocked = true;
    let blocker = null;
    let currentVideoId = null;
    let checkInterval = null;
    let originalVideoState = { muted: false, paused: false }; // Store original state

    // Check if Chrome APIs are available
    const isChromeExtension = typeof chrome !== 'undefined' && chrome.runtime && chrome.storage;

    // Control video playback when blocked
    function controlVideo(shouldBlock) {
        const video = document.querySelector('video');
        if (!video) return;

        if (shouldBlock) {
            // Store original state before modifying
            originalVideoState.muted = video.muted;
            originalVideoState.paused = video.paused;
            
            // Option 1: Pause the video
            video.pause();
            
            // Option 2: Alternatively, mute instead of pause (comment out pause above and uncomment below)
            // video.muted = true;
        } else {
            // Restore original state when unblocking
            if (!originalVideoState.paused) {
                video.play().catch(() => {}); // Ignore autoplay policy errors
            }
            video.muted = originalVideoState.muted;
        }
    }

    // Create the blocking overlay
    function createBlocker() {
        if (blocker) return;
        
        // Control video before showing blocker
        controlVideo(true);
        
        blocker = document.createElement("div");
        blocker.id = "youtube-guardian-blocker";
        blocker.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%) !important;
            z-index: 999999 !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            color: white !important;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
            text-align: center !important;
            padding: 20px !important;
            box-sizing: border-box !important;
        `;

        const content = document.createElement("div");
        content.innerHTML = `
            <div style="font-size: 64px; margin-bottom: 20px;">🛡️</div>
            <h1 style="font-size: 36px; margin: 0 0 20px 0; font-weight: 300; color: #ff0000; text-shadow: 2px 2px 4px rgba(0,0,0,0.8);">YouTube Guardian</h1>
            <p style="font-size: 18px; margin: 0 0 30px 0; opacity: 0.9;">This video needs to be checked for kid-safe content.</p>
            <p style="font-size: 16px; margin: 0; opacity: 0.8;">Click the <strong style="color: #ff0000;">YouTube Guardian</strong> extension icon to check this video.</p>
        `;

        blocker.appendChild(content);
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
        
        // Restore video controls when unblocking
        controlVideo(false);
    }

    // Monitor video element and re-apply controls if needed
    function monitorVideoElement() {
        if (!isVideoBlocked) return;
        
        const video = document.querySelector('video');
        if (video && !video.paused) {
            // Video started playing while blocked, pause it again
            controlVideo(true);
        }
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
            if (isChromeExtension) {
                chrome.storage.local.get([`approved_${videoId}`], (result) => {
                    if (chrome.runtime.lastError) {
                        console.log('Storage error:', chrome.runtime.lastError.message);
                        createBlocker();
                        return;
                    }
                    
                    if (result[`approved_${videoId}`]) {
                        // Previously approved
                        isVideoBlocked = false;
                        if (blocker) removeBlocker();
                    } else {
                        // Not approved, show blocker
                        createBlocker();
                    }
                });
            } else {
                // No Chrome APIs available, default to blocking
                createBlocker();
            }
        }
    }

    // Listen for messages from popup
    if (isChromeExtension) {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            try {
                if (msg.action === "unblockVideo") {
                    const videoId = getCurrentVideoId();
                    if (videoId) {
                        // Store approval status
                        chrome.storage.local.set({[`approved_${videoId}`]: true});
                        removeBlocker();
                        sendResponse({success: true});
                    } else {
                        sendResponse({success: false, error: "No video ID"});
                    }
                } else if (msg.action === "blockVideo") {
                    const videoId = getCurrentVideoId();
                    if (videoId) {
                        // Remove approval status
                        chrome.storage.local.remove([`approved_${videoId}`]);
                        isVideoBlocked = true;
                        createBlocker();
                        sendResponse({success: true});
                    } else {
                        sendResponse({success: false, error: "No video ID"});
                    }
                } else if (msg.action === "getVideoStatus") {
                    sendResponse({
                        isBlocked: isVideoBlocked,
                        videoId: getCurrentVideoId(),
                        hasBlocker: !!blocker
                    });
                }
            } catch (error) {
                console.error('Message handler error:', error);
                sendResponse({success: false, error: error.message});
            }
            
            return true; // Will respond asynchronously
        });
    }

    // Handle navigation in SPA
    let lastUrl = location.href;
    function handleNavigation() {
        const url = location.href;
        if (url !== lastUrl) {
            lastUrl = url;
            setTimeout(checkVideoApproval, 100);
        }
    }

    const observer = new MutationObserver(handleNavigation);
    observer.observe(document, {subtree: true, childList: true});

    // Initial setup
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => setTimeout(checkVideoApproval, 1000));
    } else {
        setTimeout(checkVideoApproval, 1000);
    }

    // Periodic maintenance - now includes video monitoring
    setInterval(() => {
        if (isVideoBlocked && !blocker) {
            createBlocker();
        }
        // Monitor video element to ensure it stays controlled
        monitorVideoElement();
    }, 2000);

    // Additional event listeners to catch video play attempts
    document.addEventListener('play', (e) => {
        if (isVideoBlocked && e.target.tagName === 'VIDEO') {
            e.preventDefault();
            controlVideo(true);
        }
    }, true);

    // Listen for video element changes
    const videoObserver = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.tagName === 'VIDEO' && isVideoBlocked) {
                    // New video element added while blocked
                    setTimeout(() => controlVideo(true), 100);
                }
            });
        });
    });

    videoObserver.observe(document.body, {
        childList: true,
        subtree: true
    });
})();