document.addEventListener("DOMContentLoaded", async function() {
    const programList = document.getElementById("program-list");

    try {
        const response = await fetch("http://localhost:5000/api/programs"); // Fetch programs from backend
        const programs = await response.json();

        if (programs.length > 0) {
            programList.innerHTML = programs.map(program => `
                <div class="program-card">
                    <h3>${program.name}</h3>
                    <p><strong>Description:</strong> ${program.description}</p>
                    <p><strong>Time:</strong> ${program.startTime} - ${program.endTime}</p>
                    <p><strong>Location:</strong> ${program.location}</p>
                    <p><strong>Price:</strong> $${program.priceMember} (Member) / $${program.priceNonMember} (Non-Member)</p>
                    <p><strong>Capacity:</strong> ${program.capacity}</p>
                    <button class="register-btn" data-id="${program.id}">Register</button>
                </div>
            `).join("");
        } else {
            programList.innerHTML = "<p>No programs available.</p>";
        }
    } catch (error) {
        console.error("Error fetching programs:", error);
        programList.innerHTML = "<p>Error loading programs.</p>";
    }

    // Event Listener for Register Button Click
    document.querySelectorAll(".register-btn").forEach(button => {
        button.addEventListener("click", function() {
            const programId = this.getAttribute("data-id");
            window.location.href = `register.html?programId=${programId}`;
        });
    });
});