```javascript
// ============================================================
// NULL MEETING - FRONTEND API CONNECTION
// ============================================================

// IMPORTANT:
// Production FastAPI backend on Render
const API_URL = "https://null-meeting.onrender.com";


// ============================================================
// HELPER: SHOW MESSAGE
// ============================================================

function showMessage(message, type = "error") {
    // Try common message elements
    const messageBox =
        document.getElementById("message") ||
        document.getElementById("error-message") ||
        document.getElementById("messageBox") ||
        document.getElementById("statusMessage");

    if (messageBox) {
        messageBox.textContent = message;
        messageBox.style.display = "block";

        if (type === "success") {
            messageBox.style.color = "green";
        } else {
            messageBox.style.color = "red";
        }
    } else {
        alert(message);
    }
}


// ============================================================
// HELPER: CHECK FASTAPI CONNECTION
// ============================================================

async function checkFastAPI() {
    try {
        const response = await fetch(`${API_URL}/`, {
            method: "GET"
        });

        if (response.ok) {
            console.log("✅ FastAPI connected successfully");
            return true;
        }

        console.log("⚠️ FastAPI responded:", response.status);
        return false;

    } catch (error) {
        console.error("❌ FastAPI connection failed:", error);
        return false;
    }
}


// ============================================================
// REGISTER
// ============================================================

async function registerUser() {

    // Change these IDs ONLY if your HTML uses different IDs
    const nameInput =
        document.getElementById("name") ||
        document.getElementById("register-name") ||
        document.getElementById("username");

    const emailInput =
        document.getElementById("email") ||
        document.getElementById("register-email");

    const passwordInput =
        document.getElementById("password") ||
        document.getElementById("register-password");

    if (!nameInput || !emailInput || !passwordInput) {
        console.error("❌ Register input elements not found");
        showMessage("Register form fields not found.");
        return;
    }

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validation
    if (!name || !email || !password) {
        showMessage("Please fill all fields.");
        return;
    }

    if (password.length < 6) {
        showMessage("Password must contain at least 6 characters.");
        return;
    }

    console.log("📤 Sending register request to:", `${API_URL}/register`);

    try {

        const response = await fetch(`${API_URL}/register`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                name: name,
                email: email,
                password: password
            })
        });

        console.log("📥 Register response status:", response.status);

        const contentType = response.headers.get("content-type") || "";

        let data;

        if (contentType.includes("application/json")) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        console.log("📥 Register response:", data);


        // SUCCESS
        if (response.ok) {

            showMessage(
                data.message ||
                data.detail ||
                "Account created successfully!",
                "success"
            );

            // Clear form
            nameInput.value = "";
            emailInput.value = "";
            passwordInput.value = "";

            // Optional redirect
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1200);

            return;
        }


        // FASTAPI ERROR
        if (response.status === 422) {

            if (Array.isArray(data.detail)) {

                const errors = data.detail
                    .map(error => {
                        return error.msg || "Invalid input";
                    })
                    .join("\n");

                showMessage(errors);

            } else {
                showMessage(
                    data.detail ||
                    "Invalid registration data."
                );
            }

            return;
        }


        if (response.status === 400) {
            showMessage(
                data.detail ||
                "This account may already exist."
            );

            return;
        }


        if (response.status === 500) {
            console.error("❌ FastAPI returned 500:", data);

            showMessage(
                "Server error. FastAPI received the request but could not process it."
            );

            return;
        }


        showMessage(
            data.detail ||
            data.message ||
            `Registration failed. Server returned ${response.status}.`
        );

    } catch (error) {

        console.error("❌ REGISTER ERROR:", error);

        showMessage(
            "FastAPI not connected. Please check the backend connection."
        );
    }
}


// ============================================================
// LOGIN
// ============================================================

async function loginUser() {

    // Change these IDs ONLY if your HTML uses different IDs
    const emailInput =
        document.getElementById("email") ||
        document.getElementById("login-email");

    const passwordInput =
        document.getElementById("password") ||
        document.getElementById("login-password");

    if (!emailInput || !passwordInput) {
        console.error("❌ Login input elements not found");
        showMessage("Login form fields not found.");
        return;
    }

    const email = emailInput.value.trim();
    const password = passwordInput.value;

    // Validation
    if (!email || !password) {
        showMessage("Please enter your email and password.");
        return;
    }

    console.log("📤 Sending login request to:", `${API_URL}/login`);

    try {

        const response = await fetch(`${API_URL}/login`, {
            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                email: email,
                password: password
            })
        });

        console.log("📥 Login response status:", response.status);

        const contentType = response.headers.get("content-type") || "";

        let data;

        if (contentType.includes("application/json")) {
            data = await response.json();
        } else {
            data = await response.text();
        }

        console.log("📥 Login response:", data);


        // SUCCESS
        if (response.ok) {

            console.log("✅ LOGIN SUCCESS");

            // Find token from common FastAPI response formats
            const token =
                data.access_token ||
                data.token ||
                data.accessToken;

            if (token) {

                // Save JWT token
                localStorage.setItem("access_token", token);

                // Also save as token for compatibility
                localStorage.setItem("token", token);

                console.log("✅ JWT token saved");
            }

            // Save user information if returned
            if (data.user) {
                localStorage.setItem(
                    "user",
                    JSON.stringify(data.user)
                );
            }

            showMessage(
                data.message ||
                "Login successful!",
                "success"
            );

            // Redirect after login
            setTimeout(() => {
                window.location.href = "index.html";
            }, 800);

            return;
        }


        // WRONG LOGIN
        if (response.status === 401) {

            showMessage(
                data.detail ||
                "Invalid email or password."
            );

            return;
        }


        // VALIDATION ERROR
        if (response.status === 422) {

            if (Array.isArray(data.detail)) {

                const errors = data.detail
                    .map(error => {
                        return error.msg || "Invalid input";
                    })
                    .join("\n");

                showMessage(errors);

            } else {

                showMessage(
                    data.detail ||
                    "Invalid login data."
                );
            }

            return;
        }


        // SERVER ERROR
        if (response.status === 500) {

            console.error("❌ FastAPI returned 500:", data);

            showMessage(
                "FastAPI is connected, but the backend has a server error."
            );

            return;
        }


        showMessage(
            data.detail ||
            data.message ||
            `Login failed. Server returned ${response.status}.`
        );

    } catch (error) {

        console.error("❌ LOGIN ERROR:", error);

        showMessage(
            "FastAPI not connected. Check your internet connection or backend URL."
        );
    }
}


// ============================================================
// LOGOUT
// ============================================================

function logoutUser() {

    localStorage.removeItem("access_token");
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    console.log("✅ Logged out");

    window.location.href = "login.html";
}


// ============================================================
// GET SAVED TOKEN
// ============================================================

function getToken() {
    return (
        localStorage.getItem("access_token") ||
        localStorage.getItem("token")
    );
}


// ============================================================
// CHECK LOGIN STATUS
// ============================================================

function isLoggedIn() {
    return !!getToken();
}


// ============================================================
// TEST FASTAPI WHEN PAGE LOADS
// ============================================================

document.addEventListener("DOMContentLoaded", async () => {

    console.log("====================================");
    console.log("NULL MEETING");
    console.log("FastAPI URL:", API_URL);
    console.log("====================================");

    const connected = await checkFastAPI();

    if (connected) {
        console.log("🟢 BACKEND STATUS: CONNECTED");
    } else {
        console.log("🔴 BACKEND STATUS: NOT CONNECTED");
    }


    // ========================================================
    // REGISTER BUTTON
    // ========================================================

    const registerButton =
        document.getElementById("registerBtn") ||
        document.getElementById("register-button") ||
        document.getElementById("registerButton");

    if (registerButton) {

        registerButton.addEventListener("click", (event) => {

            event.preventDefault();

            registerUser();
        });
    }


    // ========================================================
    // LOGIN BUTTON
    // ========================================================

    const loginButton =
        document.getElementById("loginBtn") ||
        document.getElementById("login-button") ||
        document.getElementById("loginButton");

    if (loginButton) {

        loginButton.addEventListener("click", (event) => {

            event.preventDefault();

            loginUser();
        });
    }


    // ========================================================
    // REGISTER FORM SUBMIT
    // ========================================================

    const registerForm =
        document.getElementById("registerForm") ||
        document.querySelector("form");

    if (
        registerForm &&
        window.location.pathname.toLowerCase().includes("register")
    ) {

        registerForm.addEventListener("submit", (event) => {

            event.preventDefault();

            registerUser();
        });
    }


    // ========================================================
    // LOGIN FORM SUBMIT
    // ========================================================

    const loginForm =
        document.getElementById("loginForm") ||
        document.querySelector("form");

    if (
        loginForm &&
        window.location.pathname.toLowerCase().includes("login")
    ) {

        loginForm.addEventListener("submit", (event) => {

            event.preventDefault();

            loginUser();
        });
    }

});
```
