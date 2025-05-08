document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html?redirect=employment-timesheet.html";
    return;
  }

  const noTeachMsg    = document.getElementById("no-teaching-message");
  const noClassesMsg  = document.getElementById("no-programs-message");
  const calendarGrid = document.getElementById("calendar-grid");
  const currentWeekRangeSpan = document.getElementById("current-week-range");
  const prevWeekBtn = document.getElementById("prev-week");
  const nextWeekBtn = document.getElementById("next-week");

  function getLocalDateString(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function parseLocalDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  function renderTimeColumn() {
    const timeColumn = document.getElementById("time-column");
    timeColumn.innerHTML = "";
    for (let hour = 7; hour <= 22; hour++) {
      const label = document.createElement("div");
      label.className = "time-label";
      label.textContent = hour <= 12 ? hour + " AM" : (hour === 12 ? "12 PM" : (hour - 12) + " PM");
      label.style.top = ((hour * 60) - (7 * 60)) + "px";
      timeColumn.appendChild(label);
    }
  }

  function getWeekStart(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  function formatWeekRange(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` +
      ` - ${weekEnd.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  }

  let currentWeekStart = getWeekStart(new Date());

  function renderCalendarGrid(weekStart) {
    calendarGrid.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + i);
      const dayCol = document.createElement("div");
      dayCol.className = "day-column";
      dayCol.setAttribute("data-date", getLocalDateString(dayDate));
      const header = document.createElement("h3");
      header.textContent = dayDate.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
      dayCol.appendChild(header);
      calendarGrid.appendChild(dayCol);
    }
    currentWeekRangeSpan.textContent = formatWeekRange(weekStart);
  }

  renderTimeColumn();
  renderCalendarGrid(currentWeekStart);

  prevWeekBtn.addEventListener("click", () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    currentWeekStart = newStart;
    renderCalendarGrid(currentWeekStart);
    renderClasses();
  });

  nextWeekBtn.addEventListener("click", () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    currentWeekStart = newStart;
    renderCalendarGrid(currentWeekStart);
    renderClasses();
  });

  let teachingAssignments = [];
  try {
    const res = await fetch("http://localhost:5000/api/staff/teaching", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const raw = await res.json();
    teachingAssignments = raw.map(c => ({
       id:          c.id,
       name:        c.name,
       description: c.Description,
       startDate:   c.StartDate,
       endDate:     c.EndDate,
       startTime:   c.StartTime,
       endTime:     c.EndTime,
       location:    c.location,
       days:        c.days
     }));

    if (!Array.isArray(teachingAssignments) || teachingAssignments.length === 0) {
      noTeachMsg.textContent = "You are not assigned to any classes.";
    } else {
      renderClasses();
    }
  } catch (err) {
    console.error("Fetch error:", err);
    noTeachMsg.textContent = "Error loading your teaching schedule.";
  }

  function expandTeaching(assignments) {
    const result = [];
    assignments.forEach(cls => {
      if (!cls.days) return;
      const start = parseLocalDate(cls.startDate);
      const end = parseLocalDate(cls.endDate);
      const days = cls.days.split(",").map(d => d.trim());
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        const weekday = d.toLocaleDateString("en-US", { weekday: "long" });
        if (days.includes(weekday)) {
          result.push({
            ...cls, occurrenceDate: getLocalDateString(new Date(d))
          });
        }
      }
    });
    return result;
  }

  function renderClasses() {
    const expandedTeaching = expandTeaching(teachingAssignments);
    document.querySelectorAll(".day-column").forEach(col => {
      while (col.childNodes.length > 1) col.removeChild(col.lastChild);
    });

    expandedTeaching.forEach(cls => {
      const occDate = parseLocalDate(cls.occurrenceDate);
      const occStr = getLocalDateString(occDate);
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (occDate < currentWeekStart || occDate > weekEnd) return;

      const dayCol = document.querySelector(`.day-column[data-date="${occStr}"]`);
      if (!dayCol) return;

      const [h1, m1] = cls.startTime.split(":" ).map(Number);
      const [h2, m2] = cls.endTime.split(":" ).map(Number);
      const topPx = (h1 * 60 + m1) - (7 * 60);
      const duration = (h2 * 60 + m2) - (h1 * 60 + m1);
      const heightPx = Math.max(duration, 40);

      const entry = document.createElement("div");
      entry.className = "class-entry";
      entry.style.top = topPx + "px";
      entry.style.height = heightPx + "px";
      entry.innerHTML = `
        <strong>${cls.name}</strong><br>
        ${cls.startTime} – ${cls.endTime}<br>
        <em>${cls.location}</em><br>
        <button class="unassign-btn" data-id="${cls.id}">Unassign</button>
      `;

      entry.querySelector(".unassign-btn").addEventListener("click", () => {
        showConfirmModal("Unassign from this class?", async () => {
          try {
            const resp = await fetch(`http://localhost:5000/api/staff/teaching/${cls.id}`, {
              method: "DELETE",
              headers: { Authorization: `Bearer ${token}` }
            });
            if (resp.ok) {
              showNotificationModal("Unassigned successfully!");
              entry.remove();
            } else {
              showNotificationModal("Failed to unassign.");
            }
          } catch (e) {
            console.error("Unassign error:", e);
            showNotificationModal("Error unassigning from class.");
          }
        });
      });

      dayCol.appendChild(entry);
    });
  }

  async function loadPrograms() {
    const programListEl = document.getElementById("program-list");
    const noProgramsEl = document.getElementById("no-programs-message");

    const taughtIds = new Set(teachingAssignments.map(c => c.id));

    try {
      const res = await fetch("http://localhost:5000/api/programs", {
        headers: { Authorization: `Bearer ${token}` }
      });
      const programs = await res.json();

      if (!Array.isArray(programs) || programs.length === 0) {
        noClassesMsg.textContent = "No classes are currently available to teach.";
        return;
      }

      const available = Array.isArray(programs) ? programs.filter(p => !taughtIds.has(p.id)) : [];

      // Clear any old content
      programListEl.innerHTML = "";

      available.forEach(p => {
        const card = document.createElement("div");
        card.className = "program-card";
        card.innerHTML = `
          <strong>${p.name}</strong><br>
          ${p.days}<br>
          ${p.startDate} ${p.startTime}–${p.endTime}<br>
          <em>${p.location}</em><br>
          <button class="register-btn" data-id="${p.id}">Teach This Class</button>
        `;
        card.querySelector(".register-btn")
          .addEventListener("click", () => registerToTeach(p, card));
        programListEl.appendChild(card);
      });
    } catch (err) {
      console.error("Error loading programs:", err);
      noProgramsEl.textContent = "Error loading available classes.";
    }
  }

  async function registerToTeach(program, cardEl) {
    try {
      const resp = await fetch(`http://localhost:5000/api/staff/teaching/${program.id}`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }
      });
      if (resp.ok) {
        alert("You’re now assigned to teach that class!");
        teachingAssignments.push(program);
        renderClasses();
        cardEl.remove();
      } else {
        const { error } = await resp.json();
        alert("Failed to assign: " + error);
      }
    } catch (e) {
      console.error("Register error:", e);
      alert("Error assigning you to teach.");
    }
  }

  // Modal helpers
  function showNotificationModal(msg) {
    const m = document.getElementById("notification-modal");
    document.getElementById("notification-modal-message").innerText = msg;
    m.style.display = "block";
  }

  function closeNotificationModal() {
    document.getElementById("notification-modal").style.display = "none";
  }

  document.getElementById("notification-modal-close")
          .addEventListener("click", closeNotificationModal);

  function showConfirmModal(msg, onConfirm) {
    const m = document.getElementById("confirm-modal");
    document.getElementById("confirm-modal-message").innerText = msg;
    m.style.display = "block";

    const oldC = document.getElementById("confirm-modal-confirm");
    const newC = oldC.cloneNode(true);
    oldC.parentNode.replaceChild(newC, oldC);

    const oldX = document.getElementById("confirm-modal-cancel");
    const newX = oldX.cloneNode(true);
    oldX.parentNode.replaceChild(newX, oldX);

    newC.addEventListener("click", () => { onConfirm(); m.style.display = "none"; });
    newX.addEventListener("click", () => m.style.display = "none");
  }

  renderClasses();
  loadPrograms();

});
