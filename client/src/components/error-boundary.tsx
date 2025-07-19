import { Component, ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface ErrorFallbackProps {
  error: Error;
  resetErrorBoundary: () => void;
}

export function ErrorFallback({ error, resetErrorBoundary }: ErrorFallbackProps) {
  // Solo log de error, sin mostrar modal molesto
  console.warn('Error silenciado:', error.message);
  
  // Resetear automáticamente y continuar con el flujo normal
  resetErrorBoundary();
  
  // Retornar null para no mostrar nada en la UI
  return null;
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
    // Solo log silencioso sin modales molestos
    console.warn('Error silenciado por ErrorBoundary:', error.message);
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      // Resetear automáticamente sin mostrar modal
      setTimeout(() => {
        this.resetErrorBoundary();
      }, 100);
      
      // Continuar mostrando children normalmente
      return this.props.children;
    }

    return this.props.children;
  }
}