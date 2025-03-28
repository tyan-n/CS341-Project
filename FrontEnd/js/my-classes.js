document.addEventListener("DOMContentLoaded", async () => {
    const token = localStorage.getItem("token");
    if (!token) {
      window.location.href = "login.html?redirect=my-classes.html";
      return;
    }
  
    const msg = document.getElementById("no-classes-message");
    const calendar = document.querySelector(".calendar-grid");
    if (!calendar) return;
  
    const getDayName = dateStr => {
      const date = new Date(dateStr);
      return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
    };
  
    const timeToOffset = timeStr => {
      const [h, m] = timeStr.split(":").map(Number);
      return ((h - 6) * 60 + m); // snap from 6 AM
    };
  
    try {
      const res = await fetch("http://localhost:5000/api/registrations", {
        headers: {
          Authorization: `Bearer ${token}`
        }
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
  
        const top = timeToOffset(cls.startTime);
        const height = timeToOffset(cls.endTime) - top;
  
        entry.style.top = `${top}px`;
        entry.style.height = `${height}px`;
  
        entry.innerHTML = `
          <strong>${cls.name}</strong><br>
          ${cls.startTime}–${cls.endTime}<br>
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
              entry.remove(); // Instant UI update
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
  