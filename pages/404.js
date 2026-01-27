import Link from 'next/link';
import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import styles from '../styles/pages/404.module.css';

export default function Custom404() {
    return (
        <>
            <Head>
                <title>404 - Page Not Found | Invesa</title>
            </Head>

            <Header />

            <main className={styles.container}>
                <div className={styles.errorCode}>404</div>
                <h1 className={styles.title}>Under Construction or Missing</h1>
                <p className={styles.description}>
                    Oops! The page you're looking for doesn't exist or has been moved.
                    Let's get you back on track to your investments.
                </p>
                <Link href="/" className={styles.button}>
                    Return to Dashboard
                </Link>
            </main>

            <Footer />
        </>
    );
}
