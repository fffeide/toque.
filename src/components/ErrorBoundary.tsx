import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Button } from './ui/Button';
import { AlertCircle } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary atrapó un error no controlado:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#F7F4EE] flex items-center justify-center p-4">
          <div className="bg-white border border-[#E3DDD2] rounded-2xl p-6 sm:p-8 max-w-md w-full text-center space-y-4 shadow-sm">
            <div className="w-14 h-14 rounded-2xl bg-[#FCE9E6] text-[#B8332A] flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h2 className="font-display font-bold text-xl text-[#0B1030]">
              Ocurrió un inconveniente inesperado
            </h2>
            <p className="text-xs text-[#5E6072] leading-relaxed">
              No te preocupes: tus carteles y ventas en caja siguen resguardados. Probá recargar la página para continuar.
            </p>
            <div className="pt-2">
              <Button variant="ultramar" onClick={this.handleReset} fullWidth>
                Recargar aplicación
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
