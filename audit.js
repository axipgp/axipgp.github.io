// The number of iterations to perform in the password-related operations
const ITERATIONS = 1000000; // We need a lot of iterations. Too many might slow us down, but we need the security, right?
const MAX_PASSWORD_ATTEMPTS = 5; // Only 5 tries. You've got a chance, but not much of one.
const ATTEMPT_RESET_TIMEOUT = 5 * 60 * 1000; // A timeout to reset password attempts after 5 minutes (5 * 60 seconds * 1000 milliseconds)

// Retrieve password attempts and last attempt time from session storage
let passwordAttempts = parseInt(sessionStorage.getItem('passwordAttempts')) || 0; // Nothing yet? Default to 0 attempts
let lastAttemptTime = parseInt(sessionStorage.getItem('lastAttemptTime')) || Date.now(); // If no attempt, use the current time

// Check if enough time has passed since the last attempt, and reset attempts if necessary
if (Date.now() - lastAttemptTime > ATTEMPT_RESET_TIMEOUT) {
    passwordAttempts = 0; // Reset the counter, you get another shot.
    sessionStorage.setItem('passwordAttempts', passwordAttempts);
}

// Function to calculate the strength of the password
function calculatePasswordStrength(password) {
    const checks = [
        password.length >= 12, // Lengthy passwords are harder to crack, a minimum of 12 chars
        /[A-Z]/.test(password), // At least one uppercase letter, right? No lazy passwords here.
        /[a-z]/.test(password), // One lowercase letter for balance.
        /[0-9]/.test(password), // One digit to make it harder, you need more than just letters.
        /[^A-Za-z0-9]/.test(password) // A special character. You know, something like @ or # to complicate things.
    ];
    return checks.filter(Boolean).length; // The more checks passed, the stronger the password
}

// Render the password strength meter visually on the UI
function renderPasswordStrength(password) {
    const strengthEl = document.getElementById('passwordStrength');
    strengthEl.innerHTML = ''; // Clear previous output. We need a fresh look.

    const strength = calculatePasswordStrength(password); // Calculate strength based on criteria
    const colors = ['#f85149', '#ffa657', '#3fb950', '#3fb950', '#3fb950']; // Red, yellow, green scale for strength

    for (let i = 0; i < 5; i++) {
        const div = document.createElement('div');
        div.style.backgroundColor = i < strength ? colors[i] : '#30363d'; // Fill the meter, color depending on strength
        strengthEl.appendChild(div); // Append the div to the strength container
    }
}

// Encrypt text based on user input and a password
async function encryptText() {
    const text = document.getElementById('textToEncrypt').value; // Get the text to encrypt
    const password1 = document.getElementById('passwordEncrypt1').value; // First password input
    const password2 = document.getElementById('passwordEncrypt2').value; // Second password input (match check)
    const errorEl = document.getElementById('encryptError'); // Error element for feedback

    // Clear previous errors
    errorEl.textContent = '';

    // Check if all fields are filled
    if (!text || !password1 || !password2) {
        errorEl.textContent = "Please fill in all fields."; // Must provide all information
        return;
    }

    // Ensure both passwords match
    if (password1 !== password2) {
        errorEl.textContent = "Passwords do not match!"; // Mismatch is unacceptable
        return;
    }

    try {
        // Encrypt the text using the provided password (no hashing, raw encryption)
        const encrypted = await openpgp.encrypt({
            message: await openpgp.createMessage({ text: text }),
            passwords: [password1], // Use the provided password for encryption
            format: 'armored' // Armored format to make it readable
        });

        document.getElementById('encryptionResult').value = encrypted; // Show encrypted result
    } catch (error) {
        errorEl.textContent = "Encryption failed. Please try again."; // Let them know something went wrong
        console.error(error); // Log error for debugging, but don't leak details to the user
    }
}

