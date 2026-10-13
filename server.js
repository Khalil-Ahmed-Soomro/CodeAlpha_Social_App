const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const DB_FILE = path.join(__dirname, 'db.json');

// Initialize JSON Database
function getDb() {
    if (!fs.existsSync(DB_FILE)) {
        const initialData = {
            users: [
                { id: 1, username: 'khalil_ahmed', name: 'Khalil Ahmed', bio: 'Full-stack developer & tech enthusiast!' },
                { id: 2, username: 'sarah_dev', name: 'Sarah Jenkins', bio: 'Coding and building web apps.' }
            ],
            posts: [
                { id: 1, user_id: 1, content: 'Welcome to Pulse! Building a mini social media app with Node.js and Express.', created_at: new Date().toISOString() }
            ],
            comments: [],
            likes: [],
            follows: []
        };
        fs.writeFileSync(DB_FILE, JSON.stringify(initialData, null, 2));
    }
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function saveDb(data) {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// --- API ENDPOINTS ---

app.get('/api/users', (req, res) => {
    const db = getDb();
    res.json(db.users);
});

app.get('/api/users/:id', (req, res) => {
    const db = getDb();
    const userId = parseInt(req.params.id);
    const user = db.users.find(u => u.id === userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const followersCount = db.follows.filter(f => f.following_id === userId).length;
    const followingCount = db.follows.filter(f => f.follower_id === userId).length;

    res.json({ ...user, followersCount, followingCount });
});

app.get('/api/posts', (req, res) => {
    const db = getDb();
    const currentUserId = parseInt(req.query.userId || 1);

    const postsWithDetails = db.posts.map(p => {
        const author = db.users.find(u => u.id === p.user_id) || { username: 'unknown', name: 'Unknown' };
        const likesCount = db.likes.filter(l => l.post_id === p.id).length;
        const userLiked = db.likes.some(l => l.post_id === p.id && l.user_id === currentUserId) ? 1 : 0;
        const commentsCount = db.comments.filter(c => c.post_id === p.id).length;

        return {
            ...p,
            username: author.username,
            author_name: author.name,
            likes_count: likesCount,
            user_liked: userLiked,
            comments_count: commentsCount
        };
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    res.json(postsWithDetails);
});

app.post('/api/posts', (req, res) => {
    const db = getDb();
    const { user_id, content } = req.body;
    if (!content) return res.status(400).json({ error: 'Content is required' });

    const newPost = {
        id: db.posts.length > 0 ? Math.max(...db.posts.map(p => p.id)) + 1 : 1,
        user_id: user_id || 1,
        content,
        created_at: new Date().toISOString()
    };

    db.posts.push(newPost);
    saveDb(db);
    res.json(newPost);
});

app.post('/api/posts/:id/like', (req, res) => {
    const db = getDb();
    const postId = parseInt(req.params.id);
    const { user_id } = req.body;

    const existingIndex = db.likes.findIndex(l => l.user_id === user_id && l.post_id === postId);
    if (existingIndex > -1) {
        db.likes.splice(existingIndex, 1);
        saveDb(db);
        res.json({ liked: false });
    } else {
        db.likes.push({ user_id, post_id: postId });
        saveDb(db);
        res.json({ liked: true });
    }
});

app.get('/api/posts/:id/comments', (req, res) => {
    const db = getDb();
    const postId = parseInt(req.params.id);
    const postComments = db.comments
        .filter(c => c.post_id === postId)
        .map(c => {
            const author = db.users.find(u => u.id === c.user_id) || { username: 'unknown', name: 'Unknown' };
            return { ...c, username: author.username, author_name: author.name };
        });

    res.json(postComments);
});

app.post('/api/posts/:id/comments', (req, res) => {
    const db = getDb();
    const postId = parseInt(req.params.id);
    const { user_id, content } = req.body;
    if (!content) return res.status(400).json({ error: 'Comment cannot be empty' });

    const newComment = {
        id: db.comments.length > 0 ? Math.max(...db.comments.map(c => c.id)) + 1 : 1,
        post_id: postId,
        user_id,
        content,
        created_at: new Date().toISOString()
    };

    db.comments.push(newComment);
    saveDb(db);
    res.json(newComment);
});

app.post('/api/follow', (req, res) => {
    const db = getDb();
    const { follower_id, following_id } = req.body;
    if (follower_id === following_id) return res.status(400).json({ error: "Cannot follow yourself" });

    const existingIndex = db.follows.findIndex(f => f.follower_id === follower_id && f.following_id === following_id);
    if (existingIndex > -1) {
        db.follows.splice(existingIndex, 1);
        saveDb(db);
        res.json({ following: false });
    } else {
        db.follows.push({ follower_id, following_id });
        saveDb(db);
        res.json({ following: true });
    }
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});

// Register a new user
app.post('/api/users', (req, res) => {
    const db = getDb();
    const { username, name, bio } = req.body;
    
    if (!username || !name) {
        return res.status(400).json({ error: 'Username and name are required' });
    }

    // Check if username already exists
    const existing = db.users.find(u => u.username === username);
    if (existing) {
        return res.status(400).json({ error: 'Username already taken' });
    }

    const newUser = {
        id: db.users.length > 0 ? Math.max(...db.users.map(u => u.id)) + 1 : 1,
        username,
        name,
        bio: bio || ''
    };

    db.users.push(newUser);
    saveDb(db);
    res.json(newUser);
});