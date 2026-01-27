import styles from '../styles/PostCard.module.css';

/* ============================================================
   Component
   ============================================================ */

export default function PostCard({
    id,
    author,
    content,
    amountFunded,
    category,
    likes,
    onLike
}) {
    return (
        <div className={styles.card}>
            <span className={styles.categoryBadge}>{category}</span>

            <div className={styles.header}>
                <h3>{author}</h3>
                <span className={styles.funded}>₹{amountFunded} funded</span>
            </div>

            <p className={styles.content}>{content}</p>

            <div className={styles.actions}>
                <button
                    className={styles.investBtn}
                    type="button"
                >
                    Invest
                </button>

                <button
                    type="button"
                    onClick={() => onLike(id)}
                    className={styles.likeBtn}
                >
                    ❤️ {likes || 0}
                </button>
            </div>
        </div>
    );
}