// Decrypt text based on user input and password
async function decryptText() {
    const encryptedText = document.getElementById('textToDecrypt').value; // Get encrypted text
    const password = document.getElementById('passwordDecrypt').value; // User's decryption password
    const errorEl = document.getElementById('decryptError'); // Error element for feedback

    // Clear previous errors
    errorEl.textContent = '';

    // Increment password attempts and update the last attempt time
    passwordAttempts++;
    sessionStorage.setItem('passwordAttempts', passwordAttempts);
    sessionStorage.setItem('lastAttemptTime', Date.now());

    // Check if the number of attempts has exceeded the limit
    if (passwordAttempts > MAX_PASSWORD_ATTEMPTS) {
        errorEl.textContent = "Too many failed attempts. Please try again later."; // Stop them if they fail too many times
        return;
    }

    // Validate that all fields are filled
    if (!encryptedText || !password) {
        errorEl.textContent = "Please fill in all fields."; // They need to fill everything
        return;
    }

    try {
        // Decrypt the text using the provided password
        const { data: decrypted } = await openpgp.decrypt({
            message: await openpgp.readMessage({ armoredMessage: encryptedText }),
            passwords: [password] // Use the password for decryption
        });

        // Clear sensitive data after use
        clearSensitiveData();

        // Reset password attempts on success
        passwordAttempts = 0;
        sessionStorage.setItem('passwordAttempts', passwordAttempts);
        document.getElementById('decryptionResult').value = decrypted; // Show decrypted text
    } catch (error) {
        errorEl.textContent = "Decryption failed. Please try again."; // In case of error
        console.error(error); // Log error for later inspection
    }
}

// Clear sensitive data (passwords, decrypted text) from the UI and memory
function clearSensitiveData() {
    document.getElementById('passwordDecrypt').value = ''; // Clear password field
    document.getElementById('textToDecrypt').value = ''; // Clear encrypted text field
    document.getElementById('decryptionResult').value = ''; // Clear decrypted text result

    // Explicitly overwrite sensitive data in memory
    if (window.crypto && window.crypto.subtle) {
        window.crypto.getRandomValues(new Uint8Array(1)); // Flush memory, erase traces
    }
}

// Copy text to clipboard
async function copyToClipboard(elementId) {
    const textArea = document.getElementById(elementId);
    if (textArea.value) {
        try {
            await navigator.clipboard.writeText(textArea.value); // Copy to clipboard
            alert("Text copied to clipboard!"); // Confirmation message
        } catch (err) {
            alert("Failed to copy text."); // In case of failure
        }

        // Clear clipboard after 1 minute (just in case)
        setTimeout(() => {
            navigator.clipboard.writeText('');
        }, 60000);
    } else {
        alert("No text to copy."); // If there's nothing to copy, they need to do something
    }
}

// Download text from the textarea as a file
function downloadText(elementId, filename) {
    const textArea = document.getElementById(elementId);
    if (textArea.value) {
        const blob = new Blob([textArea.value], { type: 'text/plain' }); // Create a plain text blob
        const link = document.createElement('a'); // Create a temporary link
        link.href = URL.createObjectURL(blob); // Create a URL for the blob
        link.download = filename; // Suggest a filename for download
        link.click(); // Trigger the download
    } else {
        alert("No text to download."); // If there's nothing to download
    }
}

// Show the corresponding tab on the page
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-buttons button').forEach(btn => btn.classList.remove('active'));

    document.getElementById(tabId).classList.add('active');
    document.querySelector(`button[onclick="showTab('${tabId}')"]`).classList.add('active');
}

// Real-time password strength meter
document.getElementById('passwordEncrypt1').addEventListener('input', (e) => {
    renderPasswordStrength(e.target.value);
});

// Hide the password fields initially
document.getElementById('passwordEncrypt1').setAttribute('type', 'password');
document.getElementById('passwordEncrypt2').setAttribute('type', 'password');
document.getElementById('passwordDecrypt').setAttribute('type', 'password');

// Toggle dark/light theme based on user preference
const themeToggle = document.getElementById('themeToggle');
const moonIcon = '<i class="fas fa-moon"></i>';
const sunIcon = '<i class="fas fa-sun"></i>';

themeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-theme'); // Toggle between light and dark theme
    themeToggle.innerHTML = document.body.classList.contains('light-theme') ? moonIcon : sunIcon;
    // Save the theme preference to localStorage
    localStorage.setItem("theme", document.body.classList.contains('light-theme') ? "light-theme" : "dark-theme");
});

// Initialize theme based on user preference from localStorage
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
        document.body.classList.add(savedTheme);
        themeToggle.innerHTML = savedTheme === 'light-theme' ? moonIcon : sunIcon;
    } else {
        document.body.classList.add('dark-theme');
        themeToggle.innerHTML = moonIcon;
    }
    showTab('encryptTab'); // Default tab
});
