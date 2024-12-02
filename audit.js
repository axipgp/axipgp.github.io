const CONFIG = {
    ITERATIONS: 1000000,
    MAX_PASSWORD_ATTEMPTS: 5,
    ATTEMPT_RESET_TIMEOUT: 5 * 60 * 1000,
    MAX_ENCRYPT_LENGTH: 10000,
    MAX_DECRYPT_LENGTH: 20000,
    CLIPBOARD_CLEAR_TIMEOUT: 60000,
};

let passwordAttempts = parseInt(sessionStorage.getItem('passwordAttempts')) || 0;
let lastAttemptTime = parseInt(sessionStorage.getItem('lastAttemptTime')) || Date.now();

function resetPasswordAttempts() {
    passwordAttempts = 0;
    sessionStorage.setItem('passwordAttempts', passwordAttempts);
}

function checkPasswordAttemptsReset() {
    if (Date.now() - lastAttemptTime > CONFIG.ATTEMPT_RESET_TIMEOUT) {
        resetPasswordAttempts();
    }
}

function calculatePasswordStrength(password) {
    const checks = [
        password.length >= 12,       // Length check
        /[A-Z]/.test(password),      // Uppercase letter
        /[a-z]/.test(password),      // Lowercase letter
        /[0-9]/.test(password),      // Number
        /[^A-Za-z0-9]/.test(password), // Special character
    ];
    return checks.filter(Boolean).length;
}

function renderPasswordStrength(password) {
    const strengthEl = document.getElementById('passwordStrength');
    strengthEl.innerHTML = '';
    const strength = calculatePasswordStrength(password);
    const colors = [
        '#f85149',    // Weak (red)
        '#ffa657',    // Medium-weak (orange)
        '#3fb950',    // Medium (green)
        '#3fb950',    // Strong (green)
        '#3fb950'     // Very strong (green)
    ];

    for (let i = 0; i < 5; i++) {
        const div = document.createElement('div');
        div.style.backgroundColor = i < strength ? colors[i] : '#30363d';
        strengthEl.appendChild(div);
    }
}

async function safeEncrypt(text, password) {
    try {
        return await openpgp.encrypt({
            message: await openpgp.createMessage({ text }),
            passwords: [password],
            format: 'armored',
            config: { 
                minRSABits: 2048,
                deflateLevel: 9
            }
        });
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Encryption failed');
    }
}

async function safeDecrypt(encryptedText, password) {
    try {
        const { data: decrypted } = await openpgp.decrypt({
            message: await openpgp.readMessage({ armoredMessage: encryptedText }),
            passwords: [password],
        });
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Decryption failed');
    }
}

async function encryptText() {
    const text = document.getElementById('textToEncrypt').value.trim();
    const password1 = document.getElementById('passwordEncrypt1').value;
    const password2 = document.getElementById('passwordEncrypt2').value;
    const errorEl = document.getElementById('encryptError');

    // Reset error
    errorEl.textContent = '';

    // Validation checks
    if (!text) {
        errorEl.textContent = "Please enter text to encrypt.";
        return;
    }

    if (text.length > CONFIG.MAX_ENCRYPT_LENGTH) {
        errorEl.textContent = `Text exceeds maximum length of ${CONFIG.MAX_ENCRYPT_LENGTH} characters.`;
        return;
    }

    if (!password1 || !password2) {
        errorEl.textContent = "Please enter and confirm your password.";
        return;
    }

    if (password1 !== password2) {
        errorEl.textContent = "Passwords do not match!";
        return;
    }

    // Password strength check
    if (calculatePasswordStrength(password1) < 3) {
        errorEl.textContent = "Password is too weak. Use a stronger password.";
        return;
    }

    try {
        const encrypted = await safeEncrypt(text, password1);
        document.getElementById('encryptionResult').value = encrypted;
    } catch {
        errorEl.textContent = "Encryption failed. Please try again.";
    }
}

