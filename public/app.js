const state = {
  userId: Number(localStorage.getItem("gatherUserId")) || 1,
  viewer: null,
  posts: [],
  people: [],
  feed: "all",
  newestFirst: true,
  search: "",
};

const feedList = document.querySelector("#feed-list");
const toastElement = document.querySelector("#toast");
const dialog = document.querySelector("#profile-dialog");
let toastTimeout;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function initialsAvatar(initials, color, size = "avatar-small") {
  return `<span class="avatar ${size}" style="background:${escapeHtml(color)}">${escapeHtml(initials)}</span>`;
}

function formatRelativeDate(value) {
  const parsed = new Date(`${value.replace(" ", "T")}Z`);
  const minutes = Math.max(0, Math.floor((Date.now() - parsed.getTime()) / 60000));
  if (!Number.isFinite(minutes)) return "just now";
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h ago`;
  return `${Math.floor(minutes / 1440)}d ago`;
}

async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...options.headers,
    },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Something went wrong. Please try again.");
  return result;
}

function showToast(message) {
  toastElement.textContent = message;
  toastElement.classList.add("visible");
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toastElement.classList.remove("visible"), 2600);
}

function renderViewer() {
  const viewer = state.viewer;
  document.querySelector("#welcome-name").textContent = viewer.name.split(" ")[0];
  document.querySelector("#composer-name").textContent = viewer.name.split(" ")[0];
  document.querySelector("#composer-avatar").textContent = viewer.initials;
  document.querySelector("#composer-avatar").style.background = viewer.avatarColor;
  const miniProfile = document.querySelector("#top-profile");
  miniProfile.textContent = viewer.initials;
  miniProfile.style.background = viewer.avatarColor;
  miniProfile.style.color = "#fff";
  miniProfile.style.fontSize = "10px";
  document.querySelector("#sidebar-profile").innerHTML = `
    ${initialsAvatar(viewer.initials, viewer.avatarColor)}
    <span class="profile-copy"><strong>${escapeHtml(viewer.name)}</strong><span>@${escapeHtml(viewer.handle)}</span></span>
  `;
  document.querySelector("#profile-card-avatar").textContent = viewer.initials;
  document.querySelector("#profile-card-avatar").style.background = viewer.avatarColor;
  document.querySelector("#profile-card-name").textContent = viewer.name;
  document.querySelector("#profile-card-handle").textContent = `@${viewer.handle}`;
  document.querySelector("#profile-card-bio").textContent = viewer.bio;
  document.querySelector("#profile-post-count").textContent = viewer.postCount;
  document.querySelector("#profile-follower-count").textContent = viewer.followerCount;
  document.querySelector("#profile-following-count").textContent = viewer.followingCount;
  document.querySelector("#following-count").textContent = viewer.followingCount;
  document.querySelector("#followers-count").textContent = viewer.followerCount;
}

function filteredPosts() {
  const followedIds = new Set(
    state.people.filter((person) => person.followedByMe).map((person) => person.id),
  );
  let posts = state.posts.filter((post) => {
    const matchesFeed = state.feed === "all" || post.userId === state.userId || followedIds.has(post.userId);
    const haystack = `${post.body} ${post.name} @${post.handle}`.toLowerCase();
    return matchesFeed && haystack.includes(state.search.toLowerCase());
  });
  if (!state.newestFirst) posts = [...posts].reverse();
  return posts;
}

function renderComment(comment) {
  return `
    <div class="comment">
      ${initialsAvatar(comment.initials, comment.avatarColor, "avatar-tiny")}
      <div class="comment-content">
        <button class="comment-author" data-profile="${comment.userId}">${escapeHtml(comment.name)}</button>
        ${escapeHtml(comment.body)}
      </div>
    </div>
  `;
}

function renderPost(post) {
  const image = post.imageUrl
    ? `<img class="post-image" src="${escapeHtml(post.imageUrl)}" alt="Photo shared by ${escapeHtml(post.name)}" loading="lazy" />`
    : "";
  const comments = (post.comments || []).map(renderComment).join("");
  return `
    <article class="post-card card" data-post-id="${post.id}">
      <div class="post-header">
        ${initialsAvatar(post.initials, post.avatarColor)}
        <div class="post-author">
          <button data-profile="${post.userId}">${escapeHtml(post.name)}</button>
          <span class="post-meta">@${escapeHtml(post.handle)} · ${formatRelativeDate(post.createdAt)}</span>
        </div>
        <button class="post-menu" aria-label="More post options">···</button>
      </div>
      <p class="post-body">${escapeHtml(post.body)}</p>
      ${image}
      <div class="post-counts">
        <span class="like-bubbles">
          ${post.likeCount ? '<span class="like-bubble">♥</span><span class="like-bubble">✳</span>' : ""}
          <span class="count-text">${post.likeCount ? `${post.likeCount} ${post.likeCount === 1 ? "person" : "people"} liked this` : "Be the first to like this"}</span>
        </span>
        <span>${post.commentCount} ${post.commentCount === 1 ? "comment" : "comments"}</span>
      </div>
      <div class="post-actions">
        <button class="post-action like-action ${post.likedByMe ? "liked" : ""}" data-action="like" aria-label="${post.likedByMe ? "Unlike" : "Like"} post">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 8.7c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10A4.7 4.7 0 0 1 12 6.2a4.7 4.7 0 0 1 8.8 2.5Z"></path></svg>
          <span>${post.likedByMe ? "Liked" : "Like"}</span>
        </button>
        <button class="post-action comment-action" data-action="comments">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11.5a7.5 7.5 0 0 1-8 7.5 8.6 8.6 0 0 1-3.5-.7L4 20l1.5-3.6A7.2 7.2 0 0 1 4 11.5 7.5 7.5 0 0 1 12 4a7.5 7.5 0 0 1 8 7.5Z"></path></svg>
          <span>Comment</span>
        </button>
        <button class="post-action share-action" data-action="share">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4m0 0L7 9m5-5 5 5M5 14v5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-5"></path></svg>
          <span>Share</span>
        </button>
      </div>
      <div class="comments">
        ${comments}
        <form class="comment-form">
          ${initialsAvatar(state.viewer.initials, state.viewer.avatarColor, "avatar-tiny")}
          <input name="comment" maxlength="500" placeholder="Write a kind comment..." aria-label="Write a comment" required />
          <button type="submit">Send</button>
        </form>
      </div>
    </article>
  `;
}

function renderFeed() {
  const posts = filteredPosts();
  feedList.innerHTML = posts.length
    ? posts.map(renderPost).join("")
    : `<div class="empty-state">${state.search ? "No moments match your search yet." : state.feed === "following" ? "Follow a few people and their moments will show up here." : "It’s quiet here for now. Share the first little moment."}</div>`;
}

function renderPeople() {
  const people = state.people.filter((person) => {
    const needle = state.search.toLowerCase();
    return `${person.name} @${person.handle} ${person.bio}`.toLowerCase().includes(needle);
  });
  const visiblePeople = people.slice(0, 4);
  document.querySelector("#people-list").innerHTML = visiblePeople.map((person) => `
    <div class="person-row">
      <button class="person-avatar-button" data-profile="${person.id}" aria-label="View ${escapeHtml(person.name)}'s profile">
        ${initialsAvatar(person.initials, person.avatarColor)}
      </button>
      <div class="person-copy">
        <button data-profile="${person.id}">${escapeHtml(person.name)}</button>
        <span>@${escapeHtml(person.handle)}</span>
      </div>
      <button class="follow-button ${person.followedByMe ? "following" : ""}" data-follow="${person.id}" aria-label="${person.followedByMe ? "Unfollow" : "Follow"} ${escapeHtml(person.name)}">
        ${person.followedByMe ? "✓" : "+"}
      </button>
    </div>
  `).join("") || `<div class="empty-state">No people found.</div>`;
}

function updateDate() {
  const date = new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date());
  document.querySelector("#date-stamp").textContent = date.toUpperCase();
}

async function loadApp() {
  try {
    const data = await api(`/api/bootstrap?userId=${state.userId}`);
    state.viewer = data.viewer;
    state.posts = data.posts;
    state.people = data.people;
    renderViewer();
    renderFeed();
    renderPeople();
    updateDate();
  } catch (error) {
    feedList.innerHTML = `<div class="empty-state">${escapeHtml(error.message)} Start the app with <code>npm start</code>.</div>`;
  }
}

async function refreshViewer() {
  const data = await api(`/api/bootstrap?userId=${state.userId}`);
  state.viewer = data.viewer;
  state.people = data.people;
  state.posts = data.posts;
  renderViewer();
  renderFeed();
  renderPeople();
}

async function openProfile(userId) {
  try {
    const { user, posts } = await api(`/api/users/${userId}?viewerId=${state.userId}`);
    document.querySelector("#profile-dialog-content").innerHTML = `
      <div class="dialog-cover"></div>
      <div class="dialog-person">
        <div class="dialog-avatar" style="background:${escapeHtml(user.avatar_color)}">${escapeHtml(user.initials)}</div>
        <h2>${escapeHtml(user.name)}</h2>
        <div class="dialog-handle">@${escapeHtml(user.handle)}${user.location ? ` · ${escapeHtml(user.location)}` : ""}</div>
        <p>${escapeHtml(user.bio)}</p>
        <div class="dialog-meta"><span><strong>${user.postCount}</strong> posts</span><span><strong>${user.followerCount}</strong> followers</span><span><strong>${user.followingCount}</strong> following</span></div>
        ${user.isMe ? "" : `<button class="primary-button dialog-follow follow-button ${user.followedByMe ? "following" : ""}" data-follow="${user.id}">${user.followedByMe ? "Following ✓" : "Follow +"}</button>`}
        <h3 class="dialog-posts-heading">Little moments</h3>
        <div class="dialog-post-list">${posts.length ? posts.map((post) => `<div class="dialog-post">${escapeHtml(post.body)}<br /><span class="post-meta">${formatRelativeDate(post.createdAt)} · ♥ ${post.likeCount} · ${post.commentCount} comments</span></div>`).join("") : '<div class="empty-state">No posts just yet.</div>'}</div>
      </div>
    `;
    dialog.showModal();
  } catch (error) {
    showToast(error.message);
  }
}

document.querySelector("#post-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const bodyInput = document.querySelector("#post-body");
  const imageInput = document.querySelector("#image-url");
  const button = document.querySelector("#publish-button");
  button.disabled = true;
  try {
    const post = await api("/api/posts", {
      method: "POST",
      body: JSON.stringify({ userId: state.userId, body: bodyInput.value, imageUrl: imageInput.value.trim() || null }),
    });
    state.posts.unshift(post);
    bodyInput.value = "";
    imageInput.value = "";
    document.querySelector(".composer-image-field").classList.remove("open");
    await refreshViewer();
    showToast("Your moment is out in the world ✨");
  } catch (error) {
    showToast(error.message);
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#add-image-button").addEventListener("click", () => {
  const field = document.querySelector(".composer-image-field");
  field.classList.toggle("open");
  if (field.classList.contains("open")) document.querySelector("#image-url").focus();
});
document.querySelector("#composer-focus").addEventListener("click", () => document.querySelector("#post-body").focus());

feedList.addEventListener("click", async (event) => {
  const action = event.target.closest("[data-action]");
  if (!action) return;
  const card = action.closest("[data-post-id]");
  const post = state.posts.find((item) => item.id === Number(card.dataset.postId));
  if (action.dataset.action === "like") {
    action.disabled = true;
    try {
      const result = await api(`/api/posts/${post.id}/like`, {
        method: "POST",
        body: JSON.stringify({ userId: state.userId }),
      });
      post.likedByMe = result.likedByMe;
      post.likeCount = result.likeCount;
      renderFeed();
    } catch (error) {
      showToast(error.message);
    }
  } else if (action.dataset.action === "comments") {
    card.querySelector(".comments").classList.toggle("open");
    if (card.querySelector(".comments").classList.contains("open")) {
      card.querySelector(".comment-form input").focus();
    }
  } else if (action.dataset.action === "share") {
    try {
      await navigator.clipboard.writeText(`${location.origin}/#post-${post.id}`);
      showToast("Link copied. Share the good stuff!");
    } catch {
      showToast("Your post is ready to share.");
    }
  }
});

