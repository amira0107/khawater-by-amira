document.addEventListener("DOMContentLoaded", loadPosts);

function submitPost() {
  const content = document.getElementById("postInput").value.trim();
  const mood = document.getElementById("moodSelect").value;

  if (!content) return alert("يرجى كتابة همسة!");

  const post = {
    content,
    mood,
    date: new Date().toLocaleString("ar-EG")
  };

  const posts = JSON.parse(localStorage.getItem("posts") || "[]");
  posts.unshift(post);
  localStorage.setItem("posts", JSON.stringify(posts));

  document.getElementById("postInput").value = "";
  loadPosts();
}

function loadPosts() {
  const posts = JSON.parse(localStorage.getItem("posts") || "[]");
  const container = document.getElementById("postsContainer");
  container.innerHTML = "";

  posts.forEach(post => {
    const div = document.createElement("div");
    div.className = "post";
    div.innerHTML = `
      <div><strong>${post.mood}</strong> – <small>${post.date}</small></div>
      <div>${post.content}</div>
    `;
    container.appendChild(div);
  });
}
