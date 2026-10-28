// Login and registration. On success the JWT is saved and the user goes to the dashboard.

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const tabs = { login: document.getElementById('tab-login'), register: document.getElementById('tab-register') };
const notice = document.getElementById('notice');

// Already logged in? Go straight to the dashboard (it sends you back here if the token is invalid)
if (auth.getToken()) location.replace('/');

const reason = new URLSearchParams(location.search).get('reason');
if (reason === 'expired') {
  notice.textContent = 'Your session ended. Please log in again.';
  notice.hidden = false;
}

function showTab(name) {
  const isLogin = name === 'login';
  tabs.login.setAttribute('aria-selected', String(isLogin));
  tabs.register.setAttribute('aria-selected', String(!isLogin));
  loginForm.hidden = !isLogin;
  registerForm.hidden = isLogin;
  (isLogin ? loginForm : registerForm).querySelector('input').focus();
}
tabs.login.addEventListener('click', () => showTab('login'));
tabs.register.addEventListener('click', () => showTab('register'));

function setErrors(form, errors) {
  form.querySelectorAll('.field-error').forEach((el) => {
    if (el.dataset.errorFor === 'password' && form === registerForm) el.textContent = 'At least 8 characters';
    else el.textContent = '';
  });
  form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));
  let first;
  for (const [field, message] of Object.entries(errors)) {
    const slot = form.querySelector(`[data-error-for="${field}"]`);
    if (slot) slot.textContent = message;
    const input = form.elements[field];
    if (input) { input.setAttribute('aria-invalid', 'true'); first ??= input; }
  }
  first?.focus();
}

async function submitWith(form, button, action) {
  const label = button.textContent;
  button.disabled = true;
  button.textContent = 'Please wait…';
  try {
    const { token } = await action();
    auth.setToken(token);
    location.replace('/');
  } catch (err) {
    setErrors(form, err.errors);
    toast(err.message, 'error');
    button.disabled = false;
    button.textContent = label;
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const email = loginForm.elements.email.value.trim();
  const password = loginForm.elements.password.value;
  const errors = {};
  if (!EMAIL_RE.test(email)) errors.email = 'Please enter a valid email address';
  if (!password) errors.password = 'Password is required';
  if (Object.keys(errors).length) return setErrors(loginForm, errors);
  submitWith(loginForm, loginForm.querySelector('[type=submit]'), () => api.login(email, password));
});

registerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const data = {
    name: registerForm.elements.name.value.trim(),
    email: registerForm.elements.email.value.trim(),
    password: registerForm.elements.password.value,
    currency: registerForm.elements.currency.value,
  };
  const errors = {};
  if (data.name.length < 2) errors.name = 'Name must be at least 2 characters';
  if (!EMAIL_RE.test(data.email)) errors.email = 'Please enter a valid email address';
  if (data.password.length < 8) errors.password = 'Password must be at least 8 characters';
  if (Object.keys(errors).length) return setErrors(registerForm, errors);
  submitWith(registerForm, registerForm.querySelector('[type=submit]'), () => api.register(data));
});

document.getElementById('use-demo').addEventListener('click', () => {
  loginForm.elements.email.value = 'demo@example.com';
  loginForm.elements.password.value = 'demo1234';
  loginForm.querySelector('[type=submit]').focus();
});
