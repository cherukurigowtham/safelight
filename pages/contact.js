import Head from 'next/head';
import Header from '../components/Header';
import Footer from '../components/Footer';
import ContactForm from '../components/ContactForm';
import styles from '../styles/Contact.module.css';

export default function Contact() {
    return (
        <>
            <Head>
                <title>Contact Us - Invesa</title>
            </Head>

            <Header />

            <main className={styles.main}>
                <ContactForm />
            </main>

            <Footer />
        </>
    );
}
