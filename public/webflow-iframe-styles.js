/**
 * Webflow Iframe Style Inheritance Helper
 * Include this script on your Webflow page to enable style inheritance for embedded forms
 */

(function() {
  function normalizeThemePreference(value) {
    if (value === null || value === undefined) {
      return null;
    }

    const normalized = String(value).trim().toLowerCase();
    if (!normalized) {
      return null;
    }

    if (normalized === 'system') {
      return 'auto';
    }

    if (normalized === 'light' || normalized === 'dark' || normalized === 'auto') {
      return normalized;
    }

    return null;
  }

  function parseHexColor(value) {
    const normalized = value.replace('#', '').trim();

    if (normalized.length === 3) {
      return {
        r: Number.parseInt(normalized[0] + normalized[0], 16),
        g: Number.parseInt(normalized[1] + normalized[1], 16),
        b: Number.parseInt(normalized[2] + normalized[2], 16)
      };
    }

    if (normalized.length === 6) {
      return {
        r: Number.parseInt(normalized.slice(0, 2), 16),
        g: Number.parseInt(normalized.slice(2, 4), 16),
        b: Number.parseInt(normalized.slice(4, 6), 16)
      };
    }

    return null;
  }

  function parseRgbColor(value) {
    const match = value
      .replace(/\s+/g, '')
      .match(/^rgba?\((\d+),(\d+),(\d+)(?:,([0-9.]+))?\)$/i);

    if (!match) {
      return null;
    }

    if (match[4] !== undefined && Number.parseFloat(match[4]) === 0) {
      return null;
    }

    return {
      r: Number.parseInt(match[1], 10),
      g: Number.parseInt(match[2], 10),
      b: Number.parseInt(match[3], 10)
    };
  }

  function inferThemeFromBackground(value) {
    if (!value || typeof value !== 'string') {
      return null;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized || normalized === 'transparent') {
      return null;
    }

    const color = normalized.startsWith('#')
      ? parseHexColor(normalized)
      : normalized.startsWith('rgb')
        ? parseRgbColor(normalized)
        : null;

    if (!color) {
      return null;
    }

    const luminance = (color.r * 299 + color.g * 587 + color.b * 114) / 1000;
    return luminance < 140 ? 'dark' : 'light';
  }

  function detectParentTheme(rootStyles, bodyStyle) {
    const root = document.documentElement;
    const body = document.body;

    const datasetCandidates = [
      root.dataset.theme,
      root.dataset.themeMode,
      root.dataset.colorScheme,
      body && body.dataset ? body.dataset.theme : null,
      body && body.dataset ? body.dataset.themeMode : null
    ];

    for (const candidate of datasetCandidates) {
      const preference = normalizeThemePreference(candidate);
      if (preference && preference !== 'auto') {
        return preference;
      }
    }

    const classNames = `${root.className || ''} ${body && body.className ? body.className : ''}`;
    if (/\b(u-mode-dark|dark-mode|theme-dark|is-dark)\b/i.test(classNames)) {
      return 'dark';
    }

    if (/\b(light-mode|theme-light|is-light)\b/i.test(classNames)) {
      return 'light';
    }

    const explicitVariables = [
      rootStyles.getPropertyValue('--theme'),
      rootStyles.getPropertyValue('--color-theme'),
      rootStyles.getPropertyValue('--color-scheme')
    ];

    for (const variable of explicitVariables) {
      const preference = normalizeThemePreference(variable);
      if (preference && preference !== 'auto') {
        return preference;
      }
    }

    const backgroundCandidates = [
      bodyStyle.backgroundColor,
      rootStyles.backgroundColor,
      rootStyles.getPropertyValue('--colors--background'),
      rootStyles.getPropertyValue('--_color---neutral--white')
    ];

    for (const candidate of backgroundCandidates) {
      const inferredTheme = inferThemeFromBackground(candidate);
      if (inferredTheme) {
        return inferredTheme;
      }
    }

    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  // Function to get computed styles from the parent page
  function getParentStyles() {
    const computedStyle = window.getComputedStyle(document.documentElement);
    const bodyStyle = window.getComputedStyle(document.body);
    const theme = detectParentTheme(computedStyle, bodyStyle);

    // Extract key style properties with better fallbacks
    const styles = {
      fontFamily: bodyStyle.fontFamily || computedStyle.fontFamily || 'system-ui, -apple-system, sans-serif',
      fontSize: bodyStyle.fontSize || computedStyle.fontSize || '16px',
      color: bodyStyle.color || computedStyle.color || '#333333',
      backgroundColor: bodyStyle.backgroundColor || computedStyle.backgroundColor || '#ffffff',
      lineHeight: bodyStyle.lineHeight || computedStyle.lineHeight || '1.5',
      theme: theme,
      colorScheme: theme
    };

    // Extract CSS custom properties (variables) from :root
    const cssVariables = {};
    const rootStyles = window.getComputedStyle(document.documentElement);

    // Get all CSS custom properties from the root element
    for (let i = 0; i < rootStyles.length; i++) {
      const property = rootStyles[i];
      if (property.startsWith('--')) {
        cssVariables[property] = rootStyles.getPropertyValue(property);
      }
    }

    return { ...styles, cssVariables };
  }

  // Function to send styles to iframe
  function sendStylesToIframe(iframe) {
    if (!iframe || !iframe.contentWindow) return;

    try {
      const styles = getParentStyles();
      iframe.contentWindow.postMessage({
        type: 'PARENT_STYLES',
        styles: styles,
        source: 'webflow-parent'
      }, '*');
    } catch (error) {
      // Cross-origin or iframe not ready - expected in some contexts
    }
  }

  function broadcastStylesToAllIframes() {
    const iframes = document.querySelectorAll('iframe[src*="webflow-form"]');
    iframes.forEach(iframe => {
      sendStylesToIframe(iframe);
    });
  }

  // Listen for messages from iframes
  window.addEventListener('message', function(event) {
    // Handle style requests
    if (event.data.type === 'REQUEST_STYLES' && event.data.source === 'webflow-form-app') {
      // Find the iframe that sent the request
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        if (iframe.contentWindow === event.source) {
          sendStylesToIframe(iframe);
        }
      });
    }

    // Handle resize requests
    if (event.data.type === 'RESIZE_IFRAME' && event.data.source === 'webflow-form-app') {
      const iframes = document.querySelectorAll('iframe');
      iframes.forEach(iframe => {
        if (iframe.contentWindow === event.source) {
          // Set the iframe height to match content
          iframe.style.height = event.data.height + 'px';
          iframe.style.overflow = 'hidden';

          // Remove scrolling and border
          iframe.setAttribute('scrolling', 'no');
          iframe.style.border = 'none';
          iframe.style.outline = 'none';

        }
      });
    }
  });

  // Auto-detect Webflow form iframes and send styles on load
  function initializeIframeStyles() {
    const iframes = document.querySelectorAll('iframe[src*="webflow-form"]');

    iframes.forEach(iframe => {
      iframe.addEventListener('load', function() {
        // Remove border immediately
        iframe.style.border = 'none';
        iframe.style.outline = 'none';
        iframe.setAttribute('scrolling', 'no');

        // Wait a moment for the iframe content to fully load
        setTimeout(() => {
          sendStylesToIframe(iframe);
        }, 500);
      });

      // If iframe is already loaded, remove border and send styles immediately
      if (iframe.contentWindow) {
        iframe.style.border = 'none';
        iframe.style.outline = 'none';
        iframe.setAttribute('scrolling', 'no');

        setTimeout(() => {
          sendStylesToIframe(iframe);
        }, 500);
      }
    });
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeIframeStyles);
  } else {
    initializeIframeStyles();
  }

  // Re-initialize when new iframes are added (for dynamic content)
  const observer = new MutationObserver(function(mutations) {
    mutations.forEach(function(mutation) {
      mutation.addedNodes.forEach(function(node) {
        if (node.nodeType === 1) { // Element node
          if (node.tagName === 'IFRAME' && node.src && node.src.includes('webflow-form')) {
            // Remove border immediately
            node.style.border = 'none';
            node.style.outline = 'none';
            node.setAttribute('scrolling', 'no');

            node.addEventListener('load', function() {
              setTimeout(() => {
                sendStylesToIframe(node);
              }, 500);
            });
          }
          // Also check for iframes added as children
          const childIframes = node.querySelectorAll && node.querySelectorAll('iframe[src*="webflow-form"]');
          if (childIframes) {
            childIframes.forEach(iframe => {
              // Remove border immediately
              iframe.style.border = 'none';
              iframe.style.outline = 'none';
              iframe.setAttribute('scrolling', 'no');

              iframe.addEventListener('load', function() {
                setTimeout(() => {
                  sendStylesToIframe(iframe);
                }, 500);
              });
            });
          }
        }
      });
    });
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Expose global function for manual style sending
  window.sendWebflowStylesToIframe = function(iframeSelector) {
    const iframe = document.querySelector(iframeSelector);
    if (iframe) {
      sendStylesToIframe(iframe);
    }
  };

  // Auto-refresh styles when window is resized (in case of responsive changes)
  let refreshTimeout;
  function scheduleRefresh() {
    clearTimeout(refreshTimeout);
    refreshTimeout = setTimeout(function() {
      broadcastStylesToAllIframes();
    }, 100);
  }

  window.addEventListener('resize', scheduleRefresh);

  const themeMediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  if (themeMediaQuery.addEventListener) {
    themeMediaQuery.addEventListener('change', scheduleRefresh);
  } else if (themeMediaQuery.addListener) {
    themeMediaQuery.addListener(scheduleRefresh);
  }

  const themeObserver = new MutationObserver(scheduleRefresh);
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class', 'style', 'data-theme', 'data-theme-mode']
  });

  if (document.body) {
    themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-theme', 'data-theme-mode']
    });
  }

})();
