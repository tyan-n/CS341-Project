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
  const inactiveContainer = document.getElementById("inactive-class-list");
  const calendarGrid = document.querySelector(".calendar-grid");

  const getDayName = dateStr => {
    const date = new Date(dateStr);
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  };

  const timeToOffset = timeStr => {
    const [h, m] = timeStr.split(":").map(Number);
    return ((h - 6) * 60 + m); // 6AM base
  };

  let availablePrograms = [];
  let currentUser = "";
  let userClasses = [];


  function getDateOfISOWeek(week, year) {
    const simple = new Date(year, 0, 1 + (week - 1) * 7);
    const dow = simple.getDay();
    const ISOweekStart = new Date(simple);
    if (dow <= 4) ISOweekStart.setDate(simple.getDate() - simple.getDay() + 1);
    else ISOweekStart.setDate(simple.getDate() + 8 - simple.getDay());
    return ISOweekStart;
  }

  function getWeekRangeFromInput(weekValue) {
    const [year, weekStr] = weekValue.split("-W");
    const week = parseInt(weekStr);
    const start = getDateOfISOWeek(week, parseInt(year));
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    return { start, end };
  }
  
  let selectedWeekRange = null;

  function renderCalendarGrid(weekStart) {
    calendarGrid.innerHTML = ""; // Clear previous columns
  
    for (let i = 0; i < 7; i++) {
      const date = new Date(weekStart);
      date.setDate(weekStart.getDate() + i);
  
      const dateStr = date.toISOString().split("T")[0];
      const weekday = date.toLocaleDateString(undefined, { weekday: "long" });
  
      const dayCol = document.createElement("div");
      dayCol.className = "day-column";
      dayCol.setAttribute("data-date", dateStr);
  
      calendarGrid.appendChild(dayCol);
    }
  }  
  
  document.getElementById("week-selector").addEventListener("change", e => {
    selectedWeekRange = getWeekRangeFromInput(e.target.value);
    renderCalendarGrid(selectedWeekRange.start); 
    renderSchedule(); // dynamically refresh view
  });  

  form.addEventListener("submit", async e => {
    e.preventDefault();
    currentUser = usernameInput.value.trim();
    if (!currentUser) return;

    localStorage.setItem("selectedUserEmail", currentUser);

    document.getElementById("user-header-container").style.display = "block";
    userHeader.textContent = `Schedule for: ${currentUser}`;

    const profileRes = await fetch(`http://localhost:5000/api/users/${currentUser}/profile`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!profileRes.ok) {
      alert("❌ Username does not exist.");
      return;
    }

    const profileData = await profileRes.json();

    if (profileData.type === "member") {
      const toggleBtn = document.createElement("button");
      toggleBtn.id = "toggle-user-status";
      toggleBtn.className = profileData.status === "inactive" ? "success-button" : "danger-button";
      toggleBtn.innerText = profileData.status === "inactive" ? "Activate User" : "Mark Inactive";

      toggleBtn.addEventListener("click", async () => {
        const newStatus = profileData.status === "inactive" ? "active" : "inactive";
        try {
          const res = await fetch(`http://localhost:5000/api/users/${currentUser}/status`, {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            },
            body: JSON.stringify({ status: newStatus })
          });

          if (res.ok) {
            alert(`User marked as ${newStatus}`);
            profileData.status = newStatus;
            toggleBtn.innerText = newStatus === "inactive" ? "Activate User" : "Mark Inactive";
            toggleBtn.className = newStatus === "inactive" ? "success-button" : "danger-button";
          } else {
            alert("Failed to update user status.");
          }
        } catch (err) {
          console.error("Status toggle error:", err);
          alert("Error toggling status.");
        }
      });

      const statusControls = document.getElementById("user-status-controls");
      statusControls.innerHTML = "";
      statusControls.appendChild(toggleBtn);
    }

    calendarMsg.textContent = "";
    clearSchedule();

    try {
      const res1 = await fetch("http://localhost:5000/api/programs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      availablePrograms = await res1.json();

      const res2 = await fetch(`http://localhost:5000/api/users/${currentUser}/registrations`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      userClasses = await res2.json();

      renderSchedule();
      renderAssignableList();
      await renderFamilyInfo();
      await loadInactiveClasses();

    } catch (err) {
      console.error("User fetch failed", err);
      calendarMsg.textContent = "Unable to load user schedule.";
    }
  });

  const savedUser = localStorage.getItem("selectedUserEmail");
  if (savedUser) {
    usernameInput.value = savedUser;
    setTimeout(() => {
      form.dispatchEvent(new Event("submit"));
    }, 0);
  }

  function clearSchedule() {
    document.querySelectorAll(".class-entry").forEach(e => e.remove());
    assignList.innerHTML = "";
  }

  function renderSchedule() {
    document.querySelectorAll(".class-entry").forEach(e => e.remove());
  
    if (!selectedWeekRange) return;
  
    const weekStart = selectedWeekRange.start;
    const weekEnd = selectedWeekRange.end;
  
    userClasses.forEach(cls => {
      const start = new Date(cls.StartDate);
      const end = new Date(cls.EndDate);
      const days = (cls.days || "").split(",").map(d => d.trim());
  
      for (let d = new Date(weekStart); d <= weekEnd; d.setDate(d.getDate() + 1)) {
        const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
  
        if (days.includes(weekday) && d >= start && d <= end) {
          const dateStr = d.toISOString().split("T")[0];
          const col = document.querySelector(`.day-column[data-date="${dateStr}"]`);
          if (!col) continue;
  
          const [h1, m1] = cls.StartTime.split(":").map(Number);
          const [h2, m2] = cls.EndTime.split(":").map(Number);
          const top = h1 * 60 + m1 - 6 * 60 + 30;
          const height = Math.max((h2 * 60 + m2) - (h1 * 60 + m1), 40);
  
          const div = document.createElement("div");
          div.className = "class-entry";
          div.style.top = `${top}px`;
          div.style.height = `${height}px`;
          div.innerHTML = `
            <strong>${cls.name}</strong><br>
            ${cls.StartTime}–${cls.EndTime}<br>
            <em>${cls.location}</em><br>
            <button class="unregister-btn" data-id="${cls.id}">Remove</button>
          `;
  
          div.querySelector(".unregister-btn").addEventListener("click", async () => {
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
                alert("Failed to remove class.");
              }
            } catch (err) {
              console.error(err);
            }
          });
  
          col.appendChild(div);
        }
      }
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
        // Parse new class details
        const newDay = getDayName(cls.startDate);
        const [newStartH, newStartM] = cls.startTime.split(":").map(Number);
        const [newEndH, newEndM] = cls.endTime.split(":").map(Number);
        const newStart = newStartH * 60 + newStartM;
        const newEnd = newEndH * 60 + newEndM;
      
        // Check for time conflicts
        const conflict = userClasses.some(uc => {
          const ucDay = getDayName(uc.StartDate);
          if (ucDay !== newDay) return false;
      
          const [ucStartH, ucStartM] = uc.StartTime.split(":").map(Number);
          const [ucEndH, ucEndM] = uc.EndTime.split(":").map(Number);
          const ucStart = ucStartH * 60 + ucStartM;
          const ucEnd = ucEndH * 60 + ucEndM;
      
          return Math.max(ucStart, newStart) < Math.min(ucEnd, newEnd);
        });
      
        if (conflict) {
          alert("⚠️ This class conflicts with an existing class on the user's schedule.");
          return;
        }
      
        // No conflict, proceed with assignment
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

  async function loadInactiveClasses() {
    if (!inactiveContainer) return;

    try {
      const res = await fetch("http://localhost:5000/api/programs/inactive", {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await res.json();
      inactiveContainer.innerHTML = "";

      if (data.length === 0) {
        inactiveContainer.innerHTML = "<p>No inactive classes at the moment.</p>";
        return;
      }

      data.forEach(cls => {
        const div = document.createElement("div");
        div.className = "program-card inactive";
        div.innerHTML = `
          <h4>${cls.name}</h4>
          <p><strong>${cls.startDate}</strong> @ ${cls.startTime}–${cls.endTime}</p>
          <p><em>${cls.location}</em></p>
          <button class="success-button reactivate-btn" data-id="${cls.id}">Reactivate</button>
        `;

        div.querySelector(".reactivate-btn").addEventListener("click", async () => {
          const res = await fetch(`http://localhost:5000/api/programs/${cls.id}/reactivate`, {
            method: "PATCH",
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.ok) {
            alert("Class reactivated");
            loadInactiveClasses();
            form.dispatchEvent(new Event("submit"));
          } else {
            alert("Failed to reactivate");
          }
        });

        inactiveContainer.appendChild(div);
      });
    } catch (err) {
      console.error("Failed to fetch inactive", err);
      inactiveContainer.innerHTML = "<p>Could not load inactive classes.</p>";
    }
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

        div.querySelector(".delete-global").addEventListener("click", async () => {
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

  function getISOWeek(date) {
    const target = new Date(date.valueOf());
    const dayNr = (date.getDay() + 6) % 7;
    target.setDate(target.getDate() - dayNr + 3);
    const firstThursday = new Date(target.getFullYear(), 0, 4);
    const diff = target - firstThursday;
    return 1 + Math.round(diff / (7 * 24 * 60 * 60 * 1000));
  }
  
  function autoSelectCurrentWeek() {
    const today = new Date();
    const weekStr = `${today.getFullYear()}-W${String(getISOWeek(today)).padStart(2, '0')}`;
    const weekInput = document.getElementById("week-selector");
  
    weekInput.value = weekStr;
    selectedWeekRange = getWeekRangeFromInput(weekStr);
    renderCalendarGrid(selectedWeekRange.start);
  }  

  autoSelectCurrentWeek();

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

  loadAllPrograms();
});
