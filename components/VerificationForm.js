import { useState } from 'react';
import styles from '../styles/components/verification.module.css';

export default function VerificationForm() {
    const [verified, setVerified] = useState(false);

    function handleSubmit(e) {
        e.preventDefault();
        setTimeout(() => setVerified(true), 1500);
    }

    return (
        <div className={styles.container}>
            <h3 className={styles.title}>Verify Your Identity</h3>
            <p className={styles.subtitle}>Upload your PAN card</p>

            {verified ? (
                <div className={styles.success}>✓ Verified</div>
            ) : (
                <form onSubmit={handleSubmit}>
                    <input type="file" required />
                    <button className={styles.button}>Upload</button>
                </form>
            )}
        </div>
    );
}
