import styles from '../styles/components/footer.module.css';

export default function Footer() {
    return (
        <footer className={styles.footer}>
            © {new Date().getFullYear()} Invesa. All rights reserved.
        </footer>
    );
}
