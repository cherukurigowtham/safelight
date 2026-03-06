import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../config';
import Link from 'next/link';
import styles from '../styles/components/header.module.css';

const InlineLogo = () => (
    <svg width="120" height="40" viewBox="0 0 120 40" xmlns="http://www.w3.org/2000/svg" aria-label="Invesa logo">
        <defs>
            <linearGradient id="gradLogo" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0" stopColor="#4ADE80" />
                <stop offset="1" stopColor="#1F7A8C" />
            </linearGradient>
        </defs>
        <rect x="0" y="0" width="120" height="40" rx="6" fill="url(#gradLogo)" />
        <text x="46" y="26" fill="#fff" fontFamily="Arial" fontSize="14">Invesa</text>
    </svg>
);

export default function Header() {
    const [user, setUser] = useState(null);
    const [logoError, setLogoError] = useState(false);

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
                window.location.href = '/login';
            });
    }

    return (
        <header className={styles.header}>
            <div className={styles.inner}>
                {/* LOGO + BRAND */}
                <Link href="/" className={styles.brand}>
                    {!logoError ? (
                        /* eslint-disable-next-line @next/next/no-img-element */
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
                            <Link href="/profile">Profile</Link>
                            <button
                                className={styles.logout}
                                onClick={logout}
                            >
                                Logout
                            </button>
                        </>
                    ) : (
                        <>
                            <Link href="/login">Login</Link>
                            <Link href="/signup">Signup</Link>
                        </>
                    )}
                </nav>
            </div>
        </header>
    );
}
