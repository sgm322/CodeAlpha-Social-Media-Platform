const express = require("express");
const path = require("node:path");
const db = require("./models/db");

const app = express();
const port = Number(process.env.PORT) || 3000;
const publicDirectory = path.join(__dirname, "..", "public");

app.use(express.json({ limit: "1mb" }));
app.use(express.static(publicDirectory));

function getUser(userId) {
  return db.prepare("SELECT * FROM users WHERE id = ?").get(userId);
}

function requireUser(userId, response) {
  const user = getUser(Number(userId));
  if (!user) {
    response.status(404).json({ error: "User not found." });
    return null;
  }
  return user;
}

function postSelect() {
  return db.prepare(`
    SELECT
      p.id,
      p.user_id AS userId,
      p.body,
      p.image_url AS imageUrl,
      p.created_at AS createdAt,
      u.name,
      u.handle,
      u.initials,
      u.avatar_color AS avatarColor,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likeCount,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS commentCount,
      EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = @viewerId) AS likedByMe
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE @postId IS NULL OR p.id = @postId
    ORDER BY p.created_at DESC, p.id DESC
  `);
}

function formatPost(post, viewerId, includeComments = false) {
  const result = { ...post, likedByMe: Boolean(post.likedByMe) };
  if (includeComments) {
    result.comments = db.prepare(`
      SELECT c.id, c.body, c.created_at AS createdAt,
        u.id AS userId, u.name, u.handle, u.initials, u.avatar_color AS avatarColor
      FROM comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC, c.id ASC
    `).all(post.id);
  }
  return result;
}

