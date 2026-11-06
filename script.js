const RESPONSE_LOG_KEY = "questionSiteResponseLog";
const RESPONSE_SESSION_KEY = "questionSiteResponseSession";
const SUPABASE_URL = "https://zcvncodkygqzvyfiddip.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_knGnGIY_7ugj8I9HyWJWGQ_9xg3kN0Y";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_RECOVERY_URL = "https://simulahmed003.github.io/t/admin.html?reset=1";
let adminAccessToken = null;
let isPasswordRecovery = new URLSearchParams(window.location.search).get("reset") === "1";

function getResponseSessionId() {
    let sessionId = localStorage.getItem(RESPONSE_SESSION_KEY);
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        localStorage.setItem(RESPONSE_SESSION_KEY, sessionId);
    }
    return sessionId;
}

async function recordAnswer(question, answer) {
    const entry = {
        timestamp: new Date().toISOString(),
        question,
        answer
    };

    try {
        const savedLog = localStorage.getItem(RESPONSE_LOG_KEY);
        const entries = savedLog ? JSON.parse(savedLog) : [];
        if (!Array.isArray(entries)) {
            throw new Error("Saved response log is not a valid list.");
        }

        entries.push(entry);
        localStorage.setItem(RESPONSE_LOG_KEY, JSON.stringify(entries));
    } catch (error) {
        console.error("Could not save the response in this browser.", error);
    }

    if (!SUPABASE_URL.startsWith("https://") || SUPABASE_URL.includes("YOUR_PROJECT_ID") ||
        !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_PUBLISHABLE_KEY")) {
        console.error("Supabase is not configured. This response is saved only in this browser.");
        return;
    }

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/responses`, {
            method: "POST",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Content-Type": "application/json",
                "Prefer": "return=minimal"
            },
            body: JSON.stringify({
                session_id: getResponseSessionId(),
                question,
                answer
            })
        });

        if (!response.ok) {
            throw new Error(`Supabase returned HTTP ${response.status}: ${await response.text()}`);
        }
    } catch (error) {
        console.error("Could not send this response to Supabase. It remains in this browser's local log.", error);
    }
}

function showStep(stepId) {
    document.querySelectorAll('.step-container').forEach(el => el.classList.add('hidden-step'));
    document.getElementById(stepId).classList.remove('hidden-step');
}

async function checkStep1() {
    const ans = document.getElementById('ans-1').value.trim().toLowerCase();
    await recordAnswer("Question 1 (last name)", ans);
    if (ans === 'rimzim') {
        showStep('step-2');
    } else {
        document.getElementById('err-1').classList.remove('hidden');
    }
}

async function checkStep2() {
    const ans = document.getElementById('ans-2').value.trim().toLowerCase();
    await recordAnswer("Question 2", ans);
    if (ans === 'no') {
        showStep('step-3');
    } else {
        document.getElementById('err-2').classList.remove('hidden');
    }
}

async function checkStep3() {
    const ans = document.getElementById('ans-3').value.trim().toLowerCase();
    await recordAnswer("Question 3", ans);
    if (ans === 'yes' || ans === 'y') {
        showStep('step-reveal');
    } else {
        document.getElementById('err-3').classList.remove('hidden');
    }
}

function goToFeedback() {
    showStep('step-feedback');
}

// Show/hide other text box
document.querySelectorAll('input[name="feedback"]').forEach(radio => {
    radio.addEventListener('change', function() {
        if(document.getElementById('radio-other').checked) {
            document.getElementById('other-text').classList.remove('hidden');
        } else {
            document.getElementById('other-text').classList.add('hidden');
        }
    });
});

async function submitFeedback() {
    const selectedOption = document.querySelector('input[name="feedback"]:checked');
    if (!selectedOption) {
        alert("Please select an option");
        return;
    }
    
    let feedbackText = selectedOption.nextElementSibling.innerText;
    if (selectedOption.value === "6") {
        feedbackText = "Other: " + document.getElementById('other-text').value;
    }

    await recordAnswer("Final feedback", feedbackText);
    document.getElementById('app-container').classList.add('hidden-step');
}

function showAdminPanel() {
    const isAdminRoute = window.location.hash === "#admin" ||
        new URLSearchParams(window.location.search).get("admin") === "1" ||
        new URLSearchParams(window.location.search).get("reset") === "1";
    document.getElementById("app-container").classList.toggle("hidden-step", isAdminRoute);
    document.getElementById("admin-panel").classList.toggle("hidden-step", !isAdminRoute);
    if (isAdminRoute && new URLSearchParams(window.location.search).get("reset") === "1") {
        showPasswordResetForm();
    }
}

function closeAdminPanel() {
    window.history.replaceState(null, "", window.location.pathname);
    showAdminPanel();
}

async function signInToAdmin() {
    const status = document.getElementById("admin-login-status");
    status.textContent = "";
    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    try {
        const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) {
            throw error;
        }
    } catch (error) {
        status.textContent = error.message || "Could not sign in.";
    }
}

async function createAdminAccount() {
    const status = document.getElementById("admin-login-status");
    status.textContent = "";
    const email = document.getElementById("admin-email").value.trim();
    const password = document.getElementById("admin-password").value;

    if (password.length < 8) {
        status.textContent = "Choose a password with at least 8 characters.";
        return;
    }

    try {
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                emailRedirectTo: `${window.location.origin}${window.location.pathname}?admin=1`
            }
        });
        if (error) {
            throw error;
        }

        document.getElementById("admin-password").value = "";
        status.classList.remove("text-red-600");
        status.classList.add("text-teal-700");
        status.textContent = data.session
            ? "Account created. You are signed in."
            : "Account created. Check your email and confirm the account, then return here and sign in.";
    } catch (error) {
        status.classList.remove("text-teal-700");
        status.classList.add("text-red-600");
        status.textContent = error.message || "Could not create the account.";
    }
}

async function requestAdminPasswordReset() {
    const status = document.getElementById("admin-login-status");
    status.classList.remove("text-teal-700");
    status.classList.add("text-red-600");
    status.textContent = "";
    const email = document.getElementById("admin-email").value.trim();

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
            redirectTo: ADMIN_RECOVERY_URL
        });
        if (error) {
            throw error;
        }

        status.classList.remove("text-red-600");
        status.classList.add("text-teal-700");
        status.textContent = "If an account exists for this address, Supabase will email a reset link. Check your inbox and spam folder.";
    } catch (error) {
        status.textContent = error.message || "Could not request a password reset.";
    }
}

function showPasswordResetForm() {
    document.getElementById("admin-login-form").classList.add("hidden-step");
    document.getElementById("admin-reset-form").classList.remove("hidden-step");
    document.getElementById("admin-responses").classList.add("hidden-step");
}

async function handleAdminPasswordReset(event) {
    event.preventDefault();
    const status = document.getElementById("admin-login-status");
    status.classList.remove("text-teal-700");
    status.classList.add("text-red-600");
    status.textContent = "";
    const password = document.getElementById("admin-new-password").value;

    try {
        const { error } = await supabaseClient.auth.updateUser({ password });
        if (error) {
            throw error;
        }

        document.getElementById("admin-new-password").value = "";
        document.getElementById("admin-reset-form").classList.add("hidden-step");
        document.getElementById("admin-login-form").classList.remove("hidden-step");
        window.history.replaceState(null, "", `${window.location.pathname}?admin=1`);
        isPasswordRecovery = false;
        status.classList.remove("text-red-600");
        status.classList.add("text-teal-700");
        status.textContent = "Password updated. Sign in with your new password.";
        const { error: signOutError } = await supabaseClient.auth.signOut();
        if (signOutError) {
            console.error("Password was updated, but the recovery session could not be cleared.", signOutError);
        }
    } catch (error) {
        status.textContent = error.message || "Could not update the password. Request a fresh reset link and try again.";
    }
}

async function updateAdminSession(session) {
    adminAccessToken = session?.access_token || null;
    const loginForm = document.getElementById("admin-login-form");
    const responses = document.getElementById("admin-responses");
    if (!loginForm || !responses) {
        return;
    }

    loginForm.classList.toggle("hidden-step", Boolean(adminAccessToken));
    responses.classList.toggle("hidden-step", !adminAccessToken);
    if (isPasswordRecovery) {
        showPasswordResetForm();
        return;
    }
    if (adminAccessToken) {
        document.getElementById("admin-password").value = "";
        if (window.location.hash === "#admin" ||
            new URLSearchParams(window.location.search).get("admin") === "1") {
            await loadAdminResponses();
        }
    }
}

async function loadAdminResponses() {
    if (!adminAccessToken) {
        return;
    }

    const status = document.getElementById("admin-login-status");
    const rows = document.getElementById("admin-response-rows");
    status.textContent = "";
    document.getElementById("admin-status").textContent = "Loading responses...";
    rows.replaceChildren();

    try {
        const query = "select=id,session_id,created_at,question,answer&order=created_at.desc&limit=500";
        const response = await fetch(`${SUPABASE_URL}/rest/v1/responses?${query}`, {
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${adminAccessToken}`
            }
        });
        if (!response.ok) {
            throw new Error(`Could not load responses (HTTP ${response.status}). Verify that this account is authorized in Supabase.`);
        }

        const entries = await response.json();
        for (const entry of entries) {
            const row = document.createElement("tr");
            row.className = "border-b border-gray-200 align-top";
            const submitted = document.createElement("td");
            submitted.className = "p-3 whitespace-nowrap";
            submitted.textContent = new Date(entry.created_at).toLocaleString();
            const visitor = document.createElement("td");
            visitor.className = "p-3 font-mono text-sm";
            visitor.textContent = String(entry.session_id).slice(0, 8);
            const question = document.createElement("td");
            question.className = "p-3";
            question.textContent = entry.question;
            const answer = document.createElement("td");
            answer.className = "p-3 whitespace-pre-wrap";
            answer.textContent = entry.answer;
            row.append(submitted, visitor, question, answer);
            rows.append(row);
        }
        document.getElementById("admin-status").textContent = `${entries.length} response${entries.length === 1 ? "" : "s"} shown (up to 500).`;
    } catch (error) {
        document.getElementById("admin-status").textContent = "";
        status.textContent = error.message || "Could not load responses.";
    }
}

