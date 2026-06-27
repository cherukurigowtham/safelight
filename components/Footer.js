import Link from 'next/link';
import styles from '../styles/components/footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            <div className={styles.inner}>
                <div className={styles.copyright}>
                    © {new Date().getFullYear()} Invesa. All rights reserved.
                </div>
                <nav className={styles.nav}>
                    <Link href="/terms">Terms</Link>
                    <Link href="/privacy">Privacy</Link>
                    <Link href="/contact">Contact</Link>
                </nav>
            </div>
        </footer>
    );
}