app.get("/api/bootstrap", (request, response) => {
  const viewerId = Number(request.query.userId || 1);
  const viewer = requireUser(viewerId, response);
  if (!viewer) return;

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS postCount,
      (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followerCount,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS followingCount
  `).get(viewerId, viewerId, viewerId);
  const posts = postSelect()
    .all({ viewerId, postId: null })
    .map((post) => formatPost(post, viewerId, true));
  const people = db.prepare(`
    SELECT u.id, u.name, u.handle, u.bio, u.initials,
      u.avatar_color AS avatarColor,
      EXISTS (
        SELECT 1 FROM follows WHERE follower_id = ? AND following_id = u.id
      ) AS followedByMe
    FROM users u
    WHERE u.id != ?
    ORDER BY followedByMe ASC, u.id ASC
  `).all(viewerId, viewerId).map((person) => ({
    ...person,
    followedByMe: Boolean(person.followedByMe),
  }));

  response.json({
    viewer: { ...viewer, ...stats, avatarColor: viewer.avatar_color },
    posts,
    people,
  });
});

app.get("/api/users/:id", (request, response) => {
  const viewerId = Number(request.query.viewerId || 1);
  const user = requireUser(request.params.id, response);
  if (!user) return;
  if (!requireUser(viewerId, response)) return;

  const stats = db.prepare(`
    SELECT
      (SELECT COUNT(*) FROM posts WHERE user_id = ?) AS postCount,
      (SELECT COUNT(*) FROM follows WHERE following_id = ?) AS followerCount,
      (SELECT COUNT(*) FROM follows WHERE follower_id = ?) AS followingCount
  `).get(user.id, user.id, user.id);
  const followedByMe = Boolean(db.prepare(
    "SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?",
  ).get(viewerId, user.id));
  const posts = db.prepare(`
    SELECT
      p.id,
      p.user_id AS userId,
      p.body,
      p.image_url AS imageUrl,
      p.created_at AS createdAt,
      u.name,
      u.handle,
      u.initials,
      u.avatar_color AS avatarColor,
      (SELECT COUNT(*) FROM likes WHERE post_id = p.id) AS likeCount,
      (SELECT COUNT(*) FROM comments WHERE post_id = p.id) AS commentCount,
      EXISTS (SELECT 1 FROM likes WHERE post_id = p.id AND user_id = ?) AS likedByMe
    FROM posts p
    JOIN users u ON u.id = p.user_id
    WHERE p.user_id = ?
    ORDER BY p.created_at DESC, p.id DESC
  `).all(viewerId, user.id).map((post) => formatPost(post, viewerId, true));

  response.json({
    user: {
      ...user,
      ...stats,
      avatarColor: user.avatar_color,
      followedByMe,
      isMe: viewerId === user.id,
    },
    posts,
  });
});

app.post("/api/posts", (request, response) => {
  const { userId, body, imageUrl } = request.body || {};
  const user = requireUser(userId, response);
  if (!user) return;
  if (typeof body !== "string" || !body.trim() || body.trim().length > 1000) {
    return response.status(400).json({ error: "Write a post between 1 and 1000 characters." });
  }
  if (imageUrl && (typeof imageUrl !== "string" || imageUrl.length > 2000)) {
    return response.status(400).json({ error: "Image URL must be 2000 characters or fewer." });
  }
  if (imageUrl) {
    try {
      const parsed = new URL(imageUrl);
      if (!["http:", "https:"].includes(parsed.protocol)) throw new Error("Unsupported protocol");
    } catch {
      return response.status(400).json({ error: "Enter a valid http or https image URL." });
    }
  }

  const result = db.prepare(
    "INSERT INTO posts (user_id, body, image_url) VALUES (?, ?, ?)",
  ).run(user.id, body.trim(), imageUrl || null);
  const post = postSelect().get({ viewerId: user.id, postId: result.lastInsertRowid });
  response.status(201).json(formatPost(post, user.id, true));
});

app.post("/api/posts/:id/comments", (request, response) => {
  const { userId, body } = request.body || {};
  const user = requireUser(userId, response);
  if (!user) return;
  const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(request.params.id);
  if (!post) return response.status(404).json({ error: "Post not found." });
  if (typeof body !== "string" || !body.trim() || body.trim().length > 500) {
    return response.status(400).json({ error: "Write a comment between 1 and 500 characters." });
  }

  const result = db.prepare(
    "INSERT INTO comments (post_id, user_id, body) VALUES (?, ?, ?)",
  ).run(post.id, user.id, body.trim());
  const comment = db.prepare(`
    SELECT c.id, c.body, c.created_at AS createdAt,
      u.id AS userId, u.name, u.handle, u.initials, u.avatar_color AS avatarColor
    FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?
  `).get(result.lastInsertRowid);
  response.status(201).json(comment);
});

app.post("/api/posts/:id/like", (request, response) => {
  const { userId } = request.body || {};
  const user = requireUser(userId, response);
  if (!user) return;
  const post = db.prepare("SELECT id FROM posts WHERE id = ?").get(request.params.id);
  if (!post) return response.status(404).json({ error: "Post not found." });

  const existing = db.prepare(
    "SELECT 1 FROM likes WHERE user_id = ? AND post_id = ?",
  ).get(user.id, post.id);
  if (existing) {
    db.prepare("DELETE FROM likes WHERE user_id = ? AND post_id = ?").run(user.id, post.id);
  } else {
    db.prepare("INSERT INTO likes (user_id, post_id) VALUES (?, ?)").run(user.id, post.id);
  }

  const likeCount = db.prepare("SELECT COUNT(*) AS count FROM likes WHERE post_id = ?")
    .get(post.id).count;
  response.json({ likedByMe: !existing, likeCount });
});

app.post("/api/users/:id/follow", (request, response) => {
  const { followerId } = request.body || {};
  const follower = requireUser(followerId, response);
  if (!follower) return;
  const target = requireUser(request.params.id, response);
  if (!target) return;
  if (follower.id === target.id) {
    return response.status(400).json({ error: "You cannot follow yourself." });
  }

  const existing = db.prepare(
    "SELECT 1 FROM follows WHERE follower_id = ? AND following_id = ?",
  ).get(follower.id, target.id);
  if (existing) {
    db.prepare("DELETE FROM follows WHERE follower_id = ? AND following_id = ?")
      .run(follower.id, target.id);
  } else {
    db.prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)")
      .run(follower.id, target.id);
  }
  const followerCount = db.prepare(
    "SELECT COUNT(*) AS count FROM follows WHERE following_id = ?",
  ).get(target.id).count;
  response.json({ followedByMe: !existing, followerCount });
});

app.use("/api", (request, response) => {
  response.status(404).json({ error: "API route not found." });
});

app.listen(port, () => {
  console.log(`Gather is running at http://localhost:${port}`);
});
