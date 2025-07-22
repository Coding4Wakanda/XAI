
(function() {
  'use strict';
  
  // Default configuration
  const defaultConfig = {
    apiEndpoint: 'https://your-replit-url.replit.dev/api/chat',
    companyId: null,
    position: 'bottom-right', // bottom-right, bottom-left, top-right, top-left
    theme: 'default',
    autoOpen: false,
    welcomeMessage: null
  };
  
  // Merge with user config
  const config = Object.assign({}, defaultConfig, window.CravWidgetConfig || {});
  
  // Store config globally
  window.CravWidget = window.CravWidget || {};
  Object.assign(window.CravWidget, config);
  
  // Function to load the widget
  function loadWidget() {
    // Check if widget is already loaded
    if (document.getElementById('crav-widget')) {
      return;
    }
    
    // Create container
    const container = document.createElement('div');
    container.id = 'crav-widget-container';
    
    // Load widget HTML
    fetch(config.apiEndpoint.replace('/api/chat', '/widget.html'))
      .then(response => response.text())
      .then(html => {
        // Extract body content from the widget HTML
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        const widgetContent = doc.body.innerHTML;
        
        container.innerHTML = widgetContent;
        document.body.appendChild(container);
        
        // Apply position styling
        applyPositionStyling();
        
        // Auto-open if configured
        if (config.autoOpen) {
          setTimeout(() => {
            if (window.CravWidget.open) {
              window.CravWidget.open();
            }
          }, 1000);
        }
      })
      .catch(error => {
        console.error('Failed to load CRAV widget:', error);
        
        // Fallback: inject widget directly
        injectWidgetDirectly();
      });
  }
  
  function injectWidgetDirectly() {
    // Create widget HTML directly if fetch fails
    const widgetHTML = `
      <div id="crav-widget" class="crav-widget" style="position: fixed; bottom: 20px; right: 20px; z-index: 999999; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
        <button class="crav-bubble" onclick="window.CravWidget.open()" style="width: 60px; height: 60px; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); border-radius: 50%; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 20px rgba(0,0,0,0.15); border: none; color: white; font-size: 24px;">
          💬
        </button>
      </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', widgetHTML);
    
    // Simple open function
    window.CravWidget.open = function() {
      window.open(config.apiEndpoint.replace('/api/chat', '/widget.html'), 'crav-widget', 'width=400,height=600');
    };
  }
  
  function applyPositionStyling() {
    const widget = document.getElementById('crav-widget');
    if (!widget) return;
    
    // Reset position styles
    widget.style.top = 'auto';
    widget.style.bottom = 'auto';
    widget.style.left = 'auto';
    widget.style.right = 'auto';
    
    // Apply position based on config
    switch(config.position) {
      case 'top-left':
        widget.style.top = '20px';
        widget.style.left = '20px';
        break;
      case 'top-right':
        widget.style.top = '20px';
        widget.style.right = '20px';
        break;
      case 'bottom-left':
        widget.style.bottom = '20px';
        widget.style.left = '20px';
        break;
      case 'bottom-right':
      default:
        widget.style.bottom = '20px';
        widget.style.right = '20px';
        break;
    }
  }
  
  // Load when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadWidget);
  } else {
    loadWidget();
  }
  
  // Expose widget control methods
  window.CravWidget = window.CravWidget || {};
  window.CravWidget.load = loadWidget;
  window.CravWidget.config = config;
  
})();
