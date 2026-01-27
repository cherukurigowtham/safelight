// pool is not used here; remove unused import

/* ============================================================
   WALLET QUERIES
   ============================================================ */

export async function getUserBalance(client, userId) {
    const { rows } = await client.query(
        `
        SELECT COALESCE(SUM(amount), 0) AS balance
        FROM wallet_transactions
        WHERE user_id = $1
        `,
        [userId]
    );

    return Number(rows[0].balance);
}

export async function insertWalletTransaction(
    client,
    { userId, amount, type, referenceId }
) {
    await client.query(
        `
        INSERT INTO wallet_transactions (user_id, amount, type, reference_id)
        VALUES ($1, $2, $3, $4)
        `,
        [userId, amount, type, referenceId]
    );
}
