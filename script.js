const RESPONSE_LOG_KEY = "questionSiteResponseLog";
const RESPONSE_SESSION_KEY = "questionSiteResponseSession";
const SUPABASE_URL = "https://zcvncodkygqzvyfiddip.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_knGnGIY_7ugj8I9HyWJWGQ_9xg3kN0Y";

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
