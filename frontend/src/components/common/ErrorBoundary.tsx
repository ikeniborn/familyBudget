import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4">
          <Card className="max-w-md w-full p-6">
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-red-100 rounded-full flex items-center justify-center">
                <AlertTriangle className="h-8 w-8 text-red-600" />
              </div>
              
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  Что-то пошло не так
                </h2>
                <p className="mt-2 text-sm text-gray-600">
                  Произошла непредвиденная ошибка. Попробуйте обновить страницу.
                </p>
              </div>

              {this.state.error && (
                <details className="text-left bg-gray-50 p-3 rounded-lg">
                  <summary className="text-sm font-medium text-gray-700 cursor-pointer">
                    Подробности ошибки
                  </summary>
                  <pre className="mt-2 text-xs text-gray-600 overflow-auto">
                    {this.state.error.toString()}
                  </pre>
                </details>
              )}

              <Button
                onClick={this.handleReset}
                className="w-full"
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Перезагрузить страницу
              </Button>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}