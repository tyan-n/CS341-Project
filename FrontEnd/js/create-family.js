document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");

  // AUTO REDIRECT if already in family
  try {
    const res = await fetch("http://localhost:5000/api/account/family-status", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const data = await res.json();
    if (data.inFamily) {
      window.location.href = "family-account.html";
      return;
    }
  } catch (err) {
    console.error("Family check error:", err);
  }

  const btn = document.getElementById("create-family-btn");

  // Modal elements
  const modal = document.getElementById("modal");
  const modalMessage = document.getElementById("modal-message");
  const modalClose = document.getElementById("modal-close");

  // Helper functions to show/hide modal
  function showModal(message) {
    modalMessage.innerText = message;
    modal.style.display = "block";
  }
  function hideModal() {
    modal.style.display = "none";
  }
  modalClose.addEventListener("click", hideModal);

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
        showModal("🎉 Family account created!");
        setTimeout(() => {
          window.location.href = "family-account.html";
        }, 1000);
      } else {
        showModal(data.error || "Failed to create family account.");
      }
    } catch (err) {
      console.error("Error creating family:", err);
      showModal("Server error. Please try again.");
    }
  });
});