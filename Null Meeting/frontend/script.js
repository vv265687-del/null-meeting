/* =====================================================
   MOBILE MENU
===================================================== */

function toggleMenu() {

    const menu =
        document.getElementById(
            "mobileMenu"
        );

    if (!menu) {
        return;
    }

    menu.classList.toggle("show");

}


/* =====================================================
   MODAL
===================================================== */

const modalOverlay =
    document.getElementById(
        "modalOverlay"
    );

const modalContent =
    document.getElementById(
        "modalContent"
    );


function openModal(content) {

    if (!modalOverlay ||
        !modalContent) {

        return;

    }

    modalContent.innerHTML =
        content;

    modalOverlay.classList.add(
        "show"
    );

}


function closeModal() {

    if (!modalOverlay) {
        return;
    }

    modalOverlay.classList.remove(
        "show"
    );

}


if (modalOverlay) {

    modalOverlay.addEventListener(
        "click",
        function(event) {

            if (
                event.target ===
                modalOverlay
            ) {

                closeModal();

            }

        }
    );

}


/* =====================================================
   LOGIN MODAL
===================================================== */

function openLogin() {

    openModal(`

        <h2>Welcome back 👋</h2>

        <p class="modal-subtitle">
            Login to your PROJECT-X account.
        </p>

        <div class="form-group">

            <label>Email</label>

            <input
                type="email"
                id="loginEmail"
                placeholder="Enter your email"
            >

        </div>

        <div class="form-group">

            <label>Password</label>

            <input
                type="password"
                id="loginPassword"
                placeholder="Enter your password"
            >

        </div>

        <button
            class="modal-submit"
            onclick="loginUser()"
        >

            Login

        </button>

    `);

}


/* =====================================================
   REGISTER MODAL
===================================================== */

function openRegister() {

    openModal(`

        <h2>Create your account 🚀</h2>

        <p class="modal-subtitle">
            Join PROJECT-X today.
        </p>

        <div class="form-group">

            <label>Full Name</label>

            <input
                type="text"
                id="registerName"
                placeholder="Your name"
            >

        </div>

        <div class="form-group">

            <label>Email</label>

            <input
                type="email"
                id="registerEmail"
                placeholder="you@example.com"
            >

        </div>

        <div class="form-group">

            <label>Password</label>

            <input
                type="password"
                id="registerPassword"
                placeholder="Create password"
            >

        </div>

        <button
            class="modal-submit"
            onclick="registerUser()"
        >

            Create Account

        </button>

    `);

}


/* =====================================================
   CREATE MEETING FROM HOME
===================================================== */

function openCreateMeeting() {

    const token =
        localStorage.getItem(
            "access_token"
        );


    if (!token) {

        openLogin();

        return;

    }


    window.location.href =
        "dashboard.html";

}


/* =====================================================
   JOIN MEETING FROM HOME
===================================================== */

function openJoinMeeting() {

    const token =
        localStorage.getItem(
            "access_token"
        );


    if (!token) {

        openLogin();

        return;

    }


    window.location.href =
        "dashboard.html";

}


/* =====================================================
   REGISTER
===================================================== */

async function registerUser() {

    const name =
        document.getElementById(
            "registerName"
        ).value.trim();


    const email =
        document.getElementById(
            "registerEmail"
        ).value.trim();


    const password =
        document.getElementById(
            "registerPassword"
        ).value;


    if (
        !name ||
        !email ||
        !password
    ) {

        alert(
            "Please fill all fields."
        );

        return;

    }


    try {

        const response =
            await fetch(
                "http://127.0.0.1:8000/register",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            name: name,

                            email: email,

                            password: password

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.detail ||
                "Registration failed."
            );

            return;

        }


        alert(
            "Account created successfully! 🎉"
        );


        closeModal();


        // Automatically open login

        openLogin();

    }

    catch (error) {

        console.error(error);

        alert(
            "Cannot connect to FastAPI."
        );

    }

}


/* =====================================================
   LOGIN
===================================================== */

async function loginUser() {

    const email =
        document.getElementById(
            "loginEmail"
        ).value.trim();


    const password =
        document.getElementById(
            "loginPassword"
        ).value;


    if (
        !email ||
        !password
    ) {

        alert(
            "Please fill all fields."
        );

        return;

    }


    try {

        const response =
            await fetch(
                "http://127.0.0.1:8000/login",
                {

                    method: "POST",

                    headers: {

                        "Content-Type":
                            "application/json"

                    },

                    body:
                        JSON.stringify({

                            email: email,

                            password: password

                        })

                }
            );


        const data =
            await response.json();


        if (!response.ok) {

            alert(
                data.detail ||
                "Login failed."
            );

            return;

        }


        localStorage.setItem(
            "access_token",
            data.access_token
        );


        localStorage.setItem(
            "user",
            JSON.stringify(
                data.user
            )
        );


        // Remove old meeting ID
        // when starting a new login session

        localStorage.removeItem(
            "current_meeting_id"
        );


        window.location.href =
            "dashboard.html";

    }

    catch (error) {

        console.error(error);

        alert(
            "Cannot connect to FastAPI."
        );

    }

}

/* =========================================================
   HOST / ADMIN SYSTEM
========================================================= */

let isHost = false;


/* =========================================================
   CHECK HOST ROLE
========================================================= */

async function checkHostRole() {

    try {

        const response =
            await fetch(
                `${API_URL}/meetings/${encodeURIComponent(meetingId)}/role`,
                {

                    method: "GET",

                    headers: {

                        "Authorization":
                            `Bearer ${token}`

                    }

                }
            );


        if (!response.ok) {

            console.error(
                "Could not get meeting role."
            );

            return;

        }


        const data =
            await response.json();


        console.log(
            "Meeting role:",
            data
        );


        isHost =
            data.is_host === true;


        if (isHost) {

            console.log(
                "👑 Current user is HOST"
            );


            const adminButton =
                document.getElementById(
                    "adminBtn"
                );


            if (adminButton) {

                adminButton.style.display =
                    "block";

            }


            showToast(
                "👑 You are the meeting host"
            );

        }
        else {

            console.log(
                "👤 Current user is PARTICIPANT"
            );

        }

    }
    catch (error) {

        console.error(
            "Host role error:",
            error
        );

    }

}


/* =========================================================
   TOGGLE ADMIN PANEL
========================================================= */

function toggleAdminPanel() {

    if (!isHost) {

        showToast(
            "Only the host can access these controls."
        );

        return;

    }


    const panel =
        document.getElementById(
            "adminPanel"
        );


    if (!panel) {

        return;

    }


    panel.classList.toggle(
        "open"
    );

}


/* =========================================================
   CLOSE ADMIN PANEL WHEN CLICKING OUTSIDE
========================================================= */

document.addEventListener(
    "click",
    function(event) {

        const panel =
            document.getElementById(
                "adminPanel"
            );

        const button =
            document.getElementById(
                "adminBtn"
            );


        if (!panel || !button) {

            return;

        }


        if (
            panel.classList.contains("open") &&
            !panel.contains(event.target) &&
            !button.contains(event.target)
        ) {

            panel.classList.remove(
                "open"
            );

        }

    }
);

