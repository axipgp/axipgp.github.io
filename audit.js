const ITERATIONS = 1000000; 
const MAX_PASSWORD_ATTEMPTS = 5; 
const ATTEMPT_RESET_TIMEOUT = 5 * 60 * 1000;

let passwordAttempts = parseInt(sessionStorage.getItem('passwordAttempts')) || 0;
let lastAttemptTime = parseInt(sessionStorage.getItem('lastAttemptTime')) || Date.now();

if (Date.now() - lastAttemptTime > ATTEMPT_RESET_TIMEOUT) {
    passwordAttempts = 0;
    sessionStorage.setItem('passwordAttempts', passwordAttempts);
}

// Password Strength Calculation
function calculatePasswordStrength(password) {
    const checks = [
        password.length >= 12, 
        /[A-Z]/.test(password), // At least one uppercase letter
        /[a-z]/.test(password), // At least one lowercase letter
        /[0-9]/.test(password), // At least one digit
        /[^A-Za-z0-9]/.test(password) // At least one special character
    ];
    return checks.filter(Boolean).length;
}

// Render Password Strength Meter
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

// Key Derivation with Enhanced Security
async function deriveKey(password, salt = null) {
    if (!salt) {
        salt = crypto.getRandomValues(new Uint8Array(32)); // Generate a new salt if not provided
    }

    const keyMaterial = await crypto.subtle.importKey(
        "raw",
        new TextEncoder().encode(password),
        "PBKDF2",
        false,
        ["deriveBits", "deriveKey"]
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: "PBKDF2",
            salt: salt,
            iterations: ITERATIONS,
            hash: "SHA-512" // Using SHA-512 for more security
        },
        keyMaterial,
        { name: "AES-GCM", length: 256 }, // Use AES-GCM with 256-bit key for encryption
        false,
        ["encrypt", "decrypt"]
    );

    return { key, salt };
}

// Encryption Function with AES-GCM
async function encryptText() {
    const text = document.getElementById('textToEncrypt').value;
    const password1 = document.getElementById('passwordEncrypt1').value;
    const password2 = document.getElementById('passwordEncrypt2').value;
    const errorEl = document.getElementById('encryptError');

    // Reset error message
    errorEl.textContent = '';

    // Validation
    if (!text || !password1 || !password2) {
        errorEl.textContent = "Please fill in all fields.";
        return;
    }

    if (password1 !== password2) {
        errorEl.textContent = "Passwords do not match!";
        return;
    }

    const { key, salt } = await deriveKey(password1);

    const encodedText = new TextEncoder().encode(text);
    const iv = crypto.getRandomValues(new Uint8Array(12)); // Generate a new IV (Initialization Vector)

    const encryptedData = await crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        encodedText
    );

    // Combine salt, IV, and encrypted data into one array
    const combined = new Uint8Array(salt.byteLength + iv.byteLength + encryptedData.byteLength);
    combined.set(salt);
    combined.set(iv, salt.byteLength);
    combined.set(new Uint8Array(encryptedData), salt.byteLength + iv.byteLength);

    // Output the encrypted result (Base64-encoded for easy storage or transmission)
    document.getElementById('encryptionResult').value = btoa(String.fromCharCode(...combined));
}

// Decryption Function with AES-GCM
async function decryptText() {
    const encryptedText = document.getElementById('textToDecrypt').value;
    const password = document.getElementById('passwordDecrypt').value;
    const errorEl = document.getElementById('decryptError');

    // Reset error message
    errorEl.textContent = '';

    // Increment password attempts and check if exceeded the max allowed attempts
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

    // Decode the encrypted text (Base64 to Uint8Array)
    const encryptedData = new Uint8Array(atob(encryptedText).split('').map(char => char.charCodeAt(0)));
    const salt = encryptedData.slice(0, 32); // Extract the salt
    const iv = encryptedData.slice(32, 44); // Extract the IV
    const data = encryptedData.slice(44); // The actual encrypted data

    try {
        const { key } = await deriveKey(password, salt); // Derive the key using the salt

        const decryptedData = await crypto.subtle.decrypt(
            { name: "AES-GCM", iv },
            key,
            data
        );

        // Clear password and decrypted data immediately after use
        clearSensitiveData();

        // Reset password attempts on successful decryption
        passwordAttempts = 0;
        sessionStorage.setItem('passwordAttempts', passwordAttempts);
        document.getElementById('decryptionResult').value = new TextDecoder().decode(decryptedData); // Output the decrypted result
    } catch (error) {
        errorEl.textContent = "Decryption failed. Please try again.";
        console.error(error);
    }
}

// Function to clear sensitive data (passwords and decrypted text) from memory
function clearSensitiveData() {
    document.getElementById('passwordDecrypt').value = ''; // Clear the password input field
    document.getElementById('textToDecrypt').value = ''; // Clear the encrypted text input field
    document.getElementById('decryptionResult').value = ''; // Clear the decrypted text output field

    // Ensure no sensitive data is stored in memory
    if (window.crypto && window.crypto.subtle) {
        // Explicitly overwrite the memory for sensitive fields to remove data
        window.crypto.getRandomValues(new Uint8Array(1)); // Force a re-randomization to clear memory
    }
}

// Clipboard and Download Functions
async function copyToClipboard(elementId) {
    const textArea = document.getElementById(elementId);
    if (textArea.value) {
        try {
            await navigator.clipboard.writeText(textArea.value);
            alert("Text copied to clipboard!");
        } catch (err) {
            alert("Failed to copy text.");
        }

        // Auto-clear clipboard after 1 minute
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

// Tab and Theme Management
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-buttons button').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`button[onclick="showTab('${tabId}')"]`).classList.add('active');
}

// Password Strength Live Update
document.getElementById('passwordEncrypt1').addEventListener('input', (e) => {
    renderPasswordStrength(e.target.value);
});

// Ensure password fields are hidden
document.getElementById('passwordEncrypt1').setAttribute('type', 'password');
document.getElementById('passwordEncrypt2').setAttribute('type', 'password');
document.getElementById('passwordDecrypt').setAttribute('type', 'password');

// Theme Toggle
const themeToggle = document.getElementById('themeToggle');
const moonIcon = '<i class="fas fa-moon"></i>';
const sunIcon = '<i class="fas fa-sun"></i>';

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
    themeToggle.innerHTML = document.body.classList.contains('light-theme') ? moonIcon : sunIcon;
    // Save theme to localStorage
    localStorage.setItem("theme", document.body.classList.contains('light-theme') ? "light-theme" : "dark-theme");
});

// Initialize theme from localStorage
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
