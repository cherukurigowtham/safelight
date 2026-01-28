import { useState } from 'react';
import styles from '../styles/components/investmentForm.module.css';

export default function InvestmentForm({ businessName, onConfirm }) {
    const [amount, setAmount] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e) {
        e.preventDefault();
        setLoading(true);
        await onConfirm(Number(amount));
        setLoading(false);
        setAmount('');
    }

    return (
        <div className={styles.container}>
            <h4 className={styles.title}>Invest in {businessName}</h4>

            <form onSubmit={handleSubmit} className={styles.row}>
                <input
                    className={styles.input}
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    required
                />
                <button className={styles.button} disabled={loading}>
                    {loading ? '...' : 'Confirm'}
                </button>
            </form>
        </div>
    );
}
