document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html?redirect=my-classes.html";
    return;
  }

  const noClassesMsg = document.getElementById("no-classes-message");
  const calendarGrid = document.getElementById("calendar-grid");
  const currentWeekRangeSpan = document.getElementById("current-week-range");
  const prevWeekBtn = document.getElementById("prev-week");
  const nextWeekBtn = document.getElementById("next-week");

  // Helper: Returns "YYYY-MM-DD" for a given Date in local time.
  function getLocalDateString(date) {
    const year  = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day   = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  // NEW: Parse "YYYY-MM-DD" into a local-midnight Date (avoids TZ shifts)
  function parseLocalDate(dateStr) {
    const [y, m, d] = dateStr.split("-").map(Number);
    return new Date(y, m - 1, d);
  }

  // Render the time column on the left.
  function renderTimeColumn() {
    const timeColumn = document.getElementById("time-column");
    timeColumn.innerHTML = "";
    for (let hour = 7; hour <= 22; hour++) {
      const label = document.createElement("div");
      label.className = "time-label";
      label.textContent = hour <= 12
        ? hour + " AM"
        : hour === 12
          ? "12 PM"
          : (hour - 12) + " PM";
      label.style.top = ((hour * 60) - (7 * 60)) + "px";
      timeColumn.appendChild(label);
    }
  }

  // Get Sunday as the start of the week.
  function getWeekStart(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0,0,0,0);
    return d;
  }

  // Format a week range string.
  function formatWeekRange(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })}`
         + ` - ${weekEnd.toLocaleDateString(undefined, { weekday:'short', month:'short', day:'numeric' })}`;
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
      header.textContent = dayDate.toLocaleDateString(undefined, { weekday:"short", month:"short", day:"numeric" });
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
    if (newStart < getWeekStart(new Date())) return;
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

  // Fetch user registrations
  let registrations = [];
  try {
    const res = await fetch("http://localhost:5000/api/registrations", {
      headers: { Authorization: `Bearer ${token}` }
    });
    registrations = await res.json();
    if (!Array.isArray(registrations) || registrations.length === 0) {
      noClassesMsg.textContent = "You are not registered for any classes.";
      return;
    }
  } catch (err) {
    console.error("Fetch error:", err);
    noClassesMsg.textContent = "Error loading your classes.";
    return;
  }

  // Build each occurrence date at local noon to avoid TZ shifts
  function getOccurrenceDate(baseDateStr, weekOffset) {
    const [y,m,d] = baseDateStr.split("T")[0].split("-").map(Number);
    const dt = new Date(y, m-1, d, 12, 0, 0);
    dt.setDate(dt.getDate() + weekOffset * 7);
    return dt;
  }

  function expandRegistrations(regs) {
    const arr = [];
    regs.forEach(reg => {
      const freq = parseInt(reg.frequency) || 1;
      for (let i = 0; i < freq; i++) {
        const occ = { ...reg };
        const dt = getOccurrenceDate(reg.startDate, i);
        occ.occurrenceDate = getLocalDateString(dt);
        arr.push(occ);
      }
    });
    return arr;
  }
  const expandedRegistrations = expandRegistrations(registrations);

  // Modal helpers…
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

    // replace listeners
    const oldC = document.getElementById("confirm-modal-confirm");
    const newC = oldC.cloneNode(true);
    oldC.parentNode.replaceChild(newC, oldC);

    const oldX = document.getElementById("confirm-modal-cancel");
    const newX = oldX.cloneNode(true);
    oldX.parentNode.replaceChild(newX, oldX);

    newC.addEventListener("click", () => { onConfirm(); m.style.display="none"; });
    newX.addEventListener("click", () => m.style.display="none");
  }

  function renderClasses() {
    // clear existing
    document.querySelectorAll(".day-column").forEach(col => {
      while (col.childNodes.length > 1) col.removeChild(col.lastChild);
    });

    expandedRegistrations.forEach(reg => {
      // --- FIXED: use parseLocalDate ---
      const occDate = parseLocalDate(reg.occurrenceDate);
      const occStr  = getLocalDateString(occDate);

      // --- FIXED: correct weekEnd derivation ---
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);

      if (occDate < currentWeekStart || occDate > weekEnd) return;
      const dayCol = document.querySelector(`.day-column[data-date="${occStr}"]`);
      if (!dayCol) return;

      const [h1,m1] = reg.startTime.split(":").map(Number);
      const [h2,m2] = reg.endTime.split(":").map(Number);

      const topPx     = (h1*60 + m1) - (7*60);
      const duration  = (h2*60 + m2) - (h1*60 + m1);
      const heightPx  = Math.max(duration, 40);

      const entry = document.createElement("div");
      entry.className = "class-entry";
      entry.style.top    = topPx + "px";
      entry.style.height = heightPx + "px";
      entry.style.whiteSpace = "normal";
      entry.style.overflow    = "hidden";
      entry.innerHTML = `
        <strong>${reg.name}</strong><br>
        ${reg.startTime} – ${reg.endTime}<br>
        Class Number: ${reg.id}<br>
        <em>${reg.location}</em><br>
        <button class="unregister-btn" data-id="${reg.id}">Unregister</button>
      `;

      dayCol.appendChild(entry);
      // adjust for content overflow
      const contH = entry.scrollHeight;
      entry.style.height = Math.max(heightPx, contH) + "px";

      entry.querySelector(".unregister-btn").addEventListener("click", () => {
        showConfirmModal(
          "Are you sure you want to unregister from this class occurrence?",
          async () => {
            try {
              const resp = await fetch(`http://localhost:5000/api/registrations/${reg.id}`, {
                method: "DELETE",
                headers: {
                  "Content-Type": "application/json",
                  Authorization: `Bearer ${token}`
                }
              });
              if (resp.ok) {
                showNotificationModal("Unregistered successfully!");
                entry.remove();
              } else {
                showNotificationModal("Failed to unregister.");
              }
            } catch (e) {
              console.error("Unregister error:", e);
              showNotificationModal("Error unregistering from class.");
            }
          }
        );
      });
    });
  }

  renderClasses();
});
