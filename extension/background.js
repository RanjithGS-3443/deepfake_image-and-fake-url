// Listen for tab updates to analyze URLs
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  // Only analyze when the page is fully loaded
  if (changeInfo.status === 'complete' && tab.url && tab.url.startsWith('http')) {
    try {
      // Check if API is available
      let apiAvailable = false;
      try {
        const checkResponse = await fetch('http://localhost:8000/', {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });
        apiAvailable = checkResponse.ok;
      } catch (error) {
        console.error('API not available:', error);
        apiAvailable = false;
      }
      
      if (!apiAvailable) {
        console.log('API not available, skipping URL analysis');
        return;
      }
      
      // Analyze URL
      const response = await fetch('http://localhost:8000/analyze-url', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ url: tab.url }),
      });

      if (!response.ok) {
        throw new Error(`URL analysis failed: ${response.status}`);
      }

      const result = await response.json();
      
      if (result.is_phishing) {
        // Show warning notification
        chrome.notifications.create({
          type: 'basic',
          iconUrl: 'images/icon128.png',
          title: '⚠️ Phishing Warning',
          message: 'This website may be a phishing attempt. Proceed with caution!',
        });
        
        // Also update the extension icon to indicate a warning
        chrome.action.setIcon({
          path: {
            "16": "images/warning16.png",
            "48": "images/warning48.png",
            "128": "images/warning128.png"
          },
          tabId: tabId
        });
      } else {
        // Reset the icon to normal
        chrome.action.setIcon({
          path: {
            "16": "images/icon16.png",
            "48": "images/icon48.png",
            "128": "images/icon128.png"
          },
          tabId: tabId
        });
      }
    } catch (error) {
      console.error('Error analyzing URL:', error);
    }
  }
});

// Listen for installation
chrome.runtime.onInstalled.addListener(() => {
  console.log('Phishing & Deepfake Detector installed');
}); 