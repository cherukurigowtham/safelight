import { useEffect, useRef, useState } from 'react';
import styles from '../styles/components/chatModal.module.css';
import { API_BASE_URL } from '../config';

export default function ChatModal({ business, isOpen, onClose }) {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    useEffect(() => {
        if (!isOpen || !business) return;
        async function fetchMessages() {
            const res = await fetch(
                `${API_BASE_URL}/api/messages/${business.id}`,
                { credentials: 'include' }
            );
            const data = await res.json();
            if (data.success) setMessages(data.messages);
        }

        fetchMessages();
        const interval = setInterval(fetchMessages, 3000);
        return () => clearInterval(interval);
    }, [isOpen, business]);

    async function handleSend(e) {
        e.preventDefault();
        if (!newMessage.trim()) return;

        await fetch(`${API_BASE_URL}/api/messages`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            credentials: 'include',
            body: JSON.stringify({
                businessId: business.id,
                text: newMessage
            })
        });

        setNewMessage('');
        fetchMessages();
    }

    if (!isOpen) return null;

    return (
        <div className={styles.overlay}>
            <div className={styles.header}>
                <h3 className={styles.headerTitle}>{business.author}</h3>
                <button onClick={onClose}>×</button>
            </div>

            <div className={styles.messages}>
                {messages.map(msg => (
                    <div
                        key={msg.id}
                        className={
                            msg.isFromBusiness
                                ? styles.messageLeft
                                : styles.messageRight
                        }
                    >
                        {msg.text}
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className={styles.inputRow}>
                <input
                    className={styles.input}
                    value={newMessage}
                    onChange={e => setNewMessage(e.target.value)}
                />
                <button className={styles.sendButton}>→</button>
            </form>
        </div>
    );
}
