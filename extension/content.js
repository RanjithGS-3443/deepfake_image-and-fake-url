// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getImages') {
    // Get all images on the page
    const images = Array.from(document.getElementsByTagName('img'))
      .filter(img => {
        // Skip images with data URLs or empty sources
        const hasValidSource = img.src && 
                              img.src.startsWith('http') && 
                              !img.src.includes('data:image');
        
        // Skip images that are part of the UI (buttons, icons, etc.)
        const isUIElement = img.role === 'button' || 
                           (img.role === 'img' && (img.className.includes('icon') || 
                           img.className.includes('logo')));
        
        // Skip very small images (less than 30x30 pixels)
        const rect = img.getBoundingClientRect();
        const isVerySmall = rect.width < 30 || rect.height < 30;
        
        return hasValidSource && !isUIElement && !isVerySmall;
      })
      .map(img => {
        // Get image dimensions and position
        const rect = img.getBoundingClientRect();
        return {
          src: img.src,
          width: rect.width,
          height: rect.height,
          x: rect.x,
          y: rect.y,
          alt: img.alt || '',
          className: img.className || '',
          id: img.id || ''
        };
      });
    
    // Sort images by size (largest first)
    images.sort((a, b) => (b.width * b.height) - (a.width * a.height));
    
    // Also check for background images
    const elementsWithBgImage = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const style = window.getComputedStyle(el);
        return style.backgroundImage && style.backgroundImage !== 'none';
      })
      .map(el => {
        const style = window.getComputedStyle(el);
        const bgImage = style.backgroundImage;
        // Extract URL from background-image: url('...')
        const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
        return match ? {
          src: match[1],
          width: el.offsetWidth,
          height: el.offsetHeight,
          x: el.getBoundingClientRect().x,
          y: el.getBoundingClientRect().y,
          alt: '',
          className: el.className || '',
          id: el.id || '',
          isBackground: true
        } : null;
      })
      .filter(item => item && item.src.startsWith('http') && !item.src.includes('data:image'));
    
    // Combine both types of images
    const allImages = [...images, ...elementsWithBgImage];
    
    // Remove duplicates
    const uniqueImages = allImages.filter((item, index, self) => 
      index === self.findIndex((t) => t.src === item.src)
    );
    
    // Send response immediately
    sendResponse({ images: uniqueImages });
    return false; // Indicate synchronous response
  } else if (request.action === 'highlightDeepfake') {
    // Find and highlight the deepfake image
    const images = document.getElementsByTagName('img');
    for (const img of images) {
      if (img.src === request.imageUrl) {
        // Add a red border and warning overlay
        img.style.border = '3px solid red';
        img.style.position = 'relative';
        
        // Create warning overlay
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.right = '0';
        overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
        overlay.style.color = 'white';
        overlay.style.padding = '5px';
        overlay.style.fontSize = '12px';
        overlay.style.fontWeight = 'bold';
        overlay.style.textAlign = 'center';
        overlay.style.zIndex = '1000';
        overlay.textContent = '⚠️ Potential Deepfake';
        
        // Add hover effect
        img.addEventListener('mouseover', () => {
          overlay.style.display = 'block';
        });
        
        img.addEventListener('mouseout', () => {
          overlay.style.display = 'none';
        });
        
        // Initially hide the overlay
        overlay.style.display = 'none';
        
        // Add the overlay to the image's parent
        img.parentElement.style.position = 'relative';
        img.parentElement.appendChild(overlay);
        
        // Add click handler to show more details
        img.addEventListener('click', () => {
          const details = document.createElement('div');
          details.style.position = 'fixed';
          details.style.top = '50%';
          details.style.left = '50%';
          details.style.transform = 'translate(-50%, -50%)';
          details.style.backgroundColor = 'white';
          details.style.padding = '20px';
          details.style.borderRadius = '5px';
          details.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
          details.style.zIndex = '1001';
          details.style.maxWidth = '80%';
          details.style.maxHeight = '80%';
          details.style.overflow = 'auto';
          
          details.innerHTML = `
            <h3 style="color: red; margin-top: 0;">⚠️ Deepfake Warning</h3>
            <p>This image has been flagged as a potential deepfake. Please be cautious when interacting with this content.</p>
            <p>Tips for identifying deepfakes:</p>
            <ul>
              <li>Look for unnatural facial features or movements</li>
              <li>Check for inconsistent lighting or shadows</li>
              <li>Verify the source of the image</li>
              <li>Be skeptical of emotionally charged content</li>
            </ul>
            <button style="margin-top: 10px; padding: 5px 10px;">Close</button>
          `;
          
          // Add close button functionality
          const closeButton = details.querySelector('button');
          closeButton.addEventListener('click', () => {
            document.body.removeChild(details);
          });
          
          document.body.appendChild(details);
        });
      }
    }
    
    // Also check for background images
    const elements = document.querySelectorAll('*');
    elements.forEach(el => {
      const style = window.getComputedStyle(el);
      const bgImage = style.backgroundImage;
      if (bgImage !== 'none') {
        const match = bgImage.match(/url\(['"]?(.*?)['"]?\)/);
        if (match && match[1] === request.imageUrl) {
          // Add warning border to element with background image
          el.style.border = '3px solid red';
          
          // Create warning overlay
          const overlay = document.createElement('div');
          overlay.style.position = 'absolute';
          overlay.style.top = '0';
          overlay.style.left = '0';
          overlay.style.right = '0';
          overlay.style.backgroundColor = 'rgba(255, 0, 0, 0.7)';
          overlay.style.color = 'white';
          overlay.style.padding = '5px';
          overlay.style.fontSize = '12px';
          overlay.style.fontWeight = 'bold';
          overlay.style.textAlign = 'center';
          overlay.style.zIndex = '1000';
          overlay.textContent = '⚠️ Potential Deepfake';
          
          // Add the overlay to the element
          el.style.position = 'relative';
          el.appendChild(overlay);
          
          // Add click handler to show more details
          el.addEventListener('click', () => {
            const details = document.createElement('div');
            details.style.position = 'fixed';
            details.style.top = '50%';
            details.style.left = '50%';
            details.style.transform = 'translate(-50%, -50%)';
            details.style.backgroundColor = 'white';
            details.style.padding = '20px';
            details.style.borderRadius = '5px';
            details.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
            details.style.zIndex = '1001';
            details.style.maxWidth = '80%';
            details.style.maxHeight = '80%';
            details.style.overflow = 'auto';
            
            details.innerHTML = `
              <h3 style="color: red; margin-top: 0;">⚠️ Deepfake Warning</h3>
              <p>This background image has been flagged as a potential deepfake. Please be cautious when interacting with this content.</p>
              <p>Tips for identifying deepfakes:</p>
              <ul>
                <li>Look for unnatural facial features or movements</li>
                <li>Check for inconsistent lighting or shadows</li>
                <li>Verify the source of the image</li>
                <li>Be skeptical of emotionally charged content</li>
              </ul>
              <button style="margin-top: 10px; padding: 5px 10px;">Close</button>
            `;
            
            // Add close button functionality
            const closeButton = details.querySelector('button');
            closeButton.addEventListener('click', () => {
              document.body.removeChild(details);
            });
            
            document.body.appendChild(details);
          });
        }
      }
    });
    
    // Send response immediately
    sendResponse({ success: true });
    return false; // Indicate synchronous response
  }
  return false; // Indicate synchronous response for unhandled actions
});

// Add styles for deepfake warnings
const style = document.createElement('style');
style.textContent = `
  .deepfake-warning-overlay {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    background: rgba(220, 53, 69, 0.8);
    color: white;
    padding: 4px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
  }
  
  .deepfake-warning-content {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  
  .warning-icon {
    font-size: 14px;
  }
  
  .warning-text {
    font-weight: bold;
  }
  
  .deepfake-warning-text {
    position: absolute;
    top: 0;
    left: 0;
    padding: 4px;
    background: #dc3545;
    color: white;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
  }
`;
document.head.appendChild(style);

// Monitor page changes for dynamic content
const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.addedNodes.length) {
      // Check for newly added images
      mutation.addedNodes.forEach((node) => {
        if (node.nodeName === 'IMG') {
          // You could trigger analysis here if needed
          console.log('New image detected:', node.src);
        }
      });
    }
  });
});

// Start observing the document with the configured parameters
observer.observe(document.body, {
  childList: true,
  subtree: true
}); 