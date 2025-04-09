document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
  
    if (!token) {
      window.location.href = "login.html";
      return;
    }
  
    const btn = document.getElementById("create-family-btn");
    const msg = document.getElementById("create-family-message");
  
    btn.addEventListener("click", async () => {
      try {
        const res = await fetch("http://localhost:5000/api/family/create", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          }
        });
  
        const data = await res.json();
  
        if (res.ok) {
          msg.textContent = "🎉 Family account created!";
          setTimeout(() => {
            window.location.href = "family-account.html";
          }, 1000);
        } else {
          msg.textContent = data.error || "Failed to create family account.";
        }
      } catch (err) {
        console.error("Error creating family:", err);
        msg.textContent = "Server error. Please try again.";
      }
    });
  });
  