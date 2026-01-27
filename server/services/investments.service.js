import { pool } from '../config/db.js';
import {
    getUserBalance,
    insertWalletTransaction
} from '../repositories/wallet.repository.js';

import {
    insertInvestment,
    updatePostFunding
} from '../repositories/investments.repository.js';

/* ============================================================
   INVESTMENT LOGIC (ATOMIC)
   ============================================================ */

export async function investInPost({ userId, postId, amount }) {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const balance = await getUserBalance(client, userId);

        if (balance < amount) {
            throw new Error('INSUFFICIENT_FUNDS');
        }

        const investment = await insertInvestment(client, {
            userId,
            postId,
            amount
        });

        await insertWalletTransaction(client, {
            userId,
            amount: -amount,
            type: 'INVEST',
            referenceId: investment.id
        });

        await updatePostFunding(client, postId, amount);

        await client.query('COMMIT');
        return investment;

    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
}
