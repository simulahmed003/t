const RESPONSE_SESSION_KEY = "questionSiteResponseSession";
const SUPABASE_URL = "https://zcvncodkygqzvyfiddip.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_knGnGIY_7ugj8I9HyWJWGQ_9xg3kN0Y";
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const ADMIN_RECOVERY_URL = "https://simulahmed003.github.io/t/admin.html?reset=1";
let adminAccessToken = null;
let isPasswordRecovery = new URLSearchParams(window.location.search).get("reset") === "1";

// ---------- Visitor flow ----------
// The message and image live only in payload.json, encrypted with AES-GCM.
// The key is derived from the passphrase with PBKDF2, so the repo holds no readable content.

let revealed = null; // decrypted { message, image } once the passphrase is right

function normalizePassphrase(text) {
    return text.normalize("NFKC").trim().toLowerCase().replace(/\s+/g, " ");
}

function fromBase64(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

let payloadPromise = null;
function loadPayload() {
    if (!payloadPromise) {
        payloadPromise = fetch("payload.json", { cache: "no-store" }).then(r => {
            if (!r.ok) throw new Error(`payload.json returned HTTP ${r.status}`);
            return r.json();
        });
    }
    return payloadPromise;
}

async function tryDecrypt(passphrase) {
    const payload = await loadPayload();
    const baseKey = await crypto.subtle.importKey(
        "raw", new TextEncoder().encode(normalizePassphrase(passphrase)), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: fromBase64(payload.salt), iterations: payload.iterations, hash: "SHA-256" },
        baseKey, { name: "AES-GCM", length: 256 }, false, ["decrypt"]);
    try {
        const plain = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv: fromBase64(payload.iv) }, key, fromBase64(payload.data));
        return JSON.parse(new TextDecoder().decode(plain));
    } catch {
        return null; // wrong passphrase
    }
}

function getResponseSessionId() {
    let sessionId = null;
    try { sessionId = localStorage.getItem(RESPONSE_SESSION_KEY); } catch {}
    if (!sessionId) {
        sessionId = crypto.randomUUID();
        try { localStorage.setItem(RESPONSE_SESSION_KEY, sessionId); } catch {}
    }
    return sessionId;
}

// Only the final response is ever sent.
async function recordFinalResponse(answer) {
    const response = await fetch(`${SUPABASE_URL}/rest/v1/responses`, {
        method: "POST",
        headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Content-Type": "application/json",
            "Prefer": "return=minimal"
        },
        body: JSON.stringify({
            session_id: getResponseSessionId(),
            question: "Final feedback",
            answer
        })
    });
    if (!response.ok) {
        throw new Error(`Supabase returned HTTP ${response.status}`);
    }
}

function showStep(stepId) {
    document.querySelectorAll('.step-container').forEach(el => el.classList.add('hidden-step'));
    document.getElementById(stepId).classList.remove('hidden-step');
    window.scrollTo(0, 0);
}

async function checkStep1() {
    const input = document.getElementById('ans-1');
    const err = document.getElementById('err-1');
    const btn = document.getElementById('btn-step-1');
    err.classList.add('hidden');
    if (!input.value.trim()) return;
    btn.disabled = true;
    btn.textContent = "Checking...";
    try {
        revealed = await tryDecrypt(input.value);
        const words = normalizePassphrase(input.value).split(" ");
        if (!revealed && words.length > 1) revealed = await tryDecrypt(words[words.length - 1]);
    } catch (e) {
        console.error(e);
        revealed = null;
        err.textContent = "Couldn't load the page. Please check your connection and try again.";
        err.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = "Next";
        return;
    }
    btn.disabled = false;
    btn.textContent = "Next";
    if (revealed) {
        input.value = "";
        showStep('step-2');
    } else {
        err.textContent = "That's not it. Try again.";
        err.classList.remove('hidden');
    }
}

function revealContent() {
    if (!revealed) { showStep('step-1'); return; }
    const img = document.getElementById('reveal-image');
    if (revealed.image) {
        img.src = revealed.image;
        img.alt = revealed.imageAlt || "";
        img.classList.remove('hidden');
    }
    const box = document.getElementById('reveal-message');
    box.replaceChildren();
    for (const para of revealed.message) {
        const p = document.createElement('p');
        p.className = "mb-4";
        p.textContent = para;
        box.appendChild(p);
    }
    showStep('step-reveal');
}

async function submitFeedback() {
    const err = document.getElementById('err-feedback');
    const btn = document.getElementById('btn-submit');
    err.classList.add('hidden');
    const selected = document.querySelector('input[name="feedback"]:checked');
    if (!selected) {
        err.textContent = "Please choose one option.";
        err.classList.remove('hidden');
        return;
    }
    let text = selected.nextElementSibling.innerText.trim();
    if (selected.value === "other") {
        const other = document.getElementById('other-text').value.trim();
        if (!other) {
            err.textContent = "Please write something in the box, or choose another option.";
            err.classList.remove('hidden');
            return;
        }
        text = "Other: " + other;
    }
    btn.disabled = true;
    btn.textContent = "Sending...";
    try {
        await recordFinalResponse(text);
        showStep('step-thanks');
    } catch (e) {
        console.error(e);
        err.textContent = "Couldn't send your response. Please check your connection and try again.";
        err.classList.remove('hidden');
        btn.disabled = false;
        btn.textContent = "Submit Response";
    }
}

document.getElementById('btn-step-1').addEventListener('click', checkStep1);
document.getElementById('ans-1').addEventListener('keydown', e => { if (e.key === 'Enter') checkStep1(); });
document.getElementById('btn-low-yes').addEventListener('click', () => showStep('step-later'));
document.getElementById('btn-low-no').addEventListener('click', () => showStep('step-3'));
document.getElementById('btn-leave').addEventListener('click', () => showStep('step-left'));
document.getElementById('btn-unlock').addEventListener('click', revealContent);
document.getElementById('btn-feedback').addEventListener('click', () => showStep('step-feedback'));
document.getElementById('btn-submit').addEventListener('click', submitFeedback);
document.querySelectorAll('input[name="feedback"]').forEach(radio => {
    radio.addEventListener('change', () => {
        document.getElementById('other-text').classList.toggle('hidden', !document.getElementById('radio-other').checked);
    });
});

// ---------- Admin panel ----------

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
            const responseBody = await response.text();
            let detail = responseBody;
            try {
                const errorInfo = JSON.parse(responseBody);
                detail = errorInfo.message || errorInfo.msg || responseBody;
            } catch (parseError) {
                console.error("Could not parse Supabase's response deletion error.", parseError);
            }

            const guidance = response.status === 401 || response.status === 403
                ? " In Supabase SQL Editor, run the DELETE grant and admin delete policy from supabase-schema.sql, then retry."
                : "";
            throw new Error(`Could not clear responses (HTTP ${response.status}): ${detail}.${guidance}`);
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
