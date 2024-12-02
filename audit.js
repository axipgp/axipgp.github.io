// Configuration Constants
const CONFIG = {
    ITERATIONS: 1000000,
    MAX_PASSWORD_ATTEMPTS: 5,
    ATTEMPT_RESET_TIMEOUT: 5 * 60 * 1000,
    MAX_ENCRYPT_LENGTH: 10000,
    MAX_DECRYPT_LENGTH: 20000,
    CLIPBOARD_CLEAR_TIMEOUT: 60000,
};

// State Management for Password Attempts
let passwordAttempts = 0;
let lastAttemptTime = 0;

// Initialize OpenPGP and Application
document.addEventListener('DOMContentLoaded', async () => {
    // Initialize session storage for password attempts
    passwordAttempts = parseInt(sessionStorage.getItem('passwordAttempts')) || 0;
    lastAttemptTime = parseInt(sessionStorage.getItem('lastAttemptTime')) || Date.now();

    // Initialize OpenPGP library
    try {
        await openpgp.init({
            workers: navigator.hardwareConcurrency || 2
        });
    } catch (error) {
        console.error('OpenPGP initialization failed:', error);
        alert('Encryption library failed to load. Please refresh the page.');
    }

    // Check and reset password attempts if needed
    checkPasswordAttemptsReset();

    // Theme setup
    setupThemeToggle();

    // Default to encrypt tab
    showTab('encryptTab');

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
});

// Password Attempts Management
function checkPasswordAttemptsReset() {
    if (Date.now() - lastAttemptTime > CONFIG.ATTEMPT_RESET_TIMEOUT) {
        resetPasswordAttempts();
    }
}

function resetPasswordAttempts() {
    passwordAttempts = 0;
    sessionStorage.setItem('passwordAttempts', passwordAttempts);
}

// Password Strength Calculation
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

// Encryption Functions
async function safeEncrypt(text, password) {
    try {
        const message = await openpgp.createMessage({ text: text });
        const encrypted = await openpgp.encrypt({
            message: message,
            passwords: [password],
            format: 'armored',
            config: { 
                minRSABits: 2048,
                deflateLevel: 9,
                s2kIterationLevel: 8 
            }
        });
        return encrypted;
    } catch (error) {
        console.error('Encryption error:', error);
        throw new Error('Encryption failed');
    }
}

async function safeDecrypt(encryptedText, password) {
    try {
        const message = await openpgp.readMessage({ armoredMessage: encryptedText });
        const { data: decrypted } = await openpgp.decrypt({
            message: message,
            passwords: [password]
        });
        return decrypted;
    } catch (error) {
        console.error('Decryption error:', error);
        throw new Error('Decryption failed');
    }
}

// Encryption Process
async function encryptText() {
    const textEl = document.getElementById('textToEncrypt');
    const password1El = document.getElementById('passwordEncrypt1');
    const password2El = document.getElementById('passwordEncrypt2');
    const errorEl = document.getElementById('encryptError');
    const resultEl = document.getElementById('encryptionResult');

    // Reset error
    errorEl.textContent = '';

    const text = textEl.value.trim();
    const password1 = password1El.value;
    const password2 = password2El.value;

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
        resultEl.value = encrypted;
        
        // Clear sensitive inputs
        textEl.value = '';
        password1El.value = '';
        password2El.value = '';
    } catch (error) {
        errorEl.textContent = "Encryption failed. Please try again.";
        console.error(error);
    }
}

// Decryption Process
async function decryptText() {
    const textEl = document.getElementById('textToDecrypt');
    const passwordEl = document.getElementById('passwordDecrypt');
    const errorEl = document.getElementById('decryptError');
    const resultEl = document.getElementById('decryptionResult');

    // Reset error
    errorEl.textContent = '';

    const encryptedText = textEl.value.trim();
    const password = passwordEl.value;

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

        // Display decrypted text
        resultEl.value = decrypted;

        // Clear sensitive inputs
        textEl.value = '';
        passwordEl.value = '';
    } catch (error) {
        errorEl.textContent = "Decryption failed. Please check your password and try again.";
        console.error(error);
    }
}

// Clipboard and Download Utilities
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

// Tab Management
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

// Theme Toggle Setup
function setupThemeToggle() {
    const themeToggle = document.getElementById('themeToggle');
    const moonIcon = '<i class="fas fa-moon"></i>';
    const sunIcon = '<i class="fas fa-sun"></i>';

    // Load saved theme or default to dark
    const savedTheme = localStorage.getItem('theme') || 'dark-theme';
    document.body.classList.add(savedTheme);
    themeToggle.innerHTML = savedTheme === 'light-theme' ? sunIcon : moonIcon;

    // Toggle theme on click
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        document.body.classList.toggle('dark-theme');
        
        const isLightTheme = document.body.classList.contains('light-theme');
        themeToggle.innerHTML = isLightTheme ? sunIcon : moonIcon;
        
        localStorage.setItem("theme", isLightTheme ? "light-theme" : "dark-theme");
    });
}
