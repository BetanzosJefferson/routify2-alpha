import "dotenv/config";
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
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
  const server = await registerRoutes(app);
  
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

  // Use configured port or default to 5000 in development
  const port = process.env.PORT ? parseInt(process.env.PORT) : 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
