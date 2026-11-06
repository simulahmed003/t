const RESPONSE_LOG_KEY = "questionSiteResponseLog";
const RESPONSE_SESSION_KEY = "questionSiteResponseSession";
const SUPABASE_URL = "https://zcvncodkygqzvyfiddip.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_knGnGIY_7ugj8I9HyWJWGQ_9xg3kN0Y";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let adminAccessToken = null;

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
        new URLSearchParams(window.location.search).get("admin") === "1";
    document.getElementById("app-container").classList.toggle("hidden-step", isAdminRoute);
    document.getElementById("admin-panel").classList.toggle("hidden-step", !isAdminRoute);
}

function closeAdminPanel() {
    window.history.replaceState(null, "", window.location.pathname);
    showAdminPanel();
}

async function signInWithGoogle() {
    const status = document.getElementById("admin-login-status");
    status.textContent = "";

    try {
        const { error } = await supabaseClient.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}${window.location.pathname}?admin=1`
            }
        });
        if (error) {
            throw error;
        }
    } catch (error) {
        status.textContent = error.message || "Could not start Google sign-in.";
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
    if (adminAccessToken && (window.location.hash === "#admin" ||
        new URLSearchParams(window.location.search).get("admin") === "1")) {
        await loadAdminResponses();
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

document.getElementById("google-sign-in").addEventListener("click", signInWithGoogle);
window.addEventListener("hashchange", showAdminPanel);
window.addEventListener("popstate", showAdminPanel);
showAdminPanel();

supabaseClient.auth.onAuthStateChange((_event, session) => {
    void updateAdminSession(session);
});
