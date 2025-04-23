document.addEventListener('DOMContentLoaded', async () => {
  // Get the current tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  
  // Show loading state
  const urlStatus = document.getElementById('urlStatus');
  const imageStatus = document.getElementById('imageStatus');
  
  if (!urlStatus || !imageStatus) {
    console.error('Required UI elements not found');
    return;
  }
  
  urlStatus.textContent = 'Analyzing URL...';
  imageStatus.textContent = 'Analyzing images...';
  
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
    urlStatus.textContent = '❌ API not available';
    urlStatus.style.color = 'red';
    imageStatus.textContent = '❌ API not available';
    imageStatus.style.color = 'red';
    
    // Add error details
    const errorDetails = document.createElement('div');
    errorDetails.className = 'error-details';
    errorDetails.innerHTML = `
      <p>The analysis service is not available.</p>
      <p>Please make sure the API server is running at http://localhost:8000</p>
      <p>Error: Could not connect to the server</p>
    `;
    document.body.appendChild(errorDetails);
    return;
  }
  
  try {
    // Analyze URL
    const urlResponse = await fetch('http://localhost:8000/analyze-url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: tab.url }),
    }).catch(error => {
      console.error('Error fetching URL analysis:', error);
      throw new Error('Failed to connect to analysis service');
    });
    
    if (!urlResponse.ok) {
      throw new Error(`URL analysis failed: ${urlResponse.status}`);
    }
    
    const urlData = await urlResponse.json();
    
    // Update URL status
    if (urlData.is_phishing) {
      urlStatus.textContent = '⚠️ Phishing Risk Detected!';
      urlStatus.style.color = 'red';
      
      // Add detailed warning
      const urlDetails = document.createElement('div');
      urlDetails.className = 'warning-details';
      urlDetails.innerHTML = `
        <p>Risk Score: ${(urlData.risk_score * 100).toFixed(1)}%</p>
        <p>Suspicious Features:</p>
        <ul>
          ${urlData.features ? Object.entries(urlData.features)
            .filter(([_, value]) => value === true)
            .map(([key, _]) => `<li>${key.replace(/_/g, ' ')}</li>`)
            .join('') : ''}
        </ul>
      `;
      urlStatus.parentNode.appendChild(urlDetails);
    } else {
      urlStatus.textContent = '✅ URL appears safe';
      urlStatus.style.color = 'green';
    }
    
    // Ensure content script is injected
    try {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content.js']
      });
    } catch (error) {
      console.log('Content script already injected or injection failed:', error);
    }
    
    // Get images from the page
    const imagesResponse = await chrome.tabs.sendMessage(tab.id, { action: 'getImages' })
      .catch(error => {
        console.error('Error getting images:', error);
        throw new Error('Failed to get images from page');
      });
    
    if (!imagesResponse || !imagesResponse.images) {
      throw new Error('Invalid response from content script');
    }
    
    const images = imagesResponse.images;
    
    if (images.length === 0) {
      imageStatus.textContent = 'No images found on this page';
      return;
    }
    
    // Analyze up to 5 images
    const imagesToAnalyze = images.slice(0, 5);
    let deepfakeCount = 0;
    const imageDetailsList = document.createElement('ul');
    imageDetailsList.className = 'image-list';
    
    for (const image of imagesToAnalyze) {
      try {
        // Skip invalid image URLs
        if (!image.src || !image.src.startsWith('http')) {
          continue;
        }
        
        const imageResponse = await fetch('http://localhost:8000/analyze-image', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ image_url: image.src }),
        }).catch(error => {
          console.error('Error analyzing image:', error);
          throw new Error('Failed to analyze image');
        });
        
        if (!imageResponse.ok) {
          throw new Error(`Image analysis failed: ${imageResponse.status}`);
        }
        
        const imageData = await imageResponse.json();
        
        // Create image details item
        const imageItem = document.createElement('li');
        imageItem.className = `image-item ${imageData.is_deepfake ? 'deepfake' : 'safe'}`;
        
        // Add image details
        imageItem.innerHTML = `
          <div class="image-info">
            <span class="image-size">${Math.round(image.width)}x${Math.round(image.height)}px</span>
            <span class="image-type">${image.isBackground ? 'Background' : 'Regular'} Image</span>
          </div>
          <div class="image-status">
            ${imageData.is_deepfake ? 
              `<span class="deepfake-warning">⚠️ Potential Deepfake (${(imageData.deepfake_score * 100).toFixed(1)}%)</span>` :
              `<span class="safe-text">✅ Safe (${(imageData.deepfake_score * 100).toFixed(1)}%)</span>`
            }
          </div>
        `;
        
        imageDetailsList.appendChild(imageItem);
        
        if (imageData.is_deepfake) {
          deepfakeCount++;
          // Highlight the deepfake on the page
          await chrome.tabs.sendMessage(tab.id, {
            action: 'highlightDeepfake',
            imageUrl: image.src
          }).catch(error => {
            console.error('Error highlighting deepfake:', error);
          });
        }
      } catch (error) {
        console.error('Error analyzing image:', error);
        // Add error item to the list
        const errorItem = document.createElement('li');
        errorItem.className = 'image-item error';
        errorItem.innerHTML = `
          <div class="image-info">
            <span class="image-size">${Math.round(image.width)}x${Math.round(image.height)}px</span>
            <span class="image-type">${image.isBackground ? 'Background' : 'Regular'} Image</span>
          </div>
          <div class="image-status">
            <span class="error-text">❌ Analysis failed</span>
          </div>
        `;
        imageDetailsList.appendChild(errorItem);
      }
    }
    
    // Update image status
    if (deepfakeCount > 0) {
      imageStatus.textContent = `⚠️ Found ${deepfakeCount} potential deepfake${deepfakeCount > 1 ? 's' : ''}`;
      imageStatus.style.color = 'red';
    } else {
      imageStatus.textContent = '✅ No deepfakes detected';
      imageStatus.style.color = 'green';
    }
    
    // Add image details list
    const imageStatusContainer = imageStatus.parentNode;
    if (imageStatusContainer) {
      imageStatusContainer.appendChild(imageDetailsList);
      
      // Add summary
      const summary = document.createElement('div');
      summary.className = 'analysis-summary';
      summary.innerHTML = `
        <p>Analyzed ${imagesToAnalyze.length} of ${images.length} images on this page</p>
        <p>${deepfakeCount} potential deepfake${deepfakeCount !== 1 ? 's' : ''} detected</p>
      `;
      imageStatusContainer.appendChild(summary);
    }
    
  } catch (error) {
    console.error('Error:', error);
    if (urlStatus) {
      urlStatus.textContent = 'Error analyzing URL';
      urlStatus.style.color = 'red';
    }
    if (imageStatus) {
      imageStatus.textContent = 'Error analyzing images';
      imageStatus.style.color = 'red';
    }
    
    // Add error details
    const errorDetails = document.createElement('div');
    errorDetails.className = 'error-details';
    errorDetails.innerHTML = `
      <p>An error occurred while analyzing the page:</p>
      <p class="error-message">${error.message}</p>
      <p>Please make sure the analysis service is running at http://localhost:8000</p>
    `;
    document.body.appendChild(errorDetails);
  }
}); 