const roleButtons = [...document.querySelectorAll('[data-role]')];
const authForm = document.querySelector('#auth-form');
const authMessage = document.querySelector('#auth-message');
const formTitle = document.querySelector('#form-title');
const submitButton = document.querySelector('#submit-button');
const signupPrompt = document.querySelector('#signup-prompt');
const modeToggle = document.querySelector('#mode-toggle');
const nameField = document.querySelector('#student-name');
const phoneField = document.querySelector('#student-phone');
const passwordField = document.querySelector('#account-password');
let role = 'student';
let mode = 'login';

function renderForm() {
    const isAdmin = role === 'admin';
    const isSignup = mode === 'signup' && !isAdmin;
    document.querySelectorAll('.student-only').forEach((element) => { element.hidden = isAdmin; });
    document.querySelectorAll('.signup-only').forEach((element) => { element.hidden = !isSignup; });
    phoneField.required = !isAdmin;
    nameField.required = isSignup;
    passwordField.autocomplete = isSignup ? 'new-password' : 'current-password';
    passwordField.minLength = isSignup ? 8 : 0;
    formTitle.textContent = isAdmin ? 'Admin login' : isSignup ? 'Create student account' : 'Student login';
    submitButton.innerHTML = isSignup
        ? '<i class="fa-solid fa-user-plus"></i> Create account'
        : `<i class="fa-solid fa-right-to-bracket"></i> Sign in as ${role}`;
    signupPrompt.hidden = isAdmin;
    modeToggle.textContent = isSignup ? 'Sign in instead' : 'Create an account';
    roleButtons.forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.role === role)));
    authMessage.textContent = '';
    authMessage.className = 'app-message';
}

async function requestJson(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not sign in.');
    return result;
}

roleButtons.forEach((button) => button.addEventListener('click', () => {
    role = button.dataset.role;
    mode = 'login';
    renderForm();
}));

modeToggle.addEventListener('click', () => {
    mode = mode === 'signup' ? 'login' : 'signup';
    renderForm();
});

authForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    submitButton.disabled = true;
    authMessage.textContent = '';
    authMessage.className = 'app-message';
    const body = { password: passwordField.value };
    if (role === 'student') {
        body.phone = phoneField.value;
        if (mode === 'signup') body.name = nameField.value;
    }

    try {
        const endpoint = role === 'admin'
            ? '/api/admin/login'
            : mode === 'signup' ? '/api/student/signup' : '/api/student/login';
        await requestJson(endpoint, body);
        window.location.replace(role === 'admin' ? 'admin.html' : 'student.html');
    } catch (error) {
        authMessage.textContent = error.message;
        authMessage.classList.add('error');
        submitButton.disabled = false;
    }
});

fetch('/api/auth/session')
    .then((response) => response.json())
    .then(({ role: authenticatedRole }) => {
        if (authenticatedRole === 'admin') window.location.replace('admin.html');
        if (authenticatedRole === 'student') window.location.replace('student.html');
    })
    .catch(() => {});

renderForm();