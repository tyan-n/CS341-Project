// Helper to show a modal with a message and an OK button.
function showModal(message) {
  const modal = document.getElementById("modal");
  const modalMessage = document.getElementById("modal-message");
  // Clear any existing buttons (except the close button).
  const existingBtns = modal.querySelectorAll("button.modal-ok");
  existingBtns.forEach(btn => btn.remove());
  modalMessage.innerText = message;
  modal.style.display = "block";
  return new Promise((resolve) => {
    const okBtn = document.createElement("button");
    okBtn.innerText = "OK";
    okBtn.className = "ymca-button modal-ok";
    okBtn.onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };
    modal.querySelector(".modal-content").appendChild(okBtn);
  });
}

// Helper to show a confirmation modal with Yes and No buttons.
function confirmModal(message) {
  const modal = document.getElementById("modal");
  const modalMessage = document.getElementById("modal-message");
  // Clear any existing confirmation buttons.
  const existingBtns = modal.querySelectorAll("button.modal-confirm");
  existingBtns.forEach(btn => btn.remove());
  modalMessage.innerText = message;
  modal.style.display = "block";
  return new Promise((resolve) => {
    const modalContent = modal.querySelector(".modal-content");

    const yesBtn = document.createElement("button");
    yesBtn.innerText = "Yes";
    yesBtn.className = "ymca-button modal-confirm";
    yesBtn.onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };

    const noBtn = document.createElement("button");
    noBtn.innerText = "No";
    noBtn.className = "danger-button modal-confirm";
    noBtn.onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };

    modalContent.appendChild(yesBtn);
    modalContent.appendChild(noBtn);
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  const username = localStorage.getItem("username");

  const msg = document.getElementById("family-message");
  const createSection = document.getElementById("create-family-form");
  const dashboard = document.getElementById("family-dashboard");
  const addSection = document.getElementById("add-member-section");
  const deleteSection = document.getElementById("delete-family-section");
  const memberList = document.getElementById("member-list");

  try {
    const res = await fetch("http://localhost:5000/api/account/family-status", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const data = await res.json();

    if (!data.inFamily) {
      createSection.style.display = "block";
      return;
    }

    const isOwner = data.isOwner;
    dashboard.style.display = "block";
    msg.textContent = `Family Account: ${data.owner}`;

    // Render members.
    memberList.innerHTML = "";
    data.members.forEach(member => {
      const li = document.createElement("li");
      li.className = "member-item";
      li.textContent = `${member.fullName} (${member.email})`;

      if (isOwner && member.email !== username) {
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.className = "danger-button";
        removeBtn.onclick = async () => {
          const confirmed = await confirmModal("Are you sure you want to remove this member?");
          if (!confirmed) return;
          try {
            const delRes = await fetch(`http://localhost:5000/api/family/remove/${member.email}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` }
            });

            if (delRes.ok) {
              li.remove();
              await showModal("Member removed successfully.");
            } else {
              await showModal("Failed to remove member.");
            }
          } catch (err) {
            console.error("Remove error:", err);
            await showModal("Error removing member.");
          }
        };
        li.appendChild(removeBtn);
      }

      memberList.appendChild(li);
    });

    if (isOwner) {
      // Show add member form.
      addSection.style.display = "block";

      document.getElementById("add-member-form").addEventListener("submit", async e => {
        e.preventDefault();
        const input = document.getElementById("new-member-username");
        const newUsername = input.value.trim();
        if (!newUsername) return;

        try {
          const addRes = await fetch("http://localhost:5000/api/family/add", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ username: newUsername })
          });

          const result = await addRes.json();

          if (addRes.ok) {
            input.value = "";
            await showModal("Member added successfully!");
            window.location.reload();
          } else {
            await showModal(result.error || "Failed to add member.");
          }
        } catch (err) {
          console.error("Add member error:", err);
          await showModal("Server error. Try again.");
        }
      });

      // Show and wire up delete family section.
      deleteSection.style.display = "block";
      document.getElementById("delete-family-btn").addEventListener("click", async () => {
        const confirmed = await confirmModal("Are you sure you want to delete your entire family account? This cannot be undone.");
        if (!confirmed) return;

        try {
          const delRes = await fetch(`http://localhost:5000/api/family/delete/${data.id}`, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${token}` }
          });

          const result = await delRes.json();

          if (delRes.ok) {
            await showModal("Family deleted.");
            window.location.href = "create-family.html";
          } else {
            await showModal(result.error || "Failed to delete family.");
          }
        } catch (err) {
          console.error("Delete family error:", err);
          await showModal("Error deleting family.");
        }
      });
    }
  } catch (err) {
    msg.textContent = "Unable to load family account info.";
    console.error("Fetch error:", err);
  }
});