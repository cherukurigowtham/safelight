import { useState } from 'react';
import styles from '../styles/components/investmentForm.module.css';

export default function InvestmentForm({ businessName, onConfirm }) {
    const [amount, setAmount] = useState('');

    function handleSubmit(e) {
        e.preventDefault();
        onConfirm(Number(amount));
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
                <button className={styles.button}>Confirm</button>
            </form>
        </div>
    );
}
