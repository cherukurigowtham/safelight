import React from 'react';
import styles from '../styles/components/errorBoundary.module.css';

class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false };
    }

    static getDerivedStateFromError() {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    render() {
        if (this.state.hasError) {
            return (
                <div className={styles.container}>
                    <h2 className={styles.title}>Something went wrong</h2>
                    <p className={styles.message}>
                        We apologize for the inconvenience. A technical error occurred.
                    </p>
                    <button
                        className={styles.button}
                        onClick={() => window.location.href = '/'}
                    >
                        Back to Home
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
