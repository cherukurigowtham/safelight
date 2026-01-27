import styles from '../styles/Contact.module.css';

export default function ContactForm() {
    return (
        <div className={styles.card}>

            <h1 className={styles.title}>
                Get in Touch
            </h1>

            <p className={styles.subtitle}>
                We&apos;d love to hear from you. Fill out the form below.
            </p>

            <form onSubmit={(e) => e.preventDefault()}>

                <div className={styles.field}>
                    <label className={styles.label}>Name</label>
                    <input
                        type="text"
                        placeholder="Your Name"
                        className={styles.input}
                    />
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Email</label>
                    <input
                        type="email"
                        placeholder="you@example.com"
                        className={styles.input}
                    />
                </div>

                <div className={styles.field}>
                    <label className={styles.label}>Message</label>
                    <textarea
                        rows={4}
                        placeholder="How can we help?"
                        className={`${styles.input} ${styles.textarea}`}
                    />
                </div>

                <button type="submit" className={styles.button}>
                    Send Message
                </button>

            </form>

            <div className={styles.footer}>
                <p className={styles.footerLine}>
                    Email: Helpdesk@invesa.com
                </p>
                <p>
                    Address: 123 Finance District, Hyderabad, India
                </p>
            </div>

        </div>
    );
}