feedList.addEventListener("error", (event) => {
  if (event.target.matches(".post-image")) event.target.classList.add("image-error");
}, true);

feedList.addEventListener("submit", async (event) => {
  if (!event.target.matches(".comment-form")) return;
  event.preventDefault();
  const form = event.target;
  const card = form.closest("[data-post-id]");
  const post = state.posts.find((item) => item.id === Number(card.dataset.postId));
  const input = form.elements.comment;
  try {
    const comment = await api(`/api/posts/${post.id}/comments`, {
      method: "POST",
      body: JSON.stringify({ userId: state.userId, body: input.value }),
    });
    post.comments.push(comment);
    post.commentCount += 1;
    renderFeed();
    feedList.querySelector(`[data-post-id="${post.id}"] .comments`).classList.add("open");
  } catch (error) {
    showToast(error.message);
  }
});

async function toggleFollow(targetId) {
  try {
    await api(`/api/users/${targetId}/follow`, {
      method: "POST",
      body: JSON.stringify({ followerId: state.userId }),
    });
    const isOpenProfile = dialog.open;
    await refreshViewer();
    if (isOpenProfile) await openProfile(targetId);
    showToast(state.people.find((person) => person.id === targetId)?.followedByMe ? "You’re connected now ✨" : "You unfollowed this person.");
  } catch (error) {
    showToast(error.message);
  }
}

