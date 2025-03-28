document.addEventListener("DOMContentLoaded", () => {
    const token = localStorage.getItem("token");
    if (!token) {
        window.location.href = "login.html?redirect=my-classes.html";
        return;
    }

    const msg = document.getElementById("no-classes-message");

    // 🧪 Mock class data
    const classes = [
        {
            id: 1,
            name: "Morning Yoga",
            startDate: "2025-04-01",
            startTime: "08:00",
            endTime: "09:00",
            location: "Room 1"
        },
        {
            id: 2,
            name: "Power Strength",
            startDate: "2025-04-01",
            startTime: "12:00",
            endTime: "13:00",
            location: "Room 2"
        },
        {
            id: 3,
            name: "Evening Pilates",
            startDate: "2025-04-03",
            startTime: "18:30",
            endTime: "19:30",
            location: "Studio A"
        }
    ];

    const calendar = document.querySelector(".calendar-grid");
    if (!calendar) return;

    const getDayName = dateStr => {
        const date = new Date(dateStr);
        return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getDay()];
    };

    const timeToOffset = timeStr => {
        const [h, m] = timeStr.split(":").map(Number);
        return ((h - 6) * 60 + m); // from 6AM base
    };

    if (classes.length === 0) {
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
            <button class="unregister-btn">Unregister</button>
        `;

        entry.querySelector("button").addEventListener("click", () => {
            entry.remove();
        });

        col.appendChild(entry);
    });
});



    // ==========================================
    // 🔒 REAL BACKEND FETCH — ENABLE LATER
    // ==========================================
    /*
    try {
        const res = await fetch("http://localhost:5000/api/registrations", {
            headers: { Authorization: `Bearer ${token}` },
        });

        const classes = await res.json();

        if (classes.length === 0) {
            noMsg.innerText = "You are not registered for any classes yet.";
            return;
        }

        container.innerHTML = classes.map(cls => `
            <div class="calendar-card">
                <h3>${cls.name}</h3>
                <p><strong>When:</strong> ${cls.startDate} ${cls.startTime} → ${cls.endTime}</p>
                <p><strong>Where:</strong> ${cls.location}</p>
                <p><strong>Description:</strong> ${cls.description}</p>
                <button class="unregister-btn" data-id="${cls.id}">
                    <i class="fas fa-times-circle"></i> Unregister
                </button>
            </div>
        `).join("");

        document.querySelectorAll(".unregister-btn").forEach(button => {
            button.addEventListener("click", async () => {
                const programId = button.getAttribute("data-id");
                const confirmUnreg = confirm("Are you sure you want to unregister from this class?");
                if (!confirmUnreg) return;

                try {
                    const res = await fetch(\`http://localhost:5000/api/registrations/\${programId}\`, {
                        method: "DELETE",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: \`Bearer \${token}\`
                        }
                    });

                    if (res.ok) {
                        button.parentElement.remove(); // Remove from UI
                    } else {
                        alert("Failed to unregister.");
                    }
                } catch (err) {
                    console.error("Unregister error:", err);
                    alert("Error unregistering from class.");
                }
            });
        });

    } catch (err) {
        console.error("Failed to load classes:", err);
        noMsg.innerText = "Error loading your classes.";
    }
    */