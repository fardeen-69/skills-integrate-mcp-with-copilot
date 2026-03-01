document.addEventListener("DOMContentLoaded", () => {
  const activitiesList = document.getElementById("activities-list");
  const activitySelect = document.getElementById("activity");
  const signupForm = document.getElementById("signup-form");
  const messageDiv = document.getElementById("message");
  const userBtn = document.getElementById("user-btn");
  const loginModal = document.getElementById("login-modal");
  const closeLoginBtn = document.getElementById("close-login");
  const loginForm = document.getElementById("login-form");
  const userStatus = document.getElementById("user-status");
  const loginError = document.getElementById("login-error");

  let currentToken = null;
  let isLoggedIn = false;

  // Check auth status on load
  async function checkAuthStatus() {
    const token = localStorage.getItem("authToken");
    if (token) {
      try {
        const response = await fetch(`/auth/status?token=${encodeURIComponent(token)}`);
        const data = await response.json();
        if (data.authenticated) {
          currentToken = token;
          isLoggedIn = true;
          updateUserStatus(data.username);
        } else {
          localStorage.removeItem("authToken");
        }
      } catch (error) {
        console.error("Error checking auth status:", error);
      }
    }
  }

  // Update user status display
  function updateUserStatus(username) {
    userStatus.textContent = `Logged in as: ${username}`;
    userStatus.classList.remove("hidden");
  }

  // Clear user status
  function clearUserStatus() {
    userStatus.classList.add("hidden");
    userStatus.textContent = "Not logged in";
  }

  // Open login modal
  userBtn.addEventListener("click", () => {
    if (isLoggedIn) {
      // Show logout option
      if (confirm("Do you want to logout?")) {
        logout();
      }
    } else {
      loginModal.classList.remove("hidden");
      document.getElementById("username").focus();
    }
  });

  // Close login modal
  closeLoginBtn.addEventListener("click", () => {
    loginModal.classList.add("hidden");
    loginError.classList.add("hidden");
  });

  // Close modal when clicking outside
  loginModal.addEventListener("click", (e) => {
    if (e.target === loginModal) {
      loginModal.classList.add("hidden");
    }
  });

  // Handle login form submission
  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;

    try {
      const response = await fetch(
        `/login?username=${encodeURIComponent(username)}&password=${encodeURIComponent(password)}`,
        { method: "POST" }
      );

      if (response.ok) {
        const data = await response.json();
        currentToken = data.token;
        isLoggedIn = true;
        localStorage.setItem("authToken", data.token);
        
        loginModal.classList.add("hidden");
        loginForm.reset();
        loginError.classList.add("hidden");
        updateUserStatus(data.username);
        
        // Refresh to show delete buttons
        fetchActivities();
      } else {
        const error = await response.json();
        loginError.textContent = error.detail || "Login failed";
        loginError.classList.remove("hidden");
      }
    } catch (error) {
      loginError.textContent = "Error logging in";
      loginError.classList.remove("hidden");
      console.error("Login error:", error);
    }
  });

  // Handle logout
  function logout() {
    if (currentToken) {
      fetch(`/logout?token=${encodeURIComponent(currentToken)}`, { method: "POST" })
        .catch(error => console.error("Logout error:", error));
    }
    currentToken = null;
    isLoggedIn = false;
    localStorage.removeItem("authToken");
    clearUserStatus();
    fetchActivities();
  }

  // Function to fetch activities from API
  async function fetchActivities() {
    try {
      const response = await fetch("/activities");
      const activities = await response.json();

      // Clear loading message
      activitiesList.innerHTML = "";

      // Populate activities list
      Object.entries(activities).forEach(([name, details]) => {
        const activityCard = document.createElement("div");
        activityCard.className = "activity-card";

        const spotsLeft =
          details.max_participants - details.participants.length;

        // Create participants HTML - show delete buttons only if logged in
        const participantsHTML =
          details.participants.length > 0
            ? `<div class="participants-section">
              <h5>Participants:</h5>
              <ul class="participants-list">
                ${details.participants
                  .map(
                    (email) => {
                      const deleteBtn = isLoggedIn
                        ? `<button class="delete-btn" data-activity="${name}" data-email="${email}">❌</button>`
                        : `<span class="delete-btn disabled" title="Login as teacher to remove">❌</span>`;
                      return `<li><span class="participant-email">${email}</span>${deleteBtn}</li>`;
                    }
                  )
                  .join("")}
              </ul>
            </div>`
            : `<p><em>No participants yet</em></p>`;

        activityCard.innerHTML = `
          <h4>${name}</h4>
          <p>${details.description}</p>
          <p><strong>Schedule:</strong> ${details.schedule}</p>
          <p><strong>Availability:</strong> ${spotsLeft} spots left</p>
          <div class="participants-container">
            ${participantsHTML}
          </div>
        `;

        activitiesList.appendChild(activityCard);

        // Add option to select dropdown
        const option = document.createElement("option");
        option.value = name;
        option.textContent = name;
        activitySelect.appendChild(option);
      });

      // Add event listeners to delete buttons (only if logged in)
      if (isLoggedIn) {
        document.querySelectorAll(".delete-btn:not(.disabled)").forEach((button) => {
          button.addEventListener("click", handleUnregister);
        });
      }
    } catch (error) {
      activitiesList.innerHTML =
        "<p>Failed to load activities. Please try again later.</p>";
      console.error("Error fetching activities:", error);
    }
  }

  // Handle unregister functionality
  async function handleUnregister(event) {
    const button = event.target;
    const activity = button.getAttribute("data-activity");
    const email = button.getAttribute("data-email");

    if (!isLoggedIn || !currentToken) {
      messageDiv.textContent = "You must be logged in as a teacher to remove students";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/unregister?email=${encodeURIComponent(email)}&token=${encodeURIComponent(currentToken)}`,
        {
          method: "DELETE",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to unregister. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error unregistering:", error);
    }
  }

  // Handle form submission
  signupForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = document.getElementById("email").value;
    const activity = document.getElementById("activity").value;

    if (!isLoggedIn || !currentToken) {
      messageDiv.textContent = "You must be logged in as a teacher to register students";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      return;
    }

    try {
      const response = await fetch(
        `/activities/${encodeURIComponent(
          activity
        )}/signup?email=${encodeURIComponent(email)}&token=${encodeURIComponent(currentToken)}`,
        {
          method: "POST",
        }
      );

      const result = await response.json();

      if (response.ok) {
        messageDiv.textContent = result.message;
        messageDiv.className = "success";
        signupForm.reset();

        // Refresh activities list to show updated participants
        fetchActivities();
      } else {
        messageDiv.textContent = result.detail || "An error occurred";
        messageDiv.className = "error";
      }

      messageDiv.classList.remove("hidden");

      // Hide message after 5 seconds
      setTimeout(() => {
        messageDiv.classList.add("hidden");
      }, 5000);
    } catch (error) {
      messageDiv.textContent = "Failed to sign up. Please try again.";
      messageDiv.className = "error";
      messageDiv.classList.remove("hidden");
      console.error("Error signing up:", error);
    }
  });

  // Initialize app
  checkAuthStatus();
  fetchActivities();
});
