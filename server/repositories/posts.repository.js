import { pool } from '../config/db.js';

/* ============================================================
   POSTS QUERIES
   ============================================================ */

export async function getAllPosts({ search, category }) {
    let query = `
        SELECT
            p.id,
            p.content,
            p.category,
            p.amount_needed,
            p.amount_funded,
            p.created_at,
            u.full_name AS author
        FROM posts p
        JOIN users u ON p.user_id = u.id
        WHERE 1 = 1
    `;
    const values = [];

    if (search) {
        values.push(`%${search}%`);
        query += ` AND p.content ILIKE $${values.length}`;
    }

    if (category) {
        values.push(category);
        query += ` AND p.category = $${values.length}`;
    }

    query += ` ORDER BY p.created_at DESC`;

    const { rows } = await pool.query(query, values);
    return rows;
}

export async function createPost({ userId, content, category, amountNeeded }) {
    const { rows } = await pool.query(
        `
        INSERT INTO posts (user_id, content, category, amount_needed)
        VALUES ($1, $2, $3, $4)
        RETURNING *
        `,
        [userId, content, category, amountNeeded]
    );

    return rows[0];
}
