// pool is not used here; remove unused import

/* ============================================================
   INVESTMENT QUERIES
   ============================================================ */

export async function insertInvestment(
    client,
    { userId, postId, amount }
) {
    const { rows } = await client.query(
        `
        INSERT INTO investments (user_id, post_id, amount)
        VALUES ($1, $2, $3)
        RETURNING *
        `,
        [userId, postId, amount]
    );

    return rows[0];
}

export async function updatePostFunding(client, postId, amount) {
    await client.query(
        `
        UPDATE posts
        SET amount_funded = amount_funded + $1
        WHERE id = $2
        `,
        [amount, postId]
    );
}
