/**
 * Content script that runs on GitHub pages
 * Detects .binpb files and replaces raw view with formatted protobuf viewer
 */

// Detect if we're viewing a raw binary file
function isRawBinaryFile(): boolean {
  // Check if we're on raw.githubusercontent.com
  if (window.location.hostname === 'raw.githubusercontent.com') {
    return window.location.pathname.match(/\.(binpb|bin|binarypb)$/i) !== null;
  }

  // Check if we're on GitHub blob view
  if (window.location.hostname === 'github.com' && window.location.pathname.includes('/blob/')) {
    return window.location.pathname.match(/\.(binpb|bin|binarypb)$/i) !== null;
  }

  return false;
}

// Check if this is a config file
function isConfigFile(): boolean {
  return window.location.pathname.includes('config.forma.binpb');
}

// Get the download URL for the file
function getDownloadUrl(): string | null {
  if (window.location.hostname === 'raw.githubusercontent.com') {
    return window.location.href;
  }

  // On GitHub blob view, find the raw button
  const rawButton = document.querySelector('a[data-testid="raw-button"]') as HTMLAnchorElement;
  if (rawButton) {
    return rawButton.href;
  }

  // Alternative: construct raw URL from current path
  // https://github.com/user/repo/blob/branch/path/file.binpb
  // -> https://raw.githubusercontent.com/user/repo/branch/path/file.binpb
  const match = window.location.pathname.match(/^\/([^\/]+)\/([^\/]+)\/blob\/([^\/]+)\/(.+)$/);
  if (match) {
    const [, user, repo, branch, path] = match;
    return `https://raw.githubusercontent.com/${user}/${repo}/${branch}/${path}`;
  }

  return null;
}

// Try to find schema descriptor from config.forma.binpb
async function findConfigFile(fileUrl: string): Promise<string | null> {
  try {
    // Get directory of the file
    const url = new URL(fileUrl);
    const pathParts = url.pathname.split('/');
    pathParts.pop(); // Remove filename

    // Try to find config.forma.binpb in parent directories
    for (let i = 0; i < 5; i++) {
      if (pathParts.length < 5) break; // Need at least /user/repo/branch/

      const configPath = [...pathParts, 'config.forma.binpb'].join('/');
      const configUrl = `${url.origin}${configPath}`;

      const response = await fetch(configUrl);
      if (response.ok) {
        return configUrl;
      }

      pathParts.pop(); // Go up one directory
    }
  } catch (error) {
    console.error('[Forma] Error finding config:', error);
  }

  return null;
}

