import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import Header from '../components/Header';
import Footer from '../components/Footer';
import { API_BASE_URL } from '../config';
import styles from '../styles/pages/profile.module.css';

export default function Profile() {
    const router = useRouter();
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchProfile() {
            try {
                const res = await fetch(`${API_BASE_URL}/api/profile`, {
                    credentials: 'include'
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                    localStorage.setItem('user', JSON.stringify(data.user));
                } else {
                    router.push('/login');
                }
            } catch (err) {
                console.error('Profile fetch failed');
                router.push('/login');
            } finally {
                setLoading(false);
            }
        }
        fetchProfile();
    }, [router]);

    if (loading) return null;
    if (!user) return null;

    return (
        <>
            <Head>
                <title>Profile — Invesa</title>
            </Head>

            <Header />

            <main className={styles.container}>
                <div className={styles.card}>
                    <div className={styles.avatar}>
                        {user.fullName.charAt(0)}
                    </div>
                    <h1>{user.fullName}</h1>
                    <p className={styles.email}>{user.email}</p>

                    <div className={styles.stats}>
                        <div className={styles.statItem}>
                            <span className={styles.statValue}>₹{user.balance?.toLocaleString() || '0'}</span>
                            <span className={styles.statLabel}>Available Balance</span>
                        </div>
                    </div>

                    <div className={styles.actions}>
                        <button className={styles.editButton} onClick={() => router.push('/settings')}>
                            Edit Profile
                        </div>
                    </div>
                </div>
            </main>

            <Footer />
        </>
    );
}
