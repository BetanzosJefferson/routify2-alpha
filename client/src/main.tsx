import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "next-themes";
import { initializeCrossTabCache } from "./lib/queryClient";

console.log('[MAIN] ✅ main.tsx is executing!');
console.log('[MAIN] Current timestamp:', new Date().toISOString());

// Bootstrap with cross-tab cache initialization
async function bootstrap() {
  console.log('[Bootstrap] Starting bootstrap process...');
  
  try {
    // Initialize cross-tab cache first
    console.log('[Bootstrap] Initializing cross-tab cache...');
    const cacheSuccess = await initializeCrossTabCache();
    console.log('[Bootstrap] Cross-tab cache result:', cacheSuccess);
    
    // Get root element
    console.log('[Bootstrap] Getting root element...');
    const rootElement = document.getElementById("root");
    
    if (!rootElement) {
      console.error('[Bootstrap] ❌ Root element not found');
      return;
    }
    console.log('[Bootstrap] ✅ Root element found');
    
    // Create React root and render app
    console.log('[Bootstrap] Creating React root and rendering app...');
    const root = createRoot(rootElement);
    
    root.render(
      <ThemeProvider attribute="class" defaultTheme="light">
        <App />
      </ThemeProvider>
    );
    
    console.log('[Bootstrap] ✅ App rendered successfully');
    console.log('[Bootstrap] === INITIALIZATION COMPLETE ===');
    
  } catch (error) {
    const errorObj = error as Error;
    console.error('[Bootstrap] ❌ Error during bootstrap:', errorObj);
    console.error('[Bootstrap] Stack trace:', errorObj.stack);
    
    // Fallback render without cross-tab cache
    try {
      console.log('[Bootstrap] Attempting fallback render...');
      const rootElement = document.getElementById("root");
      if (rootElement) {
        createRoot(rootElement).render(
          <ThemeProvider attribute="class" defaultTheme="light">
            <App />
          </ThemeProvider>
        );
        console.log('[Bootstrap] ✅ Fallback render successful');
      }
    } catch (fallbackError) {
      const fallbackErrorObj = fallbackError as Error;
      const errorObj = error as Error;
      console.error('[Bootstrap] ❌ Fallback render failed:', fallbackErrorObj);
      
      // Ultimate fallback: show error in DOM
      const finalRootElement = document.getElementById("root");
      if (finalRootElement) {
        finalRootElement.innerHTML = `
          <div style="color: red; padding: 20px; font-family: monospace;">
            <h2>Bootstrap Error</h2>
            <p><strong>Error:</strong> ${errorObj.message}</p>
            <p><strong>Fallback Error:</strong> ${fallbackErrorObj.message}</p>
            <pre style="background: #f5f5f5; padding: 10px; overflow: auto;">
${errorObj.stack}
            </pre>
          </div>
        `;
      }
    }
  }
}

// Execute bootstrap
console.log('[MAIN] About to call bootstrap...');
bootstrap().then(() => {
  console.log('[MAIN] Bootstrap completed successfully');
}).catch(error => {
  console.error('[MAIN] Bootstrap promise failed:', error);
});
