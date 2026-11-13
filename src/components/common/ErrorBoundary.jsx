import React from 'react';
import { AlertOctagon, RefreshCw } from 'lucide-react';
import { Button } from '../ui';

/**
 * Componente de barrera de errores (Error Boundary) global para React.
 * Captura excepciones en tiempo de ejecución en el árbol de renderizado,
 * evitando que la aplicación colapse a una pantalla en blanco y ofreciendo recuperación segura.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary capturó una excepción:', error, errorInfo);
  }

  handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 text-slate-100 font-sans">
          <div className="max-w-md w-full rounded-2xl border border-rose-500/30 bg-slate-900/90 p-6 shadow-2xl backdrop-blur-md text-center space-y-4">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400">
              <AlertOctagon className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Error inesperado en la interfaz</h2>
              <p className="text-xs text-slate-400 mt-1">
                Ocurrió una excepción durante el procesamiento o renderizado de datos.
              </p>
            </div>
            {this.state.error?.message && (
              <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3 text-left">
                <code className="text-[11px] font-mono text-rose-300 break-all">
                  {this.state.error.message}
                </code>
              </div>
            )}
            <div className="flex justify-center pt-2">
              <Button
                variant="primary"
                onClick={this.handleReload}
                icon={RefreshCw}
              >
                Recargar Aplicación
              </Button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
