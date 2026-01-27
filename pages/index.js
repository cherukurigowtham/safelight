import { useEffect, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';

import Header from '../components/Header';
import Footer from '../components/Footer';
import PostCard from '../components/PostCard';
import CreatePost from '../components/CreatePost';
import InvestmentForm from '../components/InvestmentForm';
import ChatModal from '../components/ChatModal';

import styles from '../styles/pages/home.module.css';
import { API_BASE_URL } from '../config';

/* ============================================================
   Constants
   ============================================================ */

const CATEGORIES = ['All', 'Food', 'Art', 'Tech', 'Retail', 'Service'];

/* ============================================================
   Page Component
   ============================================================ */

export default function Home() {
    const router = useRouter();

    const [posts, setPosts] = useState([]);
    const [user, setUser] = useState(null);

    const [searchQuery, setSearchQuery] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');

    const [activeChat, setActiveChat] = useState(null);
    const [activeInvestmentPostId, setActiveInvestmentPostId] = useState(null);

    /* ========================================================
       Effects
       ======================================================== */

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            setUser(JSON.parse(storedUser));
        }

        fetchPosts();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchQuery, selectedCategory]);

    /* ========================================================
       Data Fetching
       ======================================================== */

    async function fetchPosts() {
        let url = `${API_BASE_URL}/api/posts?`;

        if (searchQuery) {
            url += `search=${encodeURIComponent(searchQuery)}&`;
        }

        if (selectedCategory !== 'All') {
            url += `category=${selectedCategory}`;
        }

        try {
            const response = await fetch(url, {
                credentials: 'include' // 🔐 REQUIRED
            });

            if (!response.ok) {
                throw new Error('Failed to fetch posts');
            }

            const data = await response.json();
            setPosts(data);
        } catch (error) {
            console.error('Failed to fetch posts:', error);
        }
    }

    /* ========================================================
       Handlers
       ======================================================== */

    async function handleLike(postId) {
        const token = localStorage.getItem('accessToken');
        if (!token) return router.push('/login');

        try {
            await fetch(`${API_BASE_URL}/api/posts/${postId}/like`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`
                },
                credentials: 'include'
            });

            fetchPosts();
        } catch (error) {
            console.error('Like failed:', error);
        }
    }

    async function handleInvest(postId, amount) {
        const token = localStorage.getItem('accessToken');
        if (!token) return router.push('/login');

        try {
            const response = await fetch(`${API_BASE_URL}/api/invest`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                credentials: 'include', // 🔐 REQUIRED
                body: JSON.stringify({ postId, amount })
            });

            const data = await response.json();

            if (!response.ok) {
                alert(data.message || 'Investment failed');
                return;
            }

            // Refresh posts and user balance
            fetchPosts();

            const updatedUser = {
                ...user,
                balance: (user?.balance || 0) - amount
            };

            setUser(updatedUser);
            localStorage.setItem('user', JSON.stringify(updatedUser));

            setActiveInvestmentPostId(null);
        } catch (error) {
            console.error('Investment error:', error);
        }
    }

    /* ========================================================
       Render
       ======================================================== */

    return (
        <>
            <Head>
                <title>Invesa — Grow Businesses Together</title>
                <meta
                    name="description"
                    content="Connect with local businesses and invest securely."
                />
            </Head>

            <Header />

            <main className={styles.container}>
                <h1 className={styles.title}>Welcome to Invesa</h1>
                <p className={styles.subtitle}>
                    Discover, connect, and invest in local businesses.
                </p>

                <input
                    type="text"
                    placeholder="Search businesses..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className={styles.searchInput}
                />

                <div className={styles.categoryRow}>
                    {CATEGORIES.map(category => (
                        <button
                            key={category}
                            onClick={() => setSelectedCategory(category)}
                            className={
                                selectedCategory === category
                                    ? styles.categoryButtonActive
                                    : styles.categoryButton
                            }
                        >
                            {category}
                        </button>
                    ))}
                </div>

                {user && <CreatePost onPostCreated={fetchPosts} />}

                <div className={styles.feed}>
                    {posts.map(post => (
                        <div key={post.id} className={styles.postWrapper}>
                            <PostCard
                                id={post.id}
                                author={post.author}
                                content={post.content}
                                category={post.category}
                                amountFunded={post.amount_funded}
                                likes={post.likes}
                                onLike={handleLike}
                            />

                            <div className={styles.postActions}>
                                <button
                                    className={styles.actionButton}
                                    onClick={() => setActiveChat(post)}
                                >
                                    Chat
                                </button>

                                <button
                                    className={`${styles.actionButton} ${styles.investButton}`}
                                    onClick={() =>
                                        setActiveInvestmentPostId(
                                            activeInvestmentPostId === post.id
                                                ? null
                                                : post.id
                                        )
                                    }
                                >
                                    Invest
                                </button>
                            </div>

                            {activeInvestmentPostId === post.id && (
                                <InvestmentForm
                                    businessName={post.author}
                                    onConfirm={amount =>
                                        handleInvest(post.id, amount)
                                    }
                                />
                            )}
                        </div>
                    ))}
                </div>
            </main>

            <ChatModal
                business={activeChat}
                isOpen={Boolean(activeChat)}
                onClose={() => setActiveChat(null)}
            />

            <Footer />
        </>
    );
}
