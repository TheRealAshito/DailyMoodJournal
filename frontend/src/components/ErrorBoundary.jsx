import { Component } from 'react'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, info) {
    console.error('ErrorBoundary caught:', error, info)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-custom px-4">
          <div className="max-w-md text-center">
            <h1 className="text-xl font-bold mb-2">Something went wrong</h1>
            <p className="text-custom-muted mb-4 text-sm">
              {this.state.error?.message || 'An unexpected error occurred.'}
            </p>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/' }}
              className="px-4 py-2 bg-cyan-500 text-white rounded-lg hover:bg-cyan-600"
            >
              Reload
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
