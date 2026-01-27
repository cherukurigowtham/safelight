import { investInPost } from '../services/investments.service.js';

export async function invest(req, res, next) {
    try {
        const userId = req.user.id;
        const { postId, amount } = req.body;

        if (!postId || !amount || amount <= 0) {
            return res.status(400).json({ message: 'Invalid input' });
        }

        const investment = await investInPost({
            userId,
            postId,
            amount: Number(amount)
        });

        res.status(201).json({
            success: true,
            investment
        });

    } catch (err) {
        if (err.message === 'INSUFFICIENT_FUNDS') {
            return res.status(400).json({
                success: false,
                message: 'Insufficient balance'
            });
        }
        next(err);
    }
}
