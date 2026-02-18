const loginForm = document.getElementById("loginForm");
const loginError = document.getElementById("loginError");

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginError.style.display = "none";

  const email = document.getElementById("inputEmail").value.trim();
  const password = document.getElementById("inputPassword").value.trim();

  if (!email || !password) {
    loginError.textContent = "Email and password are required.";
    loginError.style.display = "block";
    return;
  }

  try {
    const response = await fetch("http://localhost:3001/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();
    console.log("Gelen login yanıtı:", data);

    if (!response.ok) {
      loginError.textContent = data.error || "Login failed. Please try again.";
      loginError.style.display = "block";
      return;
    }

    // Use sessionStorage so the session ends when the tab/window is closed
    sessionStorage.setItem("token", data.token);
    sessionStorage.setItem("user_token", data.userToken);
    sessionStorage.setItem("user_fullname", `${data.user.firstName} ${data.user.lastName}`);
    sessionStorage.setItem("user", JSON.stringify(data.user));
    sessionStorage.setItem("user_data", JSON.stringify(data.user));
    console.log("Session storage set for user_token:", data.userToken);
    // Remove any lingering localStorage auth keys (in case an old session existed)
    try {
      localStorage.removeItem('token');
      localStorage.removeItem('user_token');
      localStorage.removeItem('user');
      localStorage.removeItem('user_data');
      localStorage.removeItem('user_fullname');
    } catch (e) {}
  window.location.href = "index.html";
  } catch (err) {
    console.error("Login error:", err);
    loginError.textContent = "Unable to connect to server.";
    loginError.style.display = "block";
  }
});