async function decryptText() {
    const encryptedText = document.getElementById('textToDecrypt').value.trim();
    const password = document.getElementById('passwordDecrypt').value;
    const errorEl = document.getElementById('decryptError');

    // Reset error
    errorEl.textContent = '';

    // Attempt tracking
    passwordAttempts++;
    sessionStorage.setItem('passwordAttempts', passwordAttempts);
    sessionStorage.setItem('lastAttemptTime', Date.now());

    // Check max attempts
    if (passwordAttempts > CONFIG.MAX_PASSWORD_ATTEMPTS) {
        errorEl.textContent = "Too many failed attempts. Please try again later.";
        return;
    }

    // Validation checks
    if (!encryptedText) {
        errorEl.textContent = "Please enter encrypted text.";
        return;
    }

    if (encryptedText.length > CONFIG.MAX_DECRYPT_LENGTH) {
        errorEl.textContent = `Encrypted text exceeds maximum length of ${CONFIG.MAX_DECRYPT_LENGTH} characters.`;
        return;
    }

    if (!password) {
        errorEl.textContent = "Please enter your password.";
        return;
    }

    try {
        const decrypted = await safeDecrypt(encryptedText, password);

        // Reset password attempts on successful decryption
        resetPasswordAttempts();
        clearSensitiveData();

        document.getElementById('decryptionResult').value = decrypted;
    } catch {
        errorEl.textContent = "Decryption failed. Please check your password and try again.";
    }
}

function clearSensitiveData() {
    // Clear sensitive input fields
    ['passwordDecrypt', 'textToDecrypt', 'decryptionResult'].forEach(id => {
        const element = document.getElementById(id);
        if (element) element.value = '';
    });

    // Additional security: randomize memory
    if (window.crypto && window.crypto.subtle) {
        window.crypto.getRandomValues(new Uint8Array(1024));
    }
}

async function copyToClipboard(elementId) {
    const textArea = document.getElementById(elementId);
    if (textArea && textArea.value) {
        try {
            await navigator.clipboard.writeText(textArea.value);
            alert("Text copied to clipboard!");

            // Auto-clear clipboard
            setTimeout(() => {
                navigator.clipboard.writeText('');
            }, CONFIG.CLIPBOARD_CLEAR_TIMEOUT);
        } catch {
            alert("Failed to copy text.");
        }
    } else {
        alert("No text to copy.");
    }
}

function downloadText(elementId, filename) {
    const textArea = document.getElementById(elementId);
    if (textArea && textArea.value) {
        const blob = new Blob([textArea.value], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.click();

        // Revoke object URL to free up memory
        URL.revokeObjectURL(link.href);
    } else {
        alert("No text to download.");
    }
}

function showTab(tabId) {
    // Hide all tab contents
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
        tab.setAttribute('hidden', '');
    });

    // Remove active state from all tab buttons
    document.querySelectorAll('.tab-buttons button').forEach(btn => {
        btn.classList.remove('active');
        btn.setAttribute('aria-selected', 'false');
    });

    // Show selected tab
    const selectedTab = document.getElementById(tabId);
    if (selectedTab) {
        selectedTab.classList.add('active');
        selectedTab.removeAttribute('hidden');
    }

    // Activate corresponding button
    const selectedButton = document.querySelector(`button[onclick="showTab('${tabId}')"]`);
    if (selectedButton) {
        selectedButton.classList.add('active');
        selectedButton.setAttribute('aria-selected', 'true');
    }
}

// Password strength rendering
document.getElementById('passwordEncrypt1').addEventListener('input', (e) => {
    renderPasswordStrength(e.target.value);
});

// Set password input types
['passwordEncrypt1', 'passwordEncrypt2', 'passwordDecrypt'].forEach(id => {
    const element = document.getElementById(id);
    if (element) {
        element.setAttribute('type', 'password');
        element.setAttribute('autocomplete', id.includes('Encrypt') ? 'new-password' : 'current-password');
    }
});

// Theme toggle setup
const themeToggle = document.getElementById('themeToggle');
const moonIcon = '<i class="fas fa-moon"></i>';
const sunIcon = '<i class="fas fa-sun"></i>';

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    themeToggle.innerHTML = document.body.classList.contains('light-theme') ? moonIcon : sunIcon;
    localStorage.setItem("theme", document.body.classList.contains('light-theme') ? "light-theme" : "dark-theme");
});

// Initial page load setup
document.addEventListener('DOMContentLoaded', () => {
    // Check and reset password attempts if needed
    checkPasswordAttemptsReset();

    // Theme setup
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.classList.add(savedTheme);
        themeToggle.innerHTML = savedTheme === 'light-theme' ? moonIcon : sunIcon;
    } else {
        document.body.classList.add('dark-theme');
        themeToggle.innerHTML = moonIcon;
    }

    // Default to encrypt tab
    showTab('encryptTab');
});
