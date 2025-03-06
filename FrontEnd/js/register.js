document.addEventListener("DOMContentLoaded", async function () {
    const urlParams = new URLSearchParams(window.location.search);
    const programId = urlParams.get("programId"); // Get program ID from URL

    const programDetails = document.getElementById("program-details");
    const registerButton = document.getElementById("confirm-register");
    const registrationMessage = document.getElementById("registration-message");

    // 1) Fetch and display class details
    try {
        const response = await fetch(`http://localhost:5000/api/programs/${programId}`);
        const program = await response.json();

        if (program) {
            programDetails.innerHTML = `
                <h3>${program.name}</h3>
                <p><strong>Description:</strong> ${program.description}</p>
                <p><strong>Time:</strong> ${program.startTime} - ${program.endTime}</p>
                <p><strong>Location:</strong> ${program.location}</p>
                <p><strong>Price:</strong> $${program.priceMember} (Member) / $${program.priceNonMember} (Non-Member)</p>
                <p><strong>Capacity:</strong> ${program.capacity}</p>
            `;
        } else {
            programDetails.innerHTML = "<p>Program not found.</p>";
            registerButton.style.display = "none";
        }
    } catch (error) {
        console.error("❌ Error fetching program details:", error);
        programDetails.innerHTML = "<p>❌ Error loading program details.</p>";
    }

    // 2) Register User for Program
    registerButton.addEventListener("click", async function () {
        const token = localStorage.getItem("token");

        // If no token, redirect to login with a "redirect" parameter
        if (!token) {
            alert("Please log in before registering.");
            window.location.href = `login.html?redirect=register.html?programId=${programId}`;
            return;
        }

        try {
            const response = await fetch("http://localhost:5000/api/register", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ programId })
            });

            const data = await response.json();

            if (response.ok) {
                registrationMessage.innerText = "✅ Registration successful!";
                registerButton.disabled = true;
            } else {
                registrationMessage.innerText = `❌ ${data.error}`;
            }
        } catch (error) {
            console.error("❌ Registration failed:", error);
            registrationMessage.innerText = "❌ Error registering for program.";
        }
    });
});
