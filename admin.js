const loginPanel = document.querySelector('#login-panel');
const loginForm = document.querySelector('#login-form');
const loginMessage = document.querySelector('#login-message');
const dashboard = document.querySelector('#dashboard');
const logoutButton = document.querySelector('#logout-button');
const tableMessage = document.querySelector('#table-message');

function formatRupees(amount) {
    return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

async function getJson(url, options = {}) {
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', ...options.headers } });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Request failed.');
    return result;
}

function showDashboard() {
    loginPanel.hidden = true;
    dashboard.hidden = false;
    logoutButton.hidden = false;
    refreshDashboard();
}

async function refreshDashboard() {
    tableMessage.className = 'app-message';
    tableMessage.textContent = '';
    try {
        const [{ summary }, { bookings }] = await Promise.all([
            getJson('/api/admin/summary'),
            getJson('/api/admin/bookings')
        ]);
        const stats = [
            ['Bookings', summary.bookings || 0],
            ['Pending', summary.pending || 0],
            ['Demo payments', formatRupees(summary.demoPaidAmount)]
        ];
        const statsContainer = document.querySelector('#admin-stats');
        statsContainer.replaceChildren(...stats.map(([label, value]) => {
            const item = document.createElement('div');
            item.className = 'stat-box admin-stat';
            const amount = document.createElement('strong');
            amount.textContent = value;
            const caption = document.createElement('span');
            caption.textContent = label;
            item.append(amount, caption);
            return item;
        }));

        const rows = bookings.map((booking) => {
            const row = document.createElement('tr');
            const values = [
                `${booking.name}\n${booking.phone}`,
                `${booking.plan}\n${booking.duration.replaceAll('-', ' ')}`,
                formatRupees(booking.total_amount),
                booking.payment_status === 'demo_paid' ? 'Paid (demo)' : 'Pending',
                new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(booking.created_at))
            ];
            for (const value of values) {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.append(cell);
            }
            return row;
        });
        const body = document.querySelector('#bookings-body');
        body.replaceChildren(...rows);
        if (!rows.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 5;
            cell.className = 'empty-state';
            cell.textContent = 'No bookings yet.';
            row.append(cell);
            body.append(row);
        }
    } catch (error) {
        if (error.message === 'Admin login required.') {
            dashboard.hidden = true;
            logoutButton.hidden = true;
            loginPanel.hidden = false;
        } else {
            tableMessage.textContent = error.message;
            tableMessage.classList.add('error');
        }
    }
}

loginForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    loginMessage.className = 'app-message';
    loginMessage.textContent = '';
    try {
        await getJson('/api/admin/login', {
            method: 'POST',
            body: JSON.stringify({ password: loginForm.elements.password.value })
        });
        loginForm.reset();
        showDashboard();
    } catch (error) {
        loginMessage.textContent = error.message;
        loginMessage.classList.add('error');
    }
});

logoutButton.addEventListener('click', async () => {
    await getJson('/api/admin/logout', { method: 'POST', body: '{}' });
    dashboard.hidden = true;
    logoutButton.hidden = true;
    loginPanel.hidden = false;
});

document.querySelector('#refresh-button').addEventListener('click', refreshDashboard);
getJson('/api/admin/session').then(({ authenticated }) => {
    if (authenticated) showDashboard();
}).catch(() => {});