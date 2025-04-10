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

  // Render the time column on the left
  function renderTimeColumn() {
    const timeColumn = document.getElementById("time-column");
    timeColumn.innerHTML = "";
    for (let hour = 7; hour <= 22; hour++) {
      const label = document.createElement("div");
      label.className = "time-label";
      label.textContent = hour <= 12 ? hour + " AM" : (hour === 12 ? "12 PM" : (hour - 12) + " PM");
      const topPx = (hour * 60) - (7 * 60);
      label.style.top = topPx + "px";
      timeColumn.appendChild(label);
    }
  }

  // Get Sunday as the start of the week.
  function getWeekStart(date) {
    const d = new Date(date);
    d.setDate(d.getDate() - d.getDay());
    d.setHours(0, 0, 0, 0);
    return d;
  }

  // Format a date range.
  function formatWeekRange(weekStart) {
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);
    return `${weekStart.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })} - ${weekEnd.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}`;
  }

  let currentWeekStart = getWeekStart(new Date());

  function renderCalendarGrid(weekStart) {
    calendarGrid.innerHTML = "";
    for (let i = 0; i < 7; i++) {
      const dayDate = new Date(weekStart);
      dayDate.setDate(dayDate.getDate() + i);
      const dayCol = document.createElement("div");
      dayCol.className = "day-column";
      // Use ISO string for consistency.
      dayCol.setAttribute("data-date", dayDate.toISOString().split('T')[0]);
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
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() - 7);
    const thisWeekStart = getWeekStart(new Date());
    if (newWeekStart < thisWeekStart) return;
    currentWeekStart = newWeekStart;
    renderCalendarGrid(currentWeekStart);
    renderClasses();
  });

  nextWeekBtn.addEventListener("click", () => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(newWeekStart.getDate() + 7);
    currentWeekStart = newWeekStart;
    renderCalendarGrid(currentWeekStart);
    renderClasses();
  });

  let registrations = [];
  try {
    const res = await fetch("http://localhost:5000/api/registrations", {
      headers: { Authorization: `Bearer ${token}` }
    });
    registrations = await res.json();
    console.log("Fetched registrations:", registrations);
    if (!Array.isArray(registrations) || registrations.length === 0) {
      noClassesMsg.textContent = "You are not registered for any classes.";
      return;
    }
  } catch (err) {
    console.error("Fetch error:", err);
    noClassesMsg.textContent = "Error loading your classes.";
    return;
  }

  // Use local noon for date conversion.
  function getOccurrenceDate(baseDateStr, weekOffset) {
    const dateOnly = baseDateStr.split("T")[0];
    const parts = dateOnly.split("-");
    const year = Number(parts[0]);
    const month = Number(parts[1]) - 1;
    const day = Number(parts[2]);
    const d = new Date(year, month, day, 12, 0, 0);
    d.setDate(d.getDate() + weekOffset * 7);
    return d;
  }

  function expandRegistrations(registrations) {
    const expanded = [];
    registrations.forEach(reg => {
      const freq = parseInt(reg.frequency) || 1;
      for (let i = 0; i < freq; i++) {
        const occurrence = { ...reg };
        const occDate = getOccurrenceDate(reg.startDate, i);
        occurrence.occurrenceDate = occDate.toISOString().split('T')[0];
        expanded.push(occurrence);
      }
    });
    // Log the expanded registrations so you can see all computed occurrence dates.
    console.log("Expanded registrations:", expanded);
    return expanded;
  }

  const expandedRegistrations = expandRegistrations(registrations);

  function renderClasses() {
    const dayCols = document.querySelectorAll(".day-column");
    dayCols.forEach(col => {
      while (col.childNodes.length > 1) {
        col.removeChild(col.lastChild);
      }
    });

    expandedRegistrations.forEach(reg => {
      const occDate = new Date(reg.occurrenceDate);
      const occISO = occDate.toISOString().split('T')[0];
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(weekEnd.getDate() + 6);
      if (occDate < currentWeekStart || occDate > weekEnd) return;

      const dayCol = document.querySelector(`.day-column[data-date="${occISO}"]`);
      if (!dayCol) {
        console.warn("No day column found for date:", occISO);
        return;
      }

      // Calculate vertical offset based on startTime.
      const [startH, startM] = reg.startTime.split(":").map(Number);
      const offsetMinutes = startH * 60 + startM;
      const topPx = offsetMinutes - (7 * 60);

      // Calculate duration from startTime to endTime.
      const [endH, endM] = reg.endTime.split(":").map(Number);
      const durationMinutes = (endH * 60 + endM) - (startH * 60 + startM);
      const computedHeight = Math.max(durationMinutes, 40);

      const entry = document.createElement("div");
      entry.className = "class-entry";
      entry.style.top = topPx + "px";
      entry.style.height = computedHeight + "px";
      entry.style.whiteSpace = "normal";
      entry.style.overflow = "hidden";

      entry.innerHTML = `
        <strong>${reg.name}</strong><br>
        ${reg.startTime} – ${reg.endTime}<br>
        Class Number: ${reg.id}<br>
        <em>${reg.location}</em><br>
        <button class="unregister-btn" data-id="${reg.id}" data-occurrence="${occISO}">Unregister</button>
      `;

      dayCol.appendChild(entry);

      const contentHeight = entry.scrollHeight;
      const finalHeight = Math.max(computedHeight, contentHeight);
      entry.style.height = finalHeight + "px";

      entry.querySelector(".unregister-btn").addEventListener("click", async function () {
        if (!confirm("Are you sure you want to unregister from this class occurrence?")) return;
        try {
          const deleteRes = await fetch(`http://localhost:5000/api/registrations/${reg.id}`, {
            method: "DELETE",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`
            }
          });
          if (deleteRes.ok) {
            entry.remove();
          } else {
            alert("Failed to unregister.");
          }
        } catch (err) {
          console.error("Unregister error:", err);
          alert("Error unregistering from class.");
        }
      });
    });
  }

  renderClasses();
});
