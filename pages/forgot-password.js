import { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import Header from '../components/Header';
import Footer from '../components/Footer';
import { API_BASE_URL } from '../config';
import styles from '../styles/pages/auth.module.css';

/* ============================================================
   Password Strength
   ============================================================ */

function getPasswordStrength(password) {
    let score = 0;
    if (password.length >= 8) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/[0-9]/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;

    if (score <= 1) return 'Weak';
    if (score === 2) return 'Medium';
    return 'Strong';
}

export default function ForgotPassword() {
    const router = useRouter();

    const [step, setStep] = useState(1);
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');

    const strength = getPasswordStrength(password);
    const passwordsMatch = password && password === confirmPassword;

    /* ========================================================
       STEP 1 — SEND OTP
       ======================================================== */

    async function sendOtp(e) {
        e.preventDefault();
        setError('');

        await fetch(`${API_BASE_URL}/api/password/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });

        setStep(2);
    }

    /* ========================================================
       STEP 2 — RESET PASSWORD
       ======================================================== */

    async function reset(e) {
        e.preventDefault();
        setError('');

        if (!passwordsMatch) {
            setError('Passwords do not match');
            return;
        }

        if (strength === 'Weak') {
            setError('Password is too weak');
            return;
        }

        const res = await fetch(`${API_BASE_URL}/api/password/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp, password })
        });

        if (!res.ok) {
            setError('Invalid OTP or expired');
            return;
        }

        router.push('/login');
    }

    return (
        <>
            <Head>
                <title>Forgot Password — Invesa</title>
            </Head>

            <Header />

            <main className={styles.container}>
                <div className={styles.card}>
                    <h1 className={styles.title}>Reset Password</h1>

                    {error && <p className={styles.error}>{error}</p>}

                    {step === 1 && (
                        <form onSubmit={sendOtp}>
                            <input
                                className={styles.input}
                                type="email"
                                placeholder="Email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                required
                            />
                            <button className={styles.button}>
                                Send OTP
                            </button>
                        </form>
                    )}

                    {step === 2 && (
                        <form onSubmit={reset}>
                            <input
                                className={styles.input}
                                placeholder="OTP"
                                value={otp}
                                onChange={e => setOtp(e.target.value)}
                                required
                            />

                            <input
                                className={styles.input}
                                type="password"
                                placeholder="New Password"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                required
                            />

                            <input
                                className={styles.input}
                                type="password"
                                placeholder="Confirm Password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                required
                            />

                            <p>
                                Password strength:{' '}
                                <strong>{strength}</strong>
                            </p>

                            <button
                                className={styles.button}
                                disabled={
                                    !passwordsMatch || strength === 'Weak'
                                }
                            >
                                Reset Password
                            </button>
                        </form>
                    )}
                </div>
            </main>

            <Footer />
        </>
    );
}