document.addEventListener("click", (event) => {
  const followButton = event.target.closest("[data-follow]");
  if (followButton) {
    event.preventDefault();
    toggleFollow(Number(followButton.dataset.follow));
    return;
  }
  if (event.target.closest("[data-profile]")) {
    openProfile(Number(event.target.closest("[data-profile]").dataset.profile));
  }
});

document.querySelector("#search-input").addEventListener("input", (event) => {
  state.search = event.target.value.trim();
  renderFeed();
  renderPeople();
});

document.querySelectorAll(".feed-tab").forEach((tab) => tab.addEventListener("click", () => {
  state.feed = tab.dataset.feed;
  document.querySelectorAll(".feed-tab").forEach((item) => item.classList.toggle("active", item === tab));
  renderFeed();
}));

document.querySelector("#sort-button").addEventListener("click", (event) => {
  state.newestFirst = !state.newestFirst;
  event.currentTarget.innerHTML = `<span class="sort-glyph">↕</span> ${state.newestFirst ? "Latest" : "Oldest"}`;
  renderFeed();
});

document.querySelector("#explore-button").addEventListener("click", () => {
  document.querySelector("#search-input").focus();
  showToast("Search for a person or a moment.");
});
document.querySelector("#home-button").addEventListener("click", () => {
  state.search = "";
  document.querySelector("#search-input").value = "";
  state.feed = "all";
  document.querySelectorAll(".feed-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.feed === "all"));
  renderFeed();
  renderPeople();
});
document.querySelector("#saved-button").addEventListener("click", () => showToast("Saved moments are coming soon."));
document.querySelector("#see-all-people").addEventListener("click", () => {
  document.querySelector("#search-input").focus();
  document.querySelector("#search-input").value = "";
  state.search = "";
  renderPeople();
});
document.querySelector("#top-profile").addEventListener("click", () => openProfile(state.userId));
document.querySelector("#sidebar-profile").addEventListener("click", () => openProfile(state.userId));
document.querySelector("#profile-card-avatar").addEventListener("click", () => openProfile(state.userId));
document.querySelector("#view-profile-button").addEventListener("click", () => openProfile(state.userId));
document.querySelector("#edit-profile").addEventListener("click", () => openProfile(state.userId));
document.querySelector("#dialog-close").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
document.querySelector("#following-link").addEventListener("click", () => {
  state.feed = "following";
  document.querySelectorAll(".feed-tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.feed === "following"));
  renderFeed();
});
document.querySelector("#followers-link").addEventListener("click", () => {
  showToast(`${state.viewer.followerCount} people are in your corner ✨`);
});
document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector("#search-input").focus();
  }
});

loadApp();
