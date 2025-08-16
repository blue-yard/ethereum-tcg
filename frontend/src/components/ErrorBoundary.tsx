import React, { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo)
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-eth-dark flex items-center justify-center">
          <div className="max-w-md w-full mx-4">
            <div className="card p-8 text-center">
              <h2 className="text-2xl font-semibold text-white mb-4">
                Something went wrong
              </h2>
              <p className="text-gray-400 mb-6">
                {this.state.error?.message || 'An unexpected error occurred'}
              </p>
              <button
                onClick={() => {
                  this.setState({ hasError: false, error: undefined })
                  window.location.reload()
                }}
                className="btn-primary px-6 py-2"
              >
                Reload Page
              </button>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}