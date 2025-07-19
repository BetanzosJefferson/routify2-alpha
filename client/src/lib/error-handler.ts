// Sistema de manejo de errores global para evitar pantallas en blanco en Android

export interface ErrorInfo {
  error: Error;
  errorInfo?: any;
  timestamp: number;
  userAgent: string;
  url: string;
}

class GlobalErrorHandler {
  private errorQueue: ErrorInfo[] = [];
  private maxQueueSize = 50;

  constructor() {
    this.setupGlobalErrorHandlers();
  }

  private setupGlobalErrorHandlers() {
    // Capturar errores JavaScript no controlados
    window.addEventListener('error', (event) => {
      this.handleError(event.error || new Error(event.message), {
        type: 'javascript',
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno
      });
    });

    // Capturar promesas rechazadas no controladas
    window.addEventListener('unhandledrejection', (event) => {
      this.handleError(
        event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
        {
          type: 'unhandledPromise',
          reason: event.reason
        }
      );
      
      // Prevenir que el error se propague y cause pantalla en blanco
      event.preventDefault();
    });

    // Capturar errores de React (si se usa con ErrorBoundary)
    if (typeof window !== 'undefined') {
      (window as any).errorLogger = {
        logError: (error: Error, errorInfo: any) => {
          this.handleError(error, { type: 'react', ...errorInfo });
        }
      };
    }
  }

  private handleError(error: Error, additionalInfo: any = {}) {
    const errorInfo: ErrorInfo = {
      error,
      errorInfo: additionalInfo,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // Agregar a la cola de errores
    this.errorQueue.push(errorInfo);
    
    // Mantener solo los últimos errores
    if (this.errorQueue.length > this.maxQueueSize) {
      this.errorQueue.shift();
    }

    // Log en consola para desarrollo
    if (process.env.NODE_ENV === 'development') {
      console.error('🚨 Error capturado:', error);
      console.error('📋 Información adicional:', additionalInfo);
    }

    // Solo log silencioso para Android
    if (this.isAndroid()) {
      console.warn('🤖 Error en Android (silenciado):', error.message);
    }

    // Enviar a servicio de logging si está disponible
    this.sendToLoggingService(errorInfo);
  }

  private isAndroid(): boolean {
    return /Android/i.test(navigator.userAgent);
  }



  private sendToLoggingService(errorInfo: ErrorInfo) {
    // Enviar al backend para logging (opcional)
    try {
      fetch('/api/errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: errorInfo.error.message,
          stack: errorInfo.error.stack,
          timestamp: errorInfo.timestamp,
          userAgent: errorInfo.userAgent,
          url: errorInfo.url,
          additionalInfo: errorInfo.errorInfo
        })
      }).catch(() => {
        // Silenciar errores de logging
      });
    } catch (e) {
      // Silenciar errores de logging
    }
  }

  public getErrorQueue(): ErrorInfo[] {
    return [...this.errorQueue];
  }

  public clearErrorQueue() {
    this.errorQueue = [];
  }
}

// Instanciar el manejador global
export const globalErrorHandler = new GlobalErrorHandler();

// Función helper para manejo manual de errores
export function handleError(error: Error, context?: string) {
  globalErrorHandler['handleError'](error, { context, type: 'manual' });
}

// Función helper para componentes React
export function withErrorHandling<T extends (...args: any[]) => any>(
  fn: T,
  context?: string
): T {
  return ((...args: any[]) => {
    try {
      const result = fn(...args);
      
      // Si es una promesa, capturar errores
      if (result && typeof result.catch === 'function') {
        return result.catch((error: Error) => {
          handleError(error, context);
          throw error;
        });
      }
      
      return result;
    } catch (error) {
      handleError(error as Error, context);
      throw error;
    }
  }) as T;
}