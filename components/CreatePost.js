import { useState } from 'react';
import styles from '../styles/components/createPost.module.css';
import { API_BASE_URL } from '../config';

const CATEGORIES = ['General', 'Food', 'Art', 'Tech', 'Retail', 'Service'];

export default function CreatePost({ onPostCreated }) {
    const [content, setContent] = useState('');
    const [amountNeeded, setAmountNeeded] = useState('');
    const [category, setCategory] = useState('General');

    async function handleSubmit(e) {
        e.preventDefault();
        const token = localStorage.getItem('token');
        if (!token) return;

        await fetch(`${API_BASE_URL}/api/posts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ content, amountNeeded, category })
        });

        setContent('');
        setAmountNeeded('');
        setCategory('General');
        onPostCreated?.();
    }

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Create Business Proposal</h3>

            <form onSubmit={handleSubmit}>
                <textarea
                    className={styles.textarea}
                    value={content}
                    onChange={e => setContent(e.target.value)}
                    required
                />

                <div className={styles.row}>
                    <input
                        className={styles.input}
                        type="number"
                        value={amountNeeded}
                        onChange={e => setAmountNeeded(e.target.value)}
                        required
                    />

                    <select
                        className={styles.select}
                        value={category}
                        onChange={e => setCategory(e.target.value)}
                    >
                        {CATEGORIES.map(c => (
                            <option key={c}>{c}</option>
                        ))}
                    </select>

                    <button className={styles.button}>Post</button>
                </div>
            </form>
        </div>
    );
}
