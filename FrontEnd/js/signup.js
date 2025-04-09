document.getElementById("signup-form").addEventListener("submit", async function (event) {
  event.preventDefault();

  // Retrieve field values and trim where appropriate
  const username = document.getElementById("signup-username").value.trim();
  const password = document.getElementById("signup-password").value;
  const fname = document.getElementById("fname").value.trim();
  const mname = document.getElementById("mname").value.trim();
  const lname = document.getElementById("lname").value.trim();
  const birthday = document.getElementById("birthday").value.trim();
  const street = document.getElementById("street").value.trim();
  const houseNumber = document.getElementById("house-number").value.trim();
  const city = document.getElementById("city").value.trim();
  const state = document.getElementById("state").value.trim();
  const zipCode = document.getElementById("zip-code").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const membershipType = document.getElementById("membership-type").value;

  // Only validate address fields if membership type is "member"
  if (membershipType === "member") {
    // Validate that house number contains only digits
    if (!/^\d+$/.test(houseNumber)) {
      document.getElementById("signup-message").innerText = "House Number must contain only digits.";
      return;
    }
  
    // Validate that zip code contains exactly 5 digits
    if (!/^\d{5}$/.test(zipCode)) {
      document.getElementById("signup-message").innerText = "Zip Code must be exactly 5 digits.";
      return;
    }
  }
  
  // Validate email using a flexible pattern
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(username)) {
    document.getElementById("signup-message").innerText = "Please enter a valid email address.";
    return;
  }
  
  // Validate phone number with the fixed format: (123)-456-7890
  const phoneRegex = /^\(\d{3}\)-\d{3}-\d{4}$/;
  if (!phoneRegex.test(phone)) {
    document.getElementById("signup-message").innerText = "Phone number must be in the format (123)-456-7890.";
    return;
  }
  
  // Build payload from input fields (we send all fields even if some are blank)
  const payload = {
    username: username,
    password: password,
    fname: fname,
    mname: mname,
    lname: lname,
    birthday: birthday,
    // Only include address fields for members; non-members can leave these blank
    street: membershipType === "member" ? street : "",
    houseNumber: membershipType === "member" ? houseNumber : "",
    city: membershipType === "member" ? city : "",
    state: membershipType === "member" ? state : "",
    zipCode: membershipType === "member" ? zipCode : "",
    phone: phone,
    membershipType: membershipType
  };
  
  try {
    const response = await fetch("http://localhost:5000/api/signup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
  
    const data = await response.json();
  
    if (response.ok) {
      document.getElementById("signup-message").innerText = "Account created! Redirecting...";
      setTimeout(() => window.location.href = "login.html", 2000);
    } else {
      document.getElementById("signup-message").innerText = data.error || "Signup failed.";
    }
  } catch (error) {
    console.error("Signup failed:", error);
    document.getElementById("signup-message").innerText = "Error connecting to server.";
  }
});
