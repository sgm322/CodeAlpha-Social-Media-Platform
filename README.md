# Gather

Gather is a small social app with a burgundy-and-blush interface, a vanilla HTML/CSS/JavaScript frontend, an Express API, and a persistent SQLite database.

## Run locally

Use Node.js 20 or newer.

```sh
npm install
npm start
```

Open [http://localhost:3000](http://localhost:3000). The first run creates `backend/data/gather.sqlite` and seeds a few demo accounts and posts. The database file is created automatically and is not committed.

## Features

- Browse a feed, search posts and people, and switch between the full and following feeds.
- Publish text posts with an optional image URL, comment, like, and follow/unfollow people.
- Open profiles to view their bio, location, follower counts, and posts.
- Responsive layouts for desktop and mobile.

The demo opens as Alex Morgan (`@alexmorgan`). This project does not include sign-in; API writes identify the demo viewer by user ID.

## API

- `GET /api/bootstrap?userId=1` — viewer profile, feed posts, comments, and people to follow.
- `GET /api/users/:id?viewerId=1` — profile and posts.
- `POST /api/posts` — `{ "userId": 1, "body": "Hello!", "imageUrl": null }`.
- `POST /api/posts/:id/comments` — `{ "userId": 1, "body": "Lovely!" }`.
- `POST /api/posts/:id/like` — `{ "userId": 1 }`; toggles the like.
- `POST /api/users/:id/follow` — `{ "followerId": 1 }`; toggles the follow.

Set `PORT` to change the default port (`3000`).
