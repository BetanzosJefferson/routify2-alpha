import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes, setupWebSocketServer } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
// Referencia a rutas de cortes de caja eliminada

// Set timezone to Mexico City
process.env.TZ = 'America/Mexico_City';

const app = express();
// Aumentar el límite para permitir imágenes más grandes (50MB)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: false, limit: '50mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      
      // OPTIMIZACIÓN: Logging inteligente - evitar JSON.stringify de datasets grandes
      if (capturedJsonResponse) {
        if (Array.isArray(capturedJsonResponse)) {
          // Para arrays (listas), solo mostrar cantidad de elementos
          logLine += ` :: [${capturedJsonResponse.length} items]`;
        } else if (typeof capturedJsonResponse === 'object' && capturedJsonResponse !== null) {
          // Para objetos, mostrar claves principales sin todo el contenido
          const keys = Object.keys(capturedJsonResponse);
          if (keys.length > 3) {
            logLine += ` :: {${keys.slice(0, 3).join(', ')}, ...+${keys.length - 3}}`;
          } else {
            // Solo si es objeto pequeño, hacer JSON.stringify limitado
            const jsonStr = JSON.stringify(capturedJsonResponse);
            if (jsonStr.length > 100) {
              logLine += ` :: ${jsonStr.slice(0, 100)}...`;
            } else {
              logLine += ` :: ${jsonStr}`;
            }
          }
        } else {
          // Para primitivos, mostrar directamente
          logLine += ` :: ${capturedJsonResponse}`;
        }
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // Create single HTTP server instance 
  const { createServer } = await import("http");
  const server = createServer(app);

  // Register API routes without WebSocket setup (defer until after successful port binding)
  await registerRoutes(app, server, { setupWebSocket: false });
  
  // Rutas de cortes de caja eliminadas

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Helper function to setup WebSocket after successful server start
  const setupWebSocketAfterServerStart = async (port: number | string) => {
    try {
      await setupWebSocketServer(server);
      log(`WebSocket server setup completed on port ${port}`);
    } catch (wsError: any) {
      console.error(`Failed to setup WebSocket server: ${wsError.message}`);
      // Continue without WebSocket - application should still work
    }
  };

  // Resilient port binding - handle EADDRINUSE gracefully
  const desiredPort = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  
  // First attempt with desired port, fallback to ephemeral port on conflict
  server.once('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`Port ${desiredPort} in use, retrying with ephemeral port...`);
      server.listen({
        port: 0, // Let system assign available port
        host: "0.0.0.0",
      }, async () => {
        const address = server.address() as any;
        const actualPort = address?.port || 'unknown';
        log(`serving on ephemeral port ${actualPort} (${desiredPort} was busy)`);
        // Setup WebSocket after successful fallback port binding
        await setupWebSocketAfterServerStart(actualPort);
      });
    }
  });
  
  server.listen({
    port: desiredPort,
    host: "0.0.0.0",
  }, async () => {
    log(`serving on port ${desiredPort}`);
    // Setup WebSocket after successful port binding
    await setupWebSocketAfterServerStart(desiredPort);
  });
})();
