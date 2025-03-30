document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    const username = localStorage.getItem("username");
  
    if (!token || !username) {
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
        createSection.style.display = "block";
        return;
      }
  
      const isOwner = data.isOwner;
      dashboard.style.display = "block";
      msg.textContent = `Family Account: ${data.owner} Family`;
  
      // Render members
      memberList.innerHTML = "";
      data.members.forEach(member => {
        const li = document.createElement("li");
        li.className = "member-item";
        li.textContent = member.username;
  
        if (isOwner && member.username !== username) {
          const removeBtn = document.createElement("button");
          removeBtn.textContent = "Remove";
          removeBtn.className = "danger-button";
          removeBtn.onclick = async () => {
            try {
              const delRes = await fetch(`http://localhost:5000/api/family/remove/${member.username}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
              });
  
              if (delRes.ok) {
                li.remove();
              } else {
                alert("Failed to remove member.");
              }
            } catch (err) {
              console.error("Remove error:", err);
              alert("Error removing member.");
            }
          };
          li.appendChild(removeBtn);
        }
  
        memberList.appendChild(li);
      });
  
      if (isOwner) {
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
              window.location.reload();
            } else {
              alert(result.error || "Failed to add member.");
            }
          } catch (err) {
            console.error("Add member error:", err);
            alert("Server error. Try again.");
          }
        });
      }
    } catch (err) {
      msg.textContent = "Unable to load family account info.";
      console.error("Fetch error:", err);
    }
  });
  