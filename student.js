const studentMessage = document.querySelector('#student-message');

function formatRupees(amount) {
    return `₹${Number(amount || 0).toLocaleString('en-IN')}`;
}

async function getJson(url, options = {}) {
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'Could not load your account.');
    return result;
}

async function loadStudentDashboard() {
    try {
        const [{ student }, { bookings }] = await Promise.all([
            getJson('/api/student/profile'),
            getJson('/api/student/bookings')
        ]);
        document.querySelector('#student-name').textContent = student.name;
        document.querySelector('#student-phone').textContent = student.phone;

        const body = document.querySelector('#student-bookings');
        const rows = bookings.map((booking) => {
            const row = document.createElement('tr');
            const values = [
                `${booking.plan}\n${booking.duration.replaceAll('-', ' ')}`,
                formatRupees(booking.total_amount),
                booking.payment_status === 'demo_paid' ? 'Paid (demo)' : 'Pending',
                new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(booking.created_at))
            ];
            values.forEach((value) => {
                const cell = document.createElement('td');
                cell.textContent = value;
                row.append(cell);
            });
            return row;
        });
        body.replaceChildren(...rows);
        if (!rows.length) {
            const row = document.createElement('tr');
            const cell = document.createElement('td');
            cell.colSpan = 4;
            cell.className = 'empty-state';
            cell.textContent = 'No bookings linked to this account yet.';
            row.append(cell);
            body.append(row);
        }
    } catch (error) {
        if (error.message === 'Student login required.' || error.message === 'Student account not found.') {
            window.location.replace('login.html');
            return;
        }
        studentMessage.textContent = error.message;
        studentMessage.classList.add('error');
    }
}

document.querySelector('#logout-button').addEventListener('click', async () => {
    await fetch('/api/student/logout', { method: 'POST' });
    window.location.replace('login.html');
});

loadStudentDashboard();