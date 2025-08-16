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
      const isParseError = this.state.error?.message?.includes('parseUnits') || 
                          this.state.error?.message?.includes('split is not a function')
      
      return (
        <div className="min-h-screen bg-eth-dark flex items-center justify-center">
          <div className="max-w-md w-full mx-4">
            <div className="card p-8 text-center">
              <h2 className="text-2xl font-semibold text-white mb-4">
                {isParseError ? 'Wallet Error' : 'Something went wrong'}
              </h2>
              <p className="text-gray-400 mb-6">
                {isParseError 
                  ? 'There was an issue with the wallet funding system. This is a temporary error.'
                  : (this.state.error?.message || 'An unexpected error occurred')
                }
              </p>
              <div className="flex flex-col gap-3">
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: undefined })
                  }}
                  className="btn-primary px-6 py-2"
                >
                  Try Again
                </button>
                <button
                  onClick={() => {
                    this.setState({ hasError: false, error: undefined })
                    window.location.reload()
                  }}
                  className="bg-gray-600 hover:bg-gray-500 text-white px-6 py-2 rounded-lg"
                >
                  Reload Page
                </button>
              </div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}