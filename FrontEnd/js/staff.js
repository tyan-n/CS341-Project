document.getElementById("add-program-form").addEventListener("submit", async function (event) {
    event.preventDefault();

    // Get values from form
    const startDate = document.getElementById("start-date").value;
    const endDate = document.getElementById("end-date").value;
    const startTime = document.getElementById("start-time").value;
    const endTime = document.getElementById("end-time").value;

    const selectedDays = Array.from(document.querySelectorAll('input[name="days"]:checked'))
    .map(cb => cb.value);

    // Create Date objects
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Normalize today's date to midnight

    const classStartDate = new Date(startDate);
    classStartDate.setHours(0, 0, 0, 0);

    // Validate that class start date is not in the past
    if (classStartDate < today) {
      document.getElementById("message").innerText = "Error: You cannot set up a class before today's date.";
      return;
    }

    // Construct start and end DateTime objects
    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(`${endDate}T${endTime}`);

    // If class start date is today, make sure its start time is not in the past (relative to now)
    const now = new Date();
    if (classStartDate.getTime() === today.getTime() && startDateTime < now) {
      document.getElementById("message").innerText = "Error: The start time cannot be in the past.";
      return;
    }

    // Validate that the end date/time is after the start date/time
    if (endDateTime <= startDateTime) {
        document.getElementById("message").innerText = "Error: End date and time must be after start date and time.";
        return;
    }

    // Construct program data object
    const programData = {
        name: document.getElementById("name").value,
        startDate: startDate,
        endDate: endDate,
        startTime: startTime,
        endTime: endTime,
        location: parseInt(document.getElementById("room-number").value), // using room-number as location
        description: document.getElementById("description").value,
        capacity: parseInt(document.getElementById("capacity").value),
        priceMember: parseFloat(document.getElementById("price-member").value),
        priceNonMember: parseFloat(document.getElementById("price-nonmember").value),
        classSpec: document.getElementById("class-spec").value,
        empId: parseInt(document.getElementById("emp-id").value), // Employee ID
        days: selectedDays,
        //frequency: parseInt(document.getElementById("frequency").value),
        classType: document.getElementById("class-type").value,
        ageGroup: document.getElementById("age-group").value,
        status: document.getElementById("status").value
    };

    try {
        const response = await fetch("http://localhost:5000/api/programs", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(programData)
        });

        const data = await response.json();

        if (response.ok) {
            document.getElementById("message").innerText = "Program added successfully!";
            setTimeout(() => {
                window.location.href = "browse.html";
            }, 2000);
        } else {
            document.getElementById("message").innerText = `Error: ${data.error}`;
        }
    } catch (error) {
        console.error("Error adding program:", error);
        document.getElementById("message").innerText = "Error connecting to server.";
    }
});
