import { listPosts, createNewPost } from '../services/posts.service.js';

export async function getPosts(req, res, next) {
    try {
        const { search, category } = req.query;

        const posts = await listPosts({
            search,
            category: category === 'All' ? null : category
        });

        res.json(posts);
    } catch (err) {
        next(err);
    }
}

export async function createPost(req, res, next) {
    try {
        const userId = req.user.id;
        const { content, category, amountNeeded } = req.body;

        if (!content || !category || !amountNeeded) {
            return res.status(400).json({ message: 'Missing fields' });
        }

        const post = await createNewPost({
            userId,
            content,
            category,
            amountNeeded
        });

        res.status(201).json(post);
    } catch (err) {
        next(err);
    }
}
