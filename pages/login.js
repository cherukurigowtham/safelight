import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';

import Header from '../components/Header';
import Footer from '../components/Footer';
import { API_BASE_URL } from '../config';
import styles from '../styles/pages/auth.module.css';

export default function Login() {
    const router = useRouter();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    async function handleLogin(e) {
        e.preventDefault();
        setError('');

        const res = await fetch(`${API_BASE_URL}/api/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ email, password })
        });

        const data = await res.json();

        if (!res.ok) {
            setError(data.message || 'Login failed');
            return;
        }
        router.push('/');
    }

    return (
        <>
            <Head>
                <title>Login — Invesa</title>
            </Head>

            <Header />

            <main className={styles.container}>
                <div className={styles.card}>
                    <h1 className={styles.title}>Login</h1>

                    {error && <p className={styles.error}>{error}</p>}

                    <form onSubmit={handleLogin}>
                        <input
                            className={styles.input}
                            type="email"
                            placeholder="Email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            required
                        />

                        <input
                            className={styles.input}
                            type="password"
                            placeholder="Password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            required
                        />

                        <button className={styles.button}>Login</button>
                    </form>

                    <p className={styles.footerText}>
                        <Link href="/forgot-password">Forgot password?</Link>
                    </p>
                </div>
            </main>

            <Footer />
        </>
    );
}
