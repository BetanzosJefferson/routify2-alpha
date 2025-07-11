import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-6 text-center">
        <div className="flex justify-center mb-4">
          <AlertCircle className="h-16 w-16 text-red-500" />
        </div>
        
        <h2 className="text-xl font-semibold text-gray-900 mb-2">
          Algo salió mal
        </h2>
        
        <p className="text-gray-600 mb-4">
          Ha ocurrido un error inesperado. Por favor, intenta recargar la página.
        </p>
        
        <div className="space-y-3">
          <Button 
            onClick={resetErrorBoundary}
            className="w-full"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Reintentar
          </Button>
          
          <Button 
            variant="outline"
            onClick={() => window.location.reload()}
            className="w-full"
          >
            Recargar página
          </Button>
        </div>
        
        {process.env.NODE_ENV === 'development' && (
          <details className="mt-4 text-left">
            <summary className="cursor-pointer text-sm text-gray-500 hover:text-gray-700">
              Detalles del error (modo desarrollo)
            </summary>
            <pre className="mt-2 text-xs text-red-600 bg-red-50 p-2 rounded overflow-auto">
              {error.message}
              {error.stack}
            </pre>
          </details>
        )}
      </div>
    </div>
  );
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, resetErrorBoundary: () => void) => ReactNode;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('Error capturado por ErrorBoundary:', error, errorInfo);
    
    // Enviar error a servicio de logging si está disponible
    if (typeof window !== 'undefined' && (window as any).errorLogger) {
      (window as any).errorLogger.logError(error, errorInfo);
    }
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback(this.state.error, this.resetErrorBoundary);
      }
      
      return (
        <ErrorFallback 
          error={this.state.error} 
          resetErrorBoundary={this.resetErrorBoundary} 
        />
      );
    }

    return this.props.children;
  }
}