function showClearConfirmation() {
    if (!adminAccessToken) {
        return;
    }

    document.getElementById("clear-responses-confirmation").classList.remove("hidden-step");
    document.getElementById("show-clear-confirmation").classList.add("hidden-step");
    document.getElementById("clear-confirmation-text").focus();
}

function cancelClearConfirmation() {
    document.getElementById("clear-confirmation-text").value = "";
    document.getElementById("clear-responses-confirmation").classList.add("hidden-step");
    document.getElementById("show-clear-confirmation").classList.remove("hidden-step");
}

async function clearAllResponses(event) {
    event.preventDefault();
    const status = document.getElementById("admin-login-status");
    const responseStatus = document.getElementById("admin-status");
    status.textContent = "";
    if (document.getElementById("clear-confirmation-text").value !== "DELETE ALL") {
        responseStatus.textContent = "Type DELETE ALL exactly to confirm. No responses were deleted.";
        return;
    }

    responseStatus.textContent = "Clearing responses...";

    try {
        const response = await fetch(`${SUPABASE_URL}/rest/v1/responses?id=gt.0`, {
            method: "DELETE",
            headers: {
                "apikey": SUPABASE_ANON_KEY,
                "Authorization": `Bearer ${adminAccessToken}`,
                "Prefer": "return=representation"
            }
        });
        if (!response.ok) {
            throw new Error(`Could not clear responses (HTTP ${response.status}). Apply the updated Supabase schema/policy and try again.`);
        }

        const deletedRows = await response.json();
        document.getElementById("admin-response-rows").replaceChildren();
        cancelClearConfirmation();
        responseStatus.textContent = `${deletedRows.length} response${deletedRows.length === 1 ? "" : "s"} permanently deleted.`;
    } catch (error) {
        responseStatus.textContent = "";
        status.textContent = error.message || "Could not clear responses.";
    }
}

async function signOutAdmin() {
    document.getElementById("admin-response-rows").replaceChildren();
    document.getElementById("admin-status").textContent = "";
    document.getElementById("admin-login-status").textContent = "";
    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) {
            throw error;
        }
    } catch (error) {
        document.getElementById("admin-login-status").textContent = error.message || "Could not sign out.";
    }
}

document.getElementById("admin-sign-in").addEventListener("click", signInToAdmin);
document.getElementById("admin-create-account").addEventListener("click", createAdminAccount);
document.getElementById("admin-forgot-password").addEventListener("click", requestAdminPasswordReset);
document.getElementById("admin-reset-form").addEventListener("submit", handleAdminPasswordReset);
document.getElementById("clear-responses-confirmation").addEventListener("submit", clearAllResponses);
window.addEventListener("hashchange", showAdminPanel);
window.addEventListener("popstate", showAdminPanel);
showAdminPanel();

supabaseClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
        isPasswordRecovery = true;
        showPasswordResetForm();
    }
    void updateAdminSession(session);
});
