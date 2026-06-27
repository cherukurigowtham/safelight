import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import Link from 'next/link';
import styles from '../styles/components/header.module.css';

export default function Header() {
    const [user, setUser] = useState(null);
    const [logoError, setLogoError] = useState(false);

    // Inline fallback logo (approximates provided branding)
    const InlineLogo = () => (
        <svg width="120" height="40" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg" aria-label="Invesa logo">
            <defs>
                <linearGradient id="gradLogo" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0" stopColor="#4285F4" />
                    <stop offset="1" stopColor="#34A853" />
                </linearGradient>
            </defs>
            <rect x="0" y="0" width="120" height="40" rx="6" fill="url(#gradLogo)" />
            <text x="46" y="26" fill="#fff" font-family="Arial" font-size="14" font-weight="bold">Invesa</text>
        </svg>
    );

    useEffect(() => {
        // Try to load user from API using cookies for auth in production
        async function fetchProfile() {
            try {
                const res = await fetch(`${API_BASE_URL}/api/profile`, {
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data?.user) {
                        setUser(data.user);
                        // Sync with localStorage for legacy compatibility ONLY until fully refactored
                        localStorage.setItem('user', JSON.stringify(data.user));
                    }
                }
            } catch {
                // ignore
            }
        }
        fetchProfile();
    }, []);

    function logout() {
        // Call server to clear httpOnly cookies via API, then redirect
        fetch(`${API_BASE_URL}/api/logout`, { method: 'POST', credentials: 'include' })
            .finally(() => {
                setUser(null);
                localStorage.removeItem('user');
                localStorage.removeItem('accessToken');
                window.location.href = '/login';
            });
    }

    return (
        <header className={styles.header}>
            <div className={styles.inner}>
                {/* LOGO + BRAND */}
                <Link href="/" className={styles.brand}>
                    {!logoError ? (
                        <img src="/logo.png" alt="Invesa Logo" width={32} height={32} onError={() => setLogoError(true)} />
                    ) : (
                        <InlineLogo />
                    )}

                    <span className={styles.logoText}>Invesa</span>
                </Link>

                {/* NAVIGATION */}
                <nav className={styles.nav}>
                    {user ? (
                        <>
                            <span className={styles.user}>
                                Hello, <strong>{user.fullName}</strong>
                            </span>
                            <Link href="/profile" className={styles.link}>Profile</Link>
                            <Link href="/settings" className={styles.link}>Settings</Link>
                            <Link href="/api-access" className={styles.link}>API Access</Link>
                            <button
                                className={styles.logout}
                                onClick={logout}
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login" className={styles.link}>Login</Link>
                            <Link href="/signup" className={styles.signupButton}>Signup</Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
