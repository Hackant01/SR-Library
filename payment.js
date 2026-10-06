const planSelect = document.querySelector('#plan');
const durationSelect = document.querySelector('#duration');
const checkoutForm = document.querySelector('#checkout-form');
const checkoutMessage = document.querySelector('#checkout-message');
const demoPayment = document.querySelector('#demo-payment');
const paymentMessage = document.querySelector('#payment-message');
const params = new URLSearchParams(window.location.search);
let catalog;
let bookingId;

function formatRupees(amount) {
    return `₹${Number(amount).toLocaleString('en-IN')}`;
}

function formatOption(value) {
    return value.replaceAll('-', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function updatePrice() {
    const plan = catalog.plans[planSelect.value];
    const duration = durationSelect.value;
    const amount = plan?.durations[duration] || 0;
    document.querySelector('#summary-plan').textContent = `${plan?.label || ''} · ${formatOption(duration)}`;
    document.querySelector('#plan-amount').textContent = formatRupees(amount);
    document.querySelector('#registration-amount').textContent = formatRupees(catalog.registrationFee);
    document.querySelector('#total-amount').textContent = formatRupees(amount + catalog.registrationFee);
}

function updateDurations(preferredDuration) {
    const durations = catalog.plans[planSelect.value].durations;
    durationSelect.replaceChildren(...Object.entries(durations).map(([duration, amount]) => {
        const option = document.createElement('option');
        option.value = duration;
        option.textContent = `${formatOption(duration)} · ${formatRupees(amount)}`;
        return option;
    }));
    if (preferredDuration && durations[preferredDuration]) durationSelect.value = preferredDuration;
    updatePrice();
}

async function sendJson(url, body) {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Something went wrong.');
    return result;
}

async function loadCatalog() {
    const response = await fetch('/api/plans');
    if (!response.ok) throw new Error('Could not load plans. Start the site with npm start.');
    catalog = await response.json();

    for (const [key, plan] of Object.entries(catalog.plans)) {
        const option = document.createElement('option');
        option.value = key;
        option.textContent = plan.label;
        planSelect.append(option);
    }

    const requestedPlan = params.get('plan');
    if (requestedPlan && catalog.plans[requestedPlan]) planSelect.value = requestedPlan;
    updateDurations(params.get('duration'));
}

planSelect.addEventListener('change', () => updateDurations());
durationSelect.addEventListener('change', updatePrice);

checkoutForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    checkoutMessage.className = 'app-message';
    checkoutMessage.textContent = '';
    const submitButton = checkoutForm.querySelector('[type="submit"]');
    submitButton.disabled = true;
    try {
        const result = await sendJson('/api/bookings', {
            name: checkoutForm.elements.name.value,
            phone: checkoutForm.elements.phone.value,
            plan: planSelect.value,
            duration: durationSelect.value
        });
        bookingId = result.id;
        checkoutForm.hidden = true;
        demoPayment.hidden = false;
    } catch (error) {
        checkoutMessage.textContent = error.message;
        checkoutMessage.classList.add('error');
        submitButton.disabled = false;
    }
});

document.querySelector('#demo-pay-button').addEventListener('click', async (event) => {
    const button = event.currentTarget;
    button.disabled = true;
    paymentMessage.className = 'app-message';
    try {
        await sendJson(`/api/bookings/${bookingId}/demo-pay`, {});
        paymentMessage.textContent = 'Demo payment recorded. No real payment was made.';
        paymentMessage.classList.add('success');
        button.hidden = true;
    } catch (error) {
        paymentMessage.textContent = error.message;
        paymentMessage.classList.add('error');
        button.disabled = false;
    }
});

loadCatalog().catch((error) => {
    checkoutForm.hidden = true;
    checkoutMessage.textContent = error.message;
    checkoutMessage.classList.add('error');
});