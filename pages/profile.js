import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';

import Header from '../components/Header';
import Footer from '../components/Footer';
import styles from '../styles/pages/profile.module.css';

export default function Profile() {
    const router = useRouter();
    const [user] = useState(() => {
        try {
            const stored = typeof window !== 'undefined' ? localStorage.getItem('user') : null;
            return stored ? JSON.parse(stored) : null;
        } catch {
            return null;
        }
    });
    useEffect(() => {
        if (!user) {
            router.push('/login');
        }
    }, [router, user]);

    if (!user) return null;

    return (
        <>
            <Head>
                <title>Profile — Invesa</title>
            </Head>

            <Header />

            <main className={styles.container}>
                <div className={styles.card}>
                    <h1>Profile</h1>

                    <p><strong>Name:</strong> {user.fullName}</p>
                    <p><strong>Email:</strong> {user.email}</p>
                </div>
            </main>

            <Footer />
        </>
    );
}
