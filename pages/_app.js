import Head from 'next/head';
import ErrorBoundary from '../components/ErrorBoundary';
import '../styles/globals.css';

/* ============================================================
   App Root
   ============================================================ */

export default function App({ Component, pageProps }) {
    return (
        <ErrorBoundary>
            <Head>
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <title>Invesa — Secure Business Investment Platform</title>
                <meta name="description" content="Invest in growing businesses securely with Invesa. Track your portfolio, message businesses, and grow your wealth." />
                <meta name="keywords" content="investment, startup, business, invesa, portfolio, finance" />
                <link rel="canonical" href="https://invesa.com" />
                <link rel="icon" href="/logo.png" />
            </Head>

            <Component {...pageProps} />
        </ErrorBoundary>
    );
}
