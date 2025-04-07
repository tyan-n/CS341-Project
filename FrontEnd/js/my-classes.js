document.addEventListener("DOMContentLoaded", async () => {
  const token = localStorage.getItem("token");
  if (!token) {
    window.location.href = "login.html?redirect=my-classes.html";
    return;
  }

  const msg = document.getElementById("no-classes-message");
  const calendar = document.querySelector(".calendar-grid");
  if (!calendar) return;

  // Convert a date string into the day name (e.g., "Monday")
  const getDayName = dateStr => {
    const date = new Date(dateStr);
    return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
  };

  // Compute vertical offset (in pixels) from midnight (0:00)
  // Here, 1 minute = 1px
  const timeToOffset = timeStr => {
    const [h, m] = timeStr.split(":").map(Number);
    return (h * 60 + m);
  };

  // Since your CSS reserves 30px at the top of each day-column (padding-top: 30px),
  // add that offset so boxes start below the header.
  const headerOffset = 30;

  try {
    const res = await fetch("http://localhost:5000/api/registrations", {
      headers: { Authorization: `Bearer ${token}` }
    });
    const classes = await res.json();

    if (!Array.isArray(classes) || classes.length === 0) {
      msg.textContent = "You are not registered for any classes.";
      return;
    }

    classes.forEach(cls => {
      const day = getDayName(cls.startDate);
      const col = document.querySelector(`.day-column[data-day="${day}"]`);
      if (!col) return;

      const entry = document.createElement("div");
      entry.className = "class-entry";

      // Compute the top offset based on the class's start time, then add the header offset.
      const top = timeToOffset(cls.startTime) + headerOffset;
      entry.style.top = `${top}px`;

      // Compute the height based on the class duration
      const computedHeight = timeToOffset(cls.endTime) - timeToOffset(cls.startTime);
      entry.style.minHeight = `${computedHeight}px`;
      entry.style.height = "auto"; // Allow box to expand if content is more

      // Format the scheduled date using locale formatting
      const formattedDate = new Date(cls.startDate).toLocaleDateString();

      // Display class details: name, time, date, class number, and location
      entry.innerHTML = `
        <strong>${cls.name}</strong><br>
        ${cls.startTime}–${cls.endTime}<br>
        ${formattedDate}<br>
        Class Number: ${cls.id}<br>
        <em>${cls.location}</em><br>
        <button class="unregister-btn" data-id="${cls.id}">
          <i class="fas fa-times-circle"></i> Unregister
        </button>
      `;

      entry.querySelector(".unregister-btn").addEventListener("click", async () => {
        const confirmUnreg = confirm("Are you sure you want to unregister from this class?");
        if (!confirmUnreg) return;
        try {
          const deleteRes = await fetch(`http://localhost:5000/api/registrations/${cls.id}`, {
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

      col.appendChild(entry);
    });
  } catch (err) {
    console.error("Fetch error:", err);
    msg.textContent = "Error loading your classes.";
  }
});
