document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username"); // For UI only
  
    if (!token) {
      window.location.href = "login.html";
      return;
    }
  
    const msg = document.getElementById("family-message");
    const createSection = document.getElementById("create-family-form");
    const dashboard = document.getElementById("family-dashboard");
    const addSection = document.getElementById("add-member-section");
    const memberList = document.getElementById("member-list");
  
    try {
      const res = await fetch("http://localhost:5000/api/account/family-status", {
        headers: { Authorization: `Bearer ${token}` }
      });
  
      const data = await res.json();
  
      if (!data.inFamily) {
        // Not in family
        if (data.age < 18) {
          msg.textContent = "You must be 18+ to create a family account.";
          return;
        }
  
        createSection.style.display = "block";
        document.getElementById("create-family-btn").addEventListener("click", async () => {
          const createRes = await fetch("http://localhost:5000/api/family/create", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            }
          });
  
          if (createRes.ok) {
            window.location.reload();
          } else {
            msg.textContent = "Failed to create family account.";
          }
        });
        return;
      }
  
      // ✅ In family
      dashboard.style.display = "block";
      msg.textContent = `Family Account: ${data.ownerUsername || data.ownerEmail || "Unknown"} Family`;
  
      memberList.innerHTML = "";
  
      data.members.forEach(member => {
        const li = document.createElement("li");
        li.innerHTML = `
          <span class="member-badge">${member.username[0].toUpperCase()}</span> ${member.username}
        `;
  
        if (data.isOwner && member.id !== data.userId) {
          const removeBtn = document.createElement("button");
          removeBtn.textContent = "Remove";
          removeBtn.className = "danger-button";
          removeBtn.onclick = async () => {
            const removeRes = await fetch(`http://localhost:5000/api/family/remove/${member.id}`, {
              method: "DELETE",
              headers: {
                Authorization: `Bearer ${token}`
              }
            });
  
            if (removeRes.ok) {
              li.remove();
            } else {
              alert("Failed to remove member.");
            }
          };
          li.appendChild(removeBtn);
        }
  
        memberList.appendChild(li);
      });
  
      // ➕ Add new members
      if (data.isOwner) {
        addSection.style.display = "block";
        document.getElementById("add-member-form").addEventListener("submit", async e => {
          e.preventDefault();
          const newUsername = document.getElementById("new-member-username").value.trim();
          if (!newUsername) return;
  
          const addRes = await fetch("http://localhost:5000/api/family/add", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ username: newUsername })
          });
  
          if (addRes.ok) {
            window.location.reload();
          } else {
            alert("Failed to add member.");
          }
        });
      }
    } catch (err) {
      console.error("Family status error:", err);
      msg.textContent = "Unable to load family data.";
    }
  });
  