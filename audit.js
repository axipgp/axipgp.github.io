const ITERATIONS = 1000000;
const MAX_PASSWORD_ATTEMPTS = 5;
const ATTEMPT_RESET_TIMEOUT = 5 * 60 * 1000;

let passwordAttempts = parseInt(sessionStorage.getItem('passwordAttempts')) || 0;
let lastAttemptTime = parseInt(sessionStorage.getItem('lastAttemptTime')) || Date.now();

if (Date.now() - lastAttemptTime > ATTEMPT_RESET_TIMEOUT) {
    passwordAttempts = 0;
    sessionStorage.setItem('passwordAttempts', passwordAttempts);
}

function calculatePasswordStrength(password) {
    const checks = [
        password.length >= 12,
        /[A-Z]/.test(password),
        /[a-z]/.test(password),
        /[0-9]/.test(password),
        /[^A-Za-z0-9]/.test(password),
    ];
    return checks.filter(Boolean).length;
}

function renderPasswordStrength(password) {
    const strengthEl = document.getElementById('passwordStrength');
    strengthEl.innerHTML = '';
    const strength = calculatePasswordStrength(password);
    const colors = ['#f85149', '#ffa657', '#3fb950', '#3fb950', '#3fb950'];

    for (let i = 0; i < 5; i++) {
        const div = document.createElement('div');
        div.style.backgroundColor = i < strength ? colors[i] : '#30363d';
        strengthEl.appendChild(div);
    }
}

async function encryptText() {
    const text = document.getElementById('textToEncrypt').value;
    const password1 = document.getElementById('passwordEncrypt1').value;
    const password2 = document.getElementById('passwordEncrypt2').value;
    const errorEl = document.getElementById('encryptError');

    errorEl.textContent = '';

    if (!text || !password1 || !password2) {
        errorEl.textContent = "Please fill in all fields.";
        return;
    }

    if (password1 !== password2) {
        errorEl.textContent = "Passwords do not match!";
        return;
    }

    try {
        const encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text }),
            passwords: [password1],
            format: 'armored',
        });

        document.getElementById('encryptionResult').value = encrypted;
    } catch {
        errorEl.textContent = "Encryption failed. Please try again.";
    }
}

async function decryptText() {
    const encryptedText = document.getElementById('textToDecrypt').value;
    const password = document.getElementById('passwordDecrypt').value;
    const errorEl = document.getElementById('decryptError');

    errorEl.textContent = '';

    passwordAttempts++;
    sessionStorage.setItem('passwordAttempts', passwordAttempts);
    sessionStorage.setItem('lastAttemptTime', Date.now());

    if (passwordAttempts > MAX_PASSWORD_ATTEMPTS) {
        errorEl.textContent = "Too many failed attempts. Please try again later.";
        return;
    }

    if (!encryptedText || !password) {
        errorEl.textContent = "Please fill in all fields.";
        return;
    }

    try {
        const { data: decrypted } = await openpgp.decrypt({
            message: await openpgp.readMessage({ armoredMessage: encryptedText }),
            passwords: [password],
        });

        clearSensitiveData();
        passwordAttempts = 0;
        sessionStorage.setItem('passwordAttempts', passwordAttempts);
        document.getElementById('decryptionResult').value = decrypted;
    } catch {
        errorEl.textContent = "Decryption failed. Please try again.";
    }
}

function clearSensitiveData() {
    document.getElementById('passwordDecrypt').value = '';
    document.getElementById('textToDecrypt').value = '';
    document.getElementById('decryptionResult').value = '';

    if (window.crypto && window.crypto.subtle) {
        window.crypto.getRandomValues(new Uint8Array(1));
    }
}

async function copyToClipboard(elementId) {
    const textArea = document.getElementById(elementId);
    if (textArea.value) {
        try {
            await navigator.clipboard.writeText(textArea.value);
            alert("Text copied to clipboard!");
        } catch {
            alert("Failed to copy text.");
        }
        setTimeout(() => {
            navigator.clipboard.writeText('');
        }, 60000);
    } else {
        alert("No text to copy.");
    }
}

function downloadText(elementId, filename) {
    const textArea = document.getElementById(elementId);
    if (textArea.value) {
        const blob = new Blob([textArea.value], { type: 'text/plain' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();
    } else {
        alert("No text to download.");
    }
}

function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-buttons button').forEach(btn => btn.classList.remove('active'));
    document.getElementById(tabId).classList.add('active');
    document.querySelector(`button[onclick="showTab('${tabId}')"]`).classList.add('active');
}

document.getElementById('passwordEncrypt1').addEventListener('input', (e) => {
    renderPasswordStrength(e.target.value);
});

document.getElementById('passwordEncrypt1').setAttribute('type', 'password');
document.getElementById('passwordEncrypt2').setAttribute('type', 'password');
document.getElementById('passwordDecrypt').setAttribute('type', 'password');

const themeToggle = document.getElementById('themeToggle');
const moonIcon = '<i class="fas fa-moon"></i>';
const sunIcon = '<i class="fas fa-sun"></i>';

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    themeToggle.innerHTML = document.body.classList.contains('light-theme') ? moonIcon : sunIcon;
    localStorage.setItem("theme", document.body.classList.contains('light-theme') ? "light-theme" : "dark-theme");
});

document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.classList.add(savedTheme);
        themeToggle.innerHTML = savedTheme === 'light-theme' ? moonIcon : sunIcon;
    } else {
        document.body.classList.add('dark-theme');
        themeToggle.innerHTML = moonIcon;
    }
    showTab('encryptTab');
});
