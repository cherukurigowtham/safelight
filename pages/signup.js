import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import Header from '../components/Header';
import Footer from '../components/Footer';
import { API_BASE_URL } from '../config';
import styles from '../styles/pages/auth.module.css';

/* ============================================================
   Password Strength Helper
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

export default function Signup() {
    const router = useRouter();

    const [step, setStep] = useState(1);

    const [form, setForm] = useState({
        fullName: '',
        email: '',
        password: '',
        confirmPassword: ''
    });

    const [otp, setOtp] = useState('');
    const [error, setError] = useState('');

    const [captcha, setCaptcha] = useState({ q: '', a: 0 });
    const [captchaInput, setCaptchaInput] = useState('');

    // refreshCaptcha available for manual refresh after mount
    function refreshCaptcha() {
        const a = Math.floor(Math.random() * 10) + 1;
        const b = Math.floor(Math.random() * 10) + 1;
        setCaptcha({ q: `${a} + ${b}`, a: a + b });
        setCaptchaInput('');
    }

    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
        refreshCaptcha();
    }, []);

    const passwordStrength = getPasswordStrength(form.password);
    const passwordsMatch =
        form.password && form.password === form.confirmPassword;

    /* ========================================================
       CAPTCHA
       ======================================================== */


    /* ========================================================
       STEP 1 — SEND OTP
       ======================================================== */

    async function sendOtp(e) {
        e.preventDefault();
        setError('');

        if (Number(captchaInput) !== captcha.a) {
            setError('Invalid CAPTCHA');
            refreshCaptcha();
            return;
        }

        const res = await fetch(`${API_BASE_URL}/api/signup/request-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                email: form.email,
                captchaAnswer: captchaInput,
                captchaExpected: captcha.a
            })
        });

        if (!res.ok) {
            setError('Failed to send OTP');
            refreshCaptcha();
            return;
        }

        setStep(2);
    }

    /* ========================================================
       STEP 2 — VERIFY OTP + CREATE ACCOUNT
       ======================================================== */

    async function completeSignup(e) {
        e.preventDefault();
        setError('');

        if (!passwordsMatch) {
            setError('Passwords do not match');
            return;
        }

        if (passwordStrength === 'Weak') {
            setError('Password is too weak');
            return;
        }

        const res = await fetch(`${API_BASE_URL}/api/signup/complete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({
                fullName: form.fullName,
                email: form.email,
                password: form.password,
                otp
            })
        });

        const data = await res.json();

        if (!res.ok) {
            setError(data.message || 'Signup failed');
            return;
        }

        // Tokens are now delivered as HttpOnly cookies from the server
        router.push('/');
    }

    /* ========================================================
       RENDER
       ======================================================== */

    return (
        <>
            <Head>
                <title>Sign Up — Invesa</title>
            </Head>

            <Header />

            <main className={styles.container}>
                <div className={styles.card}>
                    <h1 className={styles.title}>Create Account</h1>

                    {error && <p className={styles.error}>{error}</p>}

                    {/* STEP 1 */}
                    {step === 1 && (
                        <form onSubmit={sendOtp}>
                            <input
                                className={styles.input}
                                placeholder="Full Name"
                                value={form.fullName}
                                onChange={e =>
                                    setForm({ ...form, fullName: e.target.value })
                                }
                                required
                            />

                            <input
                                className={styles.input}
                                type="email"
                                placeholder="Email"
                                value={form.email}
                                onChange={e =>
                                    setForm({ ...form, email: e.target.value })
                                }
                                required
                            />

                            <p>
                                Solve: <strong>{captcha.q}</strong>
                            </p>

                            <input
                                className={styles.input}
                                placeholder="CAPTCHA answer"
                                value={captchaInput}
                                onChange={e => setCaptchaInput(e.target.value)}
                                required
                            />

                            <button className={styles.button}>
                                Send OTP
                            </button>
                        </form>
                    )}

                    {/* STEP 2 */}
                    {step === 2 && (
                        <form onSubmit={completeSignup}>
                            <input
                                className={styles.input}
                                type="password"
                                placeholder="Password"
                                value={form.password}
                                onChange={e =>
                                    setForm({ ...form, password: e.target.value })
                                }
                                required
                            />

                            <input
                                className={styles.input}
                                type="password"
                                placeholder="Confirm Password"
                                value={form.confirmPassword}
                                onChange={e =>
                                    setForm({
                                        ...form,
                                        confirmPassword: e.target.value
                                    })
                                }
                                required
                            />

                            <p>
                                Password strength:{' '}
                                <strong
                                    style={{
                                        color:
                                            passwordStrength === 'Strong'
                                                ? 'green'
                                                : passwordStrength === 'Medium'
                                                    ? 'orange'
                                                    : 'red'
                                    }}
                                >
                                    {passwordStrength}
                                </strong>
                            </p>

                            {!passwordsMatch && (
                                <p className={styles.error}>
                                    Passwords do not match
                                </p>
                            )}

                            <input
                                className={styles.input}
                                placeholder="Email OTP"
                                value={otp}
                                onChange={e => setOtp(e.target.value)}
                                required
                            />

                            <button
                                className={styles.button}
                                disabled={
                                    !passwordsMatch ||
                                    passwordStrength === 'Weak'
                                }
                            >
                                Verify & Create Account
                            </button>
                        </form>
                    )}
                </div>
            </main>

            <Footer />
        </>
    );
}
