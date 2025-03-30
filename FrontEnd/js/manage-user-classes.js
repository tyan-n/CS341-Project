document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "login.html?redirect=manage-user-classes.html";
      return;
    }
  
    const form = document.getElementById("user-search-form");
    const usernameInput = document.getElementById("search-username");
    const userHeader = document.getElementById("user-header");
    const calendarMsg = document.getElementById("calendar-message");
    const assignList = document.getElementById("assignable-classes");
    const allProgramsContainer = document.getElementById("all-programs");
  
    const calendarGrid = document.querySelector(".calendar-grid");
    const getDayName = dateStr => {
      const date = new Date(dateStr);
      return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
    };
    const timeToOffset = timeStr => {
      const [h, m] = timeStr.split(":".map(Number));
      return ((h - 6) * 60 + m); // 6AM base
    };
  
    let availablePrograms = [];
    let currentUser = "";
    let userClasses = [];
  
    form.addEventListener("submit", async e => {
      e.preventDefault();
      currentUser = usernameInput.value.trim();
      if (!currentUser) return;
  
      userHeader.style.display = "block";
      userHeader.textContent = `Schedule for: ${currentUser}`;
      calendarMsg.textContent = "";
      clearSchedule();
  
      try {
        // Check user exists
        const userCheck = await fetch(`http://localhost:5000/api/users/${currentUser}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
  
        if (!userCheck.ok) {
          alert("❌ Username does not exist.");
          return;
        }
  
        // Fetch all classes in system
        const res1 = await fetch("http://localhost:5000/api/programs", {
          headers: { Authorization: `Bearer ${token}` }
        });
        availablePrograms = await res1.json();
  
        // Fetch user’s registered classes
        const res2 = await fetch(`http://localhost:5000/api/users/${currentUser}/registrations`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        userClasses = await res2.json();
  
        renderSchedule();
        renderAssignableList();
        await renderFamilyInfo();
  
      } catch (err) {
        console.error("User fetch failed", err);
        calendarMsg.textContent = "Unable to load user schedule.";
      }
    });
  
    async function renderFamilyInfo() {
      const target = document.getElementById("family-info");
      if (!target) return;
      target.innerHTML = "";
      try {
        const res = await fetch(`http://localhost:5000/api/account/family-status/${currentUser}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (!res.ok) return;
        const data = await res.json();
  
        if (data.inFamily) {
          const div = document.createElement("div");
          div.className = "family-tools";
          div.innerHTML = `
            <p><strong>${currentUser}</strong> is part of <strong>${data.owner}'s Family</strong></p>
            <button id="remove-user-family" class="danger-button">Remove from Family</button>
            <button id="delete-user-family" class="danger-button">Delete Entire Family</button>
          `;
  
          div.querySelector("#remove-user-family").addEventListener("click", async () => {
            const res = await fetch(`http://localhost:5000/api/family/remove/${currentUser}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              alert("User removed from family.");
              div.remove();
            } else {
              alert("Failed to remove user from family.");
            }
          });
  
          div.querySelector("#delete-user-family").addEventListener("click", async () => {
            const confirmDelete = confirm("This will delete the entire family. Proceed?");
            if (!confirmDelete) return;
            const res = await fetch(`http://localhost:5000/api/family/delete/${data.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              alert("Family account deleted.");
              div.remove();
            } else {
              alert("Failed to delete family.");
            }
          });
  
          target.appendChild(div);
        }
      } catch (err) {
        console.error("Family fetch error", err);
      }
    }
  
    function clearSchedule() {
      document.querySelectorAll(".class-entry").forEach(e => e.remove());
      assignList.innerHTML = "";
    }
  
    function renderSchedule() {
      document.querySelectorAll(".class-entry").forEach(e => e.remove());
  
      userClasses.forEach(cls => {
        const day = getDayName(cls.startDate);
        const col = document.querySelector(`.day-column[data-day="${day}"]`);
        if (!col) return;
  
        const div = document.createElement("div");
        div.className = "class-entry";
  
        const top = timeToOffset(cls.startTime);
        const height = timeToOffset(cls.endTime) - top;
        div.style.top = `${top}px`;
        div.style.height = `${height}px`;
  
        div.innerHTML = `
          <strong>${cls.name}</strong><br>
          ${cls.startTime}–${cls.endTime}<br>
          <em>${cls.location}</em><br>
          <button class="unregister-btn" data-id="${cls.id}">Remove</button>
        `;
  
        div.querySelector("button").addEventListener("click", async () => {
          try {
            const res = await fetch(`http://localhost:5000/api/users/${currentUser}/register/${cls.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              userClasses = userClasses.filter(c => c.id !== cls.id);
              renderSchedule();
              renderAssignableList();
            } else {
              alert("Failed to remove class from user.");
            }
          } catch (err) {
            console.error(err);
          }
        });
  
        col.appendChild(div);
      });
    }
  
    function renderAssignableList() {
      assignList.innerHTML = "";
      const notRegistered = availablePrograms.filter(
        p => !userClasses.some(u => u.id === p.id)
      );
  
      notRegistered.forEach(cls => {
        const div = document.createElement("div");
        div.className = "program-card";
        div.innerHTML = `
          <h4>${cls.name}</h4>
          <p><strong>${cls.startDate}</strong> @ ${cls.startTime}–${cls.endTime}</p>
          <p><em>${cls.location}</em></p>
          <button class="assign-btn">Add to User</button>
        `;
  
        div.querySelector(".assign-btn").addEventListener("click", async () => {
          try {
            const res = await fetch(`http://localhost:5000/api/users/${currentUser}/register/${cls.id}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
              const newClass = await res.json();
              userClasses.push(newClass);
              renderSchedule();
              renderAssignableList();
            } else {
              alert("Failed to assign class to user.");
            }
          } catch (err) {
            console.error(err);
          }
        });
  
        assignList.appendChild(div);
      });
    }
  
    async function loadAllPrograms() {
      try {
        const res = await fetch("http://localhost:5000/api/programs", {
          headers: { Authorization: `Bearer ${token}` }
        });
  
        const all = await res.json();
        allProgramsContainer.innerHTML = "";
  
        all.forEach(cls => {
          const div = document.createElement("div");
          div.className = "program-card";
          div.innerHTML = `
            <h4>${cls.name}</h4>
            <p><strong>${cls.startDate}</strong> @ ${cls.startTime}–${cls.endTime}</p>
            <p><em>${cls.location}</em></p>
            <button class="danger-button delete-global" data-id="${cls.id}">
              <i class="fas fa-trash"></i> Delete Globally
            </button>
          `;
  
          div.querySelector("button").addEventListener("click", async () => {
            const confirmDelete = confirm("Delete this class for ALL users?");
            if (!confirmDelete) return;
  
            try {
              const delRes = await fetch(`http://localhost:5000/api/programs/${cls.id}`, {
                method: "DELETE",
                headers: { Authorization: `Bearer ${token}` }
              });
  
              if (delRes.ok) {
                div.remove();
                if (currentUser) form.dispatchEvent(new Event("submit"));
              } else {
                alert("Failed to delete program.");
              }
            } catch (err) {
              console.error(err);
            }
          });
  
          allProgramsContainer.appendChild(div);
        });
      } catch (err) {
        console.error("Failed to fetch all programs", err);
      }
    }
  
    loadAllPrograms();
  });
  