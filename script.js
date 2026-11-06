// TELEGRAM CONFIGURATION
// DO NOT SHARE THIS FILE PUBLICLY ON GITHUB ONCE CONFIGURED WITH SECRETS
const TELEGRAM_BOT_TOKEN = "6317774952:AAGtbKmyzvBGKHC5vGLVVZbyYqj_kAJeEp4";
const TELEGRAM_CHAT_ID = "@pyrate007_bot"; // <--- YOU MUST REPLACE THIS

async function sendTelegramNotification(message) {
    if (TELEGRAM_CHAT_ID === "YOUR_CHAT_ID_HERE") {
        console.error("Please add your Telegram Chat ID in script.js");
        return;
    }
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    try {
        await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: TELEGRAM_CHAT_ID,
                text: message
            })
        });
    } catch (error) {
        console.error("Failed to send Telegram message", error);
    }
}

function showStep(stepId) {
    document.querySelectorAll('.step-container').forEach(el => el.classList.add('hidden-step'));
    document.getElementById(stepId).classList.remove('hidden-step');
}

function checkStep1() {
    const ans = document.getElementById('ans-1').value.trim().toLowerCase();
    sendTelegramNotification(`Visitor answered Q1: "${ans}"`);
    if (ans === 'rimzim') {
        showStep('step-2');
    } else {
        document.getElementById('err-1').classList.remove('hidden');
    }
}

function checkStep2() {
    const ans = document.getElementById('ans-2').value.trim().toLowerCase();
    sendTelegramNotification(`Visitor answered Q2: "${ans}"`);
    if (ans === 'no') {
        showStep('step-3');
    } else {
        document.getElementById('err-2').classList.remove('hidden');
    }
}

function checkStep3() {
    const ans = document.getElementById('ans-3').value.trim().toLowerCase();
    sendTelegramNotification(`Visitor answered Q3: "${ans}"`);
    if (ans === 'yes' || ans === 'y') {
        sendTelegramNotification(`SUCCESS: Visitor unlocked the secret image and message!`);
        showStep('step-reveal');
    } else {
        document.getElementById('err-3').classList.remove('hidden');
    }
}

function goToFeedback() {
    sendTelegramNotification(`Visitor is now viewing the feedback form.`);
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

function submitFeedback() {
    const selectedOption = document.querySelector('input[name="feedback"]:checked');
    if (!selectedOption) {
        alert("Please select an option");
        return;
    }
    
    let feedbackText = selectedOption.nextElementSibling.innerText;
    if (selectedOption.value === "6") {
        feedbackText = "Other: " + document.getElementById('other-text').value;
    }

    sendTelegramNotification(`FINAL FEEDBACK SUBMITTED: ${feedbackText}`);
    showStep('step-thanks');
}
