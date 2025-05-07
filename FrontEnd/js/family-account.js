// Helper to show a modal with a message and an OK button.
function showModal(message) {
  const modal = document.getElementById("modal");
  const modalMessage = document.getElementById("modal-message");
  modalMessage.innerText = message;

  // Remove old buttons
  modal.querySelectorAll("button.modal-ok").forEach(btn => btn.remove());

  const okBtn = document.createElement("button");
  okBtn.innerText = "OK";
  okBtn.className = "ymca-button modal-ok";

  modal.querySelector(".modal-content").appendChild(okBtn);
  modal.style.display = "block";

  return new Promise(resolve => {
    okBtn.onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };
  });
}

// Helper to show a confirmation modal
function confirmModal(message) {
  const modal = document.getElementById("modal");
  const modalMessage = document.getElementById("modal-message");
  modalMessage.innerText = message;

  //  Clear ALL buttons 
  modal.querySelectorAll("button").forEach(btn => btn.remove());

  const yesBtn = document.createElement("button");
  yesBtn.innerText = "Yes";
  yesBtn.className = "ymca-button modal-confirm";

  const noBtn = document.createElement("button");
  noBtn.innerText = "No";
  noBtn.className = "danger-button modal-confirm";

  const modalContent = modal.querySelector(".modal-content");
  modalContent.appendChild(yesBtn);
  modalContent.appendChild(noBtn);

  modal.style.display = "block";

  return new Promise(resolve => {
    yesBtn.onclick = () => {
      modal.style.display = "none";
      resolve(true);
    };
    noBtn.onclick = () => {
      modal.style.display = "none";
      resolve(false);
    };
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

    // Render members
    memberList.innerHTML = "";
    data.members.forEach(member => {
      const li = renderMember(member, isOwner, username, token);
      memberList.appendChild(li);
    });
    
    function renderMember(member, isOwner, username, token) {
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
    
            const result = await delRes.json();
            if (delRes.ok) {
              li.remove();
              await showModal("Member removed successfully.");
            } else {
              await showModal(result.error || "Failed to remove member.");
            }
          } catch (err) {
            console.error("Remove error:", err);
            await showModal("Error removing member.");
          }
        };
    
        li.appendChild(removeBtn);
      }
    
      return li;
    }    

    // Fetch and render dependents
    const depList = document.getElementById("dependent-list");

    const depRes = await fetch("http://localhost:5000/api/family/dependents", {
      headers: { Authorization: `Bearer ${token}` }
    });

    const depData = await depRes.json();
    if (!Array.isArray(depData.dependents)) return;

    depList.innerHTML = "";
    depData.dependents.forEach(dep => {
      const fullName = `${dep.FName} ${dep.MName || ""} ${dep.LName}`.replace(/\s+/g, " ");
      
      const depCard = document.createElement("div");
      depCard.className = "dependent-card";
    
      // Header
      const depHeader = document.createElement("div");
      depHeader.className = "dependent-header";
      depHeader.textContent = `${fullName} (DOB: ${dep.Birthday})`;
      depCard.appendChild(depHeader);
    
      // Registered Classes
      const classList = document.createElement("ul");
      classList.className = "class-list";
      const header = document.createElement("li");
      header.innerHTML = "<strong>Registered Classes:</strong>";
      classList.appendChild(header);
    
      fetch(`http://localhost:5000/api/family/dependent/classes/${dep.DepID}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data.classes) && data.classes.length > 0) {
            data.classes.forEach(cls => {
              const item = document.createElement("li");
              item.textContent = `${cls.ClassName} (${cls.StartDate} – ${cls.EndDate})`;
              classList.appendChild(item);
            });
          } else {
            const item = document.createElement("li");
            item.textContent = "No active registrations.";
            classList.appendChild(item);
          }
        })
        .catch(err => {
          const item = document.createElement("li");
          item.textContent = "Unable to load classes.";
          classList.appendChild(item);
          console.error("Fetch dependent class list error:", err);
        });
    
      depCard.appendChild(classList);
    
      if (isOwner) {
        // Remove button
        const removeBtn = document.createElement("button");
        removeBtn.textContent = "Remove";
        removeBtn.className = "danger-button";
        removeBtn.onclick = async () => {
          const confirmed = await confirmModal("Remove this dependent?");
          if (!confirmed) return;
    
          try {
            const del = await fetch(`http://localhost:5000/api/family/remove-dependent/${dep.DepID}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` }
            });
            if (del.ok) {
              depCard.remove();
              await showModal("Dependent removed.");
            } else {
              await showModal("Failed to remove dependent.");
            }
          } catch (err) {
            console.error("Remove error:", err);
            await showModal("Server error while removing dependent.");
          }
        };
    
        // Dropdown
        const classSelect = document.createElement("select");
        classSelect.className = "class-dropdown";
        classSelect.innerHTML = `<option value="">-- Select Class --</option>`;
    
        fetch("http://localhost:5000/api/programs", {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then(res => res.json())
          .then(classes => {
            classes.forEach(cls => {
              const opt = document.createElement("option");
              opt.value = cls.id;
              opt.textContent = `${cls.name} (${cls.startDate} - ${cls.endDate})`;
              classSelect.appendChild(opt);
            });
          });
    
        // Register Button
        const registerBtn = document.createElement("button");
        registerBtn.textContent = "Register";
        registerBtn.className = "success-button";
        registerBtn.onclick = async () => {
          const selectedClassId = classSelect.value;
          if (!selectedClassId) return await showModal("Please select a class.");
          const confirmed = await confirmModal("Register this dependent for the selected class?");
          if (!confirmed) return;
    
          try {
            const res = await fetch(`http://localhost:5000/api/family/dependent/register/${dep.DepID}/${selectedClassId}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` }
            });
            const result = await res.json();
            if (res.ok) {
              await showModal("Dependent successfully registered.");
              window.location.reload();
            } else {
              await showModal(result.error || "Failed to register dependent.");
            }
          } catch (err) {
            console.error("Register error:", err);
            await showModal("Error registering dependent.");
          }
        };
    
        // Unregister Button
        const unregisterBtn = document.createElement("button");
        unregisterBtn.textContent = "Unregister";
        unregisterBtn.className = "danger-button";
        unregisterBtn.onclick = async () => {
          const selectedClassId = classSelect.value;
          if (!selectedClassId) return await showModal("Please select a class to remove.");
          const confirmed = await confirmModal("Unregister this dependent from the selected class?");
          if (!confirmed) return;
    
          try {
            const res = await fetch(`http://localhost:5000/api/family/dependent/register/${dep.DepID}/${selectedClassId}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` }
            });
            const result = await res.json();
            if (res.ok) {
              await showModal("Dependent successfully unregistered.");
              window.location.reload();
            } else {
              await showModal(result.error || "Failed to unregister dependent.");
            }
          } catch (err) {
            console.error("Unregister error:", err);
            await showModal("Error removing registration.");
          }
        };
    
        // Wrap controls
        const controlWrapper = document.createElement("div");
        controlWrapper.className = "class-controls";
        controlWrapper.appendChild(classSelect);
        controlWrapper.appendChild(registerBtn);
        controlWrapper.appendChild(unregisterBtn);
        controlWrapper.appendChild(removeBtn);

        depCard.appendChild(controlWrapper);
      }
    
      depList.appendChild(depCard);
    });
    
    // Show add member form (owner only)
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

      // Delete family
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

document.getElementById("add-dependent-form").addEventListener("submit", async e => {
  e.preventDefault();

  const fName = document.getElementById("dep-fname").value.trim();
  const mName = document.getElementById("dep-mname").value.trim();
  const lName = document.getElementById("dep-lname").value.trim();
  const birthday = document.getElementById("dep-birthday").value.trim();

  const token = localStorage.getItem("token");

  if (!fName || !lName || !birthday) {
    await showModal("All required fields must be filled.");
    return;
  }

  try {
    const res = await fetch("http://localhost:5000/api/family/add-dependent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ fName, lName, mName, birthday })
    });

    const data = await res.json();
    if (res.ok) {
       await showModal("Dependent added successfully.");
      window.location.reload();
    } else {
      await showModal(data.error || "Failed to add dependent.");
    }
  } catch (err) {
    console.error("Add dependent error:", err);
    await showModal("Server error. Try again.");
  }
});