// Replace page content with viewer
async function injectViewer() {
  console.log('[Forma] Injecting viewer for protobuf file');

  const downloadUrl = getDownloadUrl();
  if (!downloadUrl) {
    console.error('[Forma] Could not determine download URL');
    return;
  }

  console.log('[Forma] Download URL:', downloadUrl);

  // Download the binary file
  let binaryData: ArrayBuffer;
  try {
    const response = await fetch(downloadUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch: ${response.statusText}`);
    }
    binaryData = await response.arrayBuffer();
    console.log('[Forma] Downloaded binary data:', binaryData.byteLength, 'bytes');
  } catch (error) {
    console.error('[Forma] Error downloading file:', error);
    return;
  }

  // Try to find config file
  const configUrl = await findConfigFile(downloadUrl);
  console.log('[Forma] Config URL:', configUrl || 'not found');

  // Replace page content
  if (window.location.hostname === 'raw.githubusercontent.com') {
    // On raw view, replace entire document
    document.documentElement.innerHTML = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <title>Forma Protobuf Viewer</title>
          <link rel="stylesheet" href="${chrome.runtime.getURL('styles.css')}">
        </head>
        <body>
          <div id="forma-viewer">
            <div class="forma-header">
              <h1>Forma Protobuf Viewer</h1>
              <div class="forma-file-info">
                <span class="file-name">${window.location.pathname.split('/').pop()}</span>
                <span class="file-size">${(binaryData.byteLength / 1024).toFixed(2)} KB</span>
              </div>
            </div>
            <div id="forma-content"></div>
          </div>
          <script src="${chrome.runtime.getURL('viewer.js')}"></script>
        </body>
      </html>
    `;
  } else {
    // On GitHub blob view, replace the file content area
    console.log('[Forma] Looking for file content area...');

    // Try multiple selectors for GitHub's file display area
    let fileContent: Element | null = document.querySelector('.blob-wrapper');
    if (!fileContent) fileContent = document.querySelector('.Box-body');
    if (!fileContent) fileContent = document.querySelector('[data-testid="file-viewer"]');
    if (!fileContent) fileContent = document.querySelector('[data-testid="code-view"]');
    if (!fileContent) fileContent = document.querySelector('.react-blob-view-header-sticky');
    if (!fileContent) {
      const textarea = document.querySelector('#read-only-cursor-text-area');
      if (textarea?.parentElement?.parentElement) {
        fileContent = textarea.parentElement.parentElement;
      }
    }
    if (!fileContent) {
      // Try to find the main content area
      fileContent = document.querySelector('main') || document.querySelector('[role="main"]');
    }

    console.log('[Forma] Found file content element:', fileContent);

    if (fileContent) {
      console.log('[Forma] Replacing file content with viewer');

      // Create viewer container
      const viewerDiv = document.createElement('div');
      viewerDiv.id = 'forma-viewer';
      viewerDiv.style.padding = '16px';
      viewerDiv.innerHTML = `
        <div class="forma-header">
          <h2>Forma Protobuf Viewer</h2>
        </div>
        <div id="forma-content" class="forma-tree"></div>
      `;

      // Replace or insert the viewer
      fileContent.innerHTML = '';
      fileContent.appendChild(viewerDiv);

      // Store data in DOM attributes that the viewer script can read
      // Convert binary data to base64 for storage
      const base64Data = btoa(String.fromCharCode(...new Uint8Array(binaryData)));
      viewerDiv.setAttribute('data-forma-binary', base64Data);
      viewerDiv.setAttribute('data-forma-download-url', downloadUrl);
      if (configUrl) {
        viewerDiv.setAttribute('data-forma-config-url', configUrl);
      }
      if (isConfigFile()) {
        viewerDiv.setAttribute('data-forma-is-config', 'true');
      }
      console.log('[Forma] Data stored in DOM attributes');

      // Load viewer script for GitHub blob view
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL('viewer.js');
      document.body.appendChild(script);
      console.log('[Forma] Viewer UI injected and script loaded');
    } else {
      console.error('[Forma] Could not find file content area to inject viewer');
      console.log('[Forma] Available elements:', {
        blobWrapper: document.querySelectorAll('.blob-wrapper').length,
        boxBody: document.querySelectorAll('.Box-body').length,
        reactRoot: document.querySelectorAll('[data-testid]').length,
        fileViewer: document.querySelectorAll('[data-testid="file-viewer"]').length,
        codeView: document.querySelectorAll('[data-testid="code-view"]').length,
        main: document.querySelectorAll('main').length,
      });
    }
  }
}

// Main execution
function checkAndInject() {
  console.log('[Forma] Checking URL:', window.location.href);
  console.log('[Forma] Pathname:', window.location.pathname);

  if (isRawBinaryFile()) {
    console.log('[Forma] Protobuf file detected!');

    // Wait for page to be ready
    if (document.readyState === 'loading') {
      console.log('[Forma] Waiting for DOMContentLoaded');
      document.addEventListener('DOMContentLoaded', injectViewer);
    } else {
      console.log('[Forma] Document ready, injecting viewer');
      injectViewer();
    }
  } else {
    console.log('[Forma] Not a binary protobuf file');
  }
}

// Run immediately
checkAndInject();

// Also watch for URL changes (GitHub uses pushState for navigation)
let lastUrl = window.location.href;
new MutationObserver(() => {
  const currentUrl = window.location.href;
  if (currentUrl !== lastUrl) {
    lastUrl = currentUrl;
    console.log('[Forma] URL changed to:', currentUrl);
    checkAndInject();
  }
}).observe(document.body, { childList: true, subtree: true });
