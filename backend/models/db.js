const Database = require("better-sqlite3");
const path = require("node:path");
const fs = require("node:fs");

const dataDirectory = path.join(__dirname, "..", "data");
fs.mkdirSync(dataDirectory, { recursive: true });

const db = new Database(path.join(dataDirectory, "gather.sqlite"));
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    handle TEXT NOT NULL UNIQUE,
    bio TEXT NOT NULL DEFAULT '',
    location TEXT NOT NULL DEFAULT '',
    initials TEXT NOT NULL,
    avatar_color TEXT NOT NULL DEFAULT '#8d3655',
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS posts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    image_url TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS likes (
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    post_id INTEGER NOT NULL REFERENCES posts(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, post_id)
  );

  CREATE TABLE IF NOT EXISTS follows (
    follower_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (follower_id, following_id),
    CHECK (follower_id != following_id)
  );

  CREATE INDEX IF NOT EXISTS posts_created_at_idx ON posts(created_at DESC);
  CREATE INDEX IF NOT EXISTS comments_post_id_idx ON comments(post_id, created_at);
  CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);
`);

const userCount = db.prepare("SELECT COUNT(*) AS count FROM users").get().count;

if (userCount === 0) {
  const seed = db.transaction(() => {
    const insertUser = db.prepare(`
      INSERT INTO users (name, handle, bio, location, initials, avatar_color)
      VALUES (@name, @handle, @bio, @location, @initials, @avatarColor)
    `);
    const users = [
      {
        name: "Alex Morgan",
        handle: "alexmorgan",
        bio: "Collecting little moments, good books, and places with really good coffee.",
        location: "Brooklyn, NY",
        initials: "AM",
        avatarColor: "#99516a",
      },
      {
        name: "Sofia Chen",
        handle: "sofiasays",
        bio: "Designing things for the internet. Usually looking for my next favorite cafe.",
        location: "Portland, OR",
        initials: "SC",
        avatarColor: "#c27a5a",
      },
      {
        name: "Marcus Reed",
        handle: "marcusreed",
        bio: "Photographer, weekend hiker, professional playlist maker.",
        location: "Austin, TX",
        initials: "MR",
        avatarColor: "#6d718a",
      },
      {
        name: "Priya Kapoor",
        handle: "priyainbloom",
        bio: "Plant person 🌿 Sharing slow mornings and small adventures.",
        location: "Chicago, IL",
        initials: "PK",
        avatarColor: "#758660",
      },
      {
        name: "Jamie Rivera",
        handle: "jamierivera",
        bio: "Making a life out of stories, Sunday dinners, and sunshine.",
        location: "Los Angeles, CA",
        initials: "JR",
        avatarColor: "#b47e48",
      },
    ];

    users.forEach((user) => insertUser.run(user));

    const insertPost = db.prepare(`
      INSERT INTO posts (user_id, body, image_url, created_at)
      VALUES (?, ?, ?, datetime('now', ?))
    `);
    const posts = [
      [
        2,
        "A little reminder that the best plans sometimes happen when you leave a few hours unplanned. Found this tiny bookshop on my walk and lost track of time in the best way.",
        "https://images.unsplash.com/photo-1507842217343-583bb7270b66?auto=format&fit=crop&w=1200&q=85",
        "-18 minutes",
      ],
      [
        3,
        "Saturday looked a little like this. Took the long way home and I'm very glad I did.",
        "https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=85",
        "-2 hours",
      ],
      [
        4,
        "A few new leaves on the windowsill and suddenly the whole week feels brighter. What's growing at your place?",
        null,
        "-5 hours",
      ],
    ];
    posts.forEach((post) => insertPost.run(...post));

    const insertComment = db.prepare(`
      INSERT INTO comments (post_id, user_id, body, created_at)
      VALUES (?, ?, ?, datetime('now', ?))
    `);
    insertComment.run(1, 1, "This is exactly the kind of afternoon I needed to hear about.", "-12 minutes");
    insertComment.run(1, 5, "Adding this to my weekend wish list ✨", "-8 minutes");
    insertComment.run(2, 2, "That light is unreal. Where was this?", "-1 hour");

    const insertLike = db.prepare("INSERT INTO likes (user_id, post_id) VALUES (?, ?)");
    [[1, 1], [3, 1], [4, 1], [1, 2], [2, 2], [5, 2], [2, 3], [3, 3]].forEach(
      ([userId, postId]) => insertLike.run(userId, postId),
    );

    const insertFollow = db.prepare("INSERT INTO follows (follower_id, following_id) VALUES (?, ?)");
    [[1, 2], [1, 3], [1, 4], [2, 1], [3, 1], [4, 1], [5, 1]].forEach(
      ([followerId, followingId]) => insertFollow.run(followerId, followingId),
    );
  });

  seed();
}

module.exports = db;
