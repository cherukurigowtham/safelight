import { getAllPosts, createPost } from '../repositories/posts.repository.js';

export function listPosts(filters) {
    return getAllPosts(filters);
}

export function createNewPost(data) {
    return createPost(data);
}
