document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "login.html?redirect=employment-timesheet.html";
      return;
    }
  
    const calendar = document.querySelector(".calendar-grid");
    const programList = document.getElementById("program-list");
    const msg = document.getElementById("no-programs-message");
  
    const getDayName = dateStr => {
      const date = new Date(dateStr);
      return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
    };
  
    const timeToOffset = timeStr => {
      const [h, m] = timeStr.split(":").map(Number);
      return ((h - 6) * 60 + m); // Snap from 6AM
    };
  
    let availablePrograms = [];
    let teachingPrograms = [];
  
    try {
      // Fetch all available programs
      const allRes = await fetch("http://localhost:5000/api/programs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      availablePrograms = await allRes.json();
  
      // Fetch employee’s assigned programs
      const assignedRes = await fetch("http://localhost:5000/api/staff/teaching", {
        headers: { Authorization: `Bearer ${token}` }
      });
      teachingPrograms = await assignedRes.json();
  
      renderCalendar();
      renderProgramList();
    } catch (err) {
      console.error("Backend fetch error:", err);
      msg.textContent = "Unable to load program data.";
    }
  
    function renderCalendar() {
      document.querySelectorAll(".class-entry").forEach(el => el.remove());
  
      teachingPrograms.forEach(cls => {
        const day = getDayName(cls.startDate);
        const col = document.querySelector(`.day-column[data-day="${day}"]`);
        if (!col) return;
  
        const entry = document.createElement("div");
        entry.className = "class-entry";
  
        const top = timeToOffset(cls.startTime);
        const height = timeToOffset(cls.endTime) - top;
  
        entry.style.top = `${top}px`;
        entry.style.height = `${height}px`;
  
        entry.innerHTML = `
          <strong>${cls.name}</strong><br>
          ${cls.startTime}–${cls.endTime}<br>
          <em>${cls.location}</em><br>
          <button class="unassign-btn" data-id="${cls.id}">Unassign</button>
        `;
  
        entry.querySelector(".unassign-btn").addEventListener("click", async () => {
          try {
            const res = await fetch(`http://localhost:5000/api/staff/teaching/${cls.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` }
            });
  
            if (res.ok) {
              teachingPrograms = teachingPrograms.filter(p => p.id !== cls.id);
              renderCalendar();
              renderProgramList();
            } else {
              alert("Failed to unassign class.");
            }
          } catch (err) {
            console.error("Unassign error:", err);
          }
        });
  
        col.appendChild(entry);
      });
    }
  
    function renderProgramList() {
      programList.innerHTML = "";
      msg.textContent = "";
  
      const notTeaching = availablePrograms.filter(p => !teachingPrograms.some(t => t.id === p.id));
      if (notTeaching.length === 0) {
        msg.textContent = "You're already assigned to all available programs.";
        return;
      }
  
      notTeaching.forEach(cls => {
        const div = document.createElement("div");
        div.className = "program-card";
        div.innerHTML = `
          <h4>${cls.name}</h4>
          <p><strong>When:</strong> ${cls.startDate} @ ${cls.startTime}–${cls.endTime}</p>
          <p><strong>Location:</strong> ${cls.location}</p>
          <button class="assign-btn" data-id="${cls.id}">Teach This</button>
        `;
  
        div.querySelector(".assign-btn").addEventListener("click", async () => {
          try {
            const res = await fetch(`http://localhost:5000/api/staff/teaching/${cls.id}`, {
              method: "POST",
              headers: { Authorization: `Bearer ${token}` }
            });
  
            if (res.ok) {
              const newAssignment = await res.json();
              teachingPrograms.push(newAssignment);
              renderCalendar();
              renderProgramList();
            } else {
              alert("Failed to assign class.");
            }
          } catch (err) {
            console.error("Assign error:", err);
          }
        });
  
        programList.appendChild(div);
      });
    }
  });
  