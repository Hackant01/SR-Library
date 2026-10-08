// Admin JS utilities for SR Library Admin Panel

function toggleSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && overlay) {
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
  }
}

function closeSidebar() {
  const sidebar = document.getElementById('adminSidebar');
  const overlay = document.getElementById('sidebarOverlay');
  if (sidebar && overlay) {
    sidebar.classList.remove('active');
    overlay.classList.remove('active');
  }
}

function showToast(msg, type = 'success') {
  let tc = document.getElementById('toastContainer');
  if (!tc) {
    tc = document.createElement('div');
    tc.className = 'toast-container';
    tc.id = 'toastContainer';
    document.body.appendChild(tc);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${msg}</span>`;
  tc.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'opacity 0.4s, transform 0.4s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// ─── Approve Student Action ───────────────────────────────────────────────────
async function approveStudent(id, name, btn) {
  if (btn) {
    btn.disabled = true;
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = '⏳ Approving...';
  }

  try {
    const res = await fetch(`/admin/students/${id}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (res.status === 401) {
      alert('Your admin session has expired. Please log in again.');
      window.location.href = '/admin/login';
      return;
    }

    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + (data.message || 'Student approved successfully!'), 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showToast('❌ ' + (data.message || 'Approval failed'), 'danger');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.origText || '✓ Approve';
      }
    }
  } catch (err) {
    console.error('Approve error:', err);
    showToast('❌ Error: ' + err.message, 'danger');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.origText || '✓ Approve';
    }
  }
}

// ─── Reject Student Action ────────────────────────────────────────────────────
async function rejectStudent(id, name, btn) {
  const confirmMsg = name
    ? `Are you sure you want to REJECT the application for "${name}"?`
    : 'Are you sure you want to REJECT this student application?';

  if (!window.confirm(confirmMsg)) {
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = '⏳ Rejecting...';
  }

  try {
    const res = await fetch(`/admin/students/${id}/reject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ reason: 'Registration details did not meet requirements' }),
    });

    if (res.status === 401) {
      alert('Your admin session has expired. Please log in again.');
      window.location.href = '/admin/login';
      return;
    }

    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + (data.message || 'Student application rejected.'), 'success');
      setTimeout(() => location.reload(), 1000);
    } else {
      showToast('❌ ' + (data.message || 'Rejection failed'), 'danger');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.origText || '✗ Reject';
      }
    }
  } catch (err) {
    console.error('Reject error:', err);
    showToast('❌ Error: ' + err.message, 'danger');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.origText || '✗ Reject';
    }
  }
}

// ─── Delete Student Confirmation Modal ─────────────────────────────────────────
function confirmDeleteStudent(id, name = 'Student') {
  // Remove any existing modal
  const existingModal = document.getElementById('deleteConfirmModal');
  if (existingModal) existingModal.remove();

  const modalHtml = `
    <div id="deleteConfirmModal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.65);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div style="background:#ffffff;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);width:100%;max-width:440px;overflow:hidden;border:1px solid #e2e8f0;animation:modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
        
        <div style="background:#fee2e2;border-bottom:1px solid #fecaca;padding:20px 24px;display:flex;align-items:center;gap:14px;">
          <div style="width:44px;height:44px;border-radius:12px;background:#ef4444;color:#fff;display:flex;align-items:center;justify-content:center;font-size:22px;flex-shrink:0;">🗑️</div>
          <div>
            <h3 style="margin:0;font-size:17px;font-weight:700;color:#991b1b;">Delete Student</h3>
            <div style="font-size:12px;color:#b91c1c;margin-top:2px;">Permanent Database Deletion</div>
          </div>
        </div>

        <div style="padding:22px 24px;">
          <p style="font-size:15px;color:#1e293b;font-weight:600;margin:0 0 10px 0;line-height:1.5;">
            Are you sure you want to permanently delete this student?
          </p>

          <div style="background:#f8fafc;padding:10px 14px;border-radius:8px;border:1px solid #e2e8f0;font-size:13px;color:#475569;margin-bottom:16px;">
            <strong>Student:</strong> ${name}
          </div>

          <p style="font-size:12.5px;color:#64748b;margin:0 0 20px 0;line-height:1.4;">
            This will permanently remove the student record and related payment history from MongoDB. This action cannot be undone.
          </p>

          <div style="display:flex;gap:12px;justify-content:flex-end;">
            <button 
              type="button" 
              id="cancelDeleteBtn"
              class="btn btn-ghost" 
              style="padding:10px 18px;font-weight:600;border:1px solid #cbd5e1;background:#fff;"
            >
              Cancel
            </button>
            <button 
              type="button" 
              id="executeDeleteBtn"
              class="btn btn-danger" 
              style="background:#dc2626;border-color:#dc2626;color:#ffffff;padding:10px 20px;font-weight:700;display:flex;align-items:center;gap:8px;"
            >
              <span>Delete Student</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  const modalEl = document.getElementById('deleteConfirmModal');
  const cancelBtn = document.getElementById('cancelDeleteBtn');
  const executeBtn = document.getElementById('executeDeleteBtn');

  cancelBtn.addEventListener('click', () => modalEl.remove());
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) modalEl.remove();
  });

  executeBtn.addEventListener('click', async () => {
    executeBtn.disabled = true;
    executeBtn.innerHTML = '<span>⏳ Deleting...</span>';

    try {
      const res = await fetch(`/admin/students/${id}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      });

      if (res.status === 401) {
        alert('Your admin session has expired. Please log in again.');
        window.location.href = '/admin/login';
        return;
      }

      const data = await res.json();
      modalEl.remove();

      if (data.success) {
        showToast('✅ ' + (data.message || 'Student permanently deleted'), 'success');

        // Remove row from table without manual page reload
        const row = document.getElementById(`student-row-${id}`);
        if (row) {
          row.style.transition = 'all 0.4s ease';
          row.style.opacity = '0';
          row.style.transform = 'translateX(20px)';
          setTimeout(() => {
            row.remove();
            // Update total counter if present
            const countEl = document.getElementById('totalStudentsCount');
            if (countEl) {
              const currentCount = parseInt(countEl.textContent, 10);
              if (!isNaN(currentCount) && currentCount > 0) {
                countEl.textContent = currentCount - 1;
              }
            }
          }, 400);
        } else {
          // If deleted from student-details page, redirect back to list
          setTimeout(() => {
            window.location.href = '/admin/students';
          }, 800);
        }
      } else {
        showToast('❌ ' + (data.message || 'Failed to delete student'), 'danger');
      }
    } catch (err) {
      console.error('Delete error:', err);
      modalEl.remove();
      showToast('❌ Error deleting student: ' + err.message, 'danger');
    }
  });
}

// Fallback wrapper for old delete calls
function deleteStudent(id, nameOrBtn, maybeBtn) {
  let name = '';
  if (typeof nameOrBtn === 'string') {
    name = nameOrBtn;
  }
  confirmDeleteStudent(id, name);
}

// ─── Deactivate Student Action ────────────────────────────────────────────────
async function deactivateStudent(id, name, btn) {
  const confirmMsg = 'Are you sure you want to deactivate this student account?';
  if (!window.confirm(confirmMsg)) return;

  if (btn) {
    btn.disabled = true;
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = '⏳...';
  }

  try {
    const res = await fetch(`/admin/students/${id}/deactivate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (res.status === 401) {
      alert('Your admin session has expired. Please log in again.');
      window.location.href = '/admin/login';
      return;
    }

    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, 'success');

      // Update UI dynamically
      const statusCell = document.getElementById(`account-status-cell-${id}`);
      if (statusCell) {
        statusCell.innerHTML = '<span class="badge badge-gray">Inactive</span>';
      }
      const detailBadge = document.getElementById('detail-account-badge');
      if (detailBadge) {
        detailBadge.className = 'badge badge-gray';
        detailBadge.textContent = 'Account Inactive';
      }

      // Flip button to Activate
      const toggleBtn = document.getElementById(`status-btn-${id}`) || document.getElementById('detail-toggle-btn') || btn;
      if (toggleBtn) {
        toggleBtn.disabled = false;
        toggleBtn.className = toggleBtn.classList.contains('btn-block') ? 'btn btn-success btn-block' : 'btn btn-sm btn-success';
        toggleBtn.style.background = '#10b981';
        toggleBtn.style.color = '#fff';
        toggleBtn.innerHTML = '▶ Activate';
        toggleBtn.title = 'Activate Account';
        toggleBtn.onclick = function() { activateStudent(id, name, this); };
      }
    } else {
      showToast('❌ ' + (data.message || 'Deactivation failed'), 'danger');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.origText || '⏸ Deactivate';
      }
    }
  } catch (err) {
    console.error('Deactivate error:', err);
    showToast('❌ Error: ' + err.message, 'danger');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.origText || '⏸ Deactivate';
    }
  }
}

// ─── Activate Student Action ──────────────────────────────────────────────────
async function activateStudent(id, name, btn) {
  if (btn) {
    btn.disabled = true;
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = '⏳...';
  }

  try {
    const res = await fetch(`/admin/students/${id}/activate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    if (res.status === 401) {
      alert('Your admin session has expired. Please log in again.');
      window.location.href = '/admin/login';
      return;
    }

    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, 'success');

      // Update UI dynamically
      const statusCell = document.getElementById(`account-status-cell-${id}`);
      if (statusCell) {
        statusCell.innerHTML = '<span class="badge badge-success">✓ Active</span>';
      }
      const detailBadge = document.getElementById('detail-account-badge');
      if (detailBadge) {
        detailBadge.className = 'badge badge-success';
        detailBadge.textContent = '✓ Account Active';
      }

      // Flip button to Deactivate
      const toggleBtn = document.getElementById(`status-btn-${id}`) || document.getElementById('detail-toggle-btn') || btn;
      if (toggleBtn) {
        toggleBtn.disabled = false;
        toggleBtn.className = toggleBtn.classList.contains('btn-block') ? 'btn btn-warning btn-block' : 'btn btn-sm btn-warning';
        toggleBtn.style.background = '';
        toggleBtn.style.color = '';
        toggleBtn.innerHTML = '⏸ Deactivate';
        toggleBtn.title = 'Deactivate Account';
        toggleBtn.onclick = function() { deactivateStudent(id, name, this); };
      }
    } else {
      showToast('❌ ' + (data.message || 'Activation failed'), 'danger');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = btn.dataset.origText || '▶ Activate';
      }
    }
  } catch (err) {
    console.error('Activate error:', err);
    showToast('❌ Error: ' + err.message, 'danger');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = btn.dataset.origText || '▶ Activate';
    }
  }
}

// ─── Resend Email Action ──────────────────────────────────────────────────────
async function resendEmail(id, name, btn) {
  if (btn) {
    btn.disabled = true;
    btn.dataset.origText = btn.innerHTML;
    btn.innerHTML = '⏳ Sending...';
  }

  try {
    const res = await fetch(`/admin/students/${id}/resend-email`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
    });

    if (res.status === 401) {
      alert('Your admin session has expired. Please log in again.');
      window.location.href = '/admin/login';
      return;
    }

    const data = await res.json();
    if (data.success) {
      showToast('✅ ' + data.message, 'success');
    } else {
      showToast('❌ ' + (data.message || 'Failed to send email'), 'danger');
    }
  } catch (err) {
    showToast('❌ Error sending email: ' + err.message, 'danger');
  }
  if (btn) {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.origText || '📧 Resend Email';
  }
}

// ─── Generic doAction Helper ──────────────────────────────────────────────────
async function doAction(action, id, btn) {
  if (action === 'approve') return approveStudent(id, '', btn);
  if (action === 'reject') return rejectStudent(id, '', btn);
  if (action === 'delete') return confirmDeleteStudent(id, '');
  if (action === 'deactivate') return deactivateStudent(id, '', btn);
  if (action === 'activate') return activateStudent(id, '', btn);
  if (action === 'mark-cash') return openCashModal(id);
}

// ─── Cash Payment Verification Modal ──────────────────────────────────────────
function openCashModal(studentId, studentName = 'Student') {
  // Remove existing modal if any
  const existingModal = document.getElementById('cashPaymentModal');
  if (existingModal) existingModal.remove();

  const modalHtml = `
    <div id="cashPaymentModal" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;">
      <div style="background:#ffffff;border-radius:16px;box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);width:100%;max-width:480px;overflow:hidden;border:1px solid #e2e8f0;animation:modalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);">
        
        <div style="background:linear-gradient(135deg, #059669 0%, #047857 100%);color:#ffffff;padding:24px;display:flex;align-items:center;gap:14px;">
          <div style="width:48px;height:48px;border-radius:12px;background:rgba(255,255,255,0.2);display:flex;align-items:center;justify-content:center;font-size:24px;">💵</div>
          <div>
            <h3 style="margin:0;font-size:18px;font-weight:700;color:#ffffff;">Mark Cash Payment Received</h3>
            <div style="font-size:13px;opacity:0.9;margin-top:2px;">Verify ₹150 Fee & Activate Student Account</div>
          </div>
        </div>

        <div style="padding:24px;">
          <div style="background:#f8fafc;border-radius:10px;padding:14px 16px;border:1px solid #e2e8f0;margin-bottom:18px;">
            <div style="font-size:12px;color:#64748b;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Student</div>
            <div style="font-size:16px;font-weight:700;color:#0f172a;margin-top:2px;">${studentName}</div>
            <div style="margin-top:8px;font-size:14px;color:#047857;font-weight:700;display:flex;align-items:center;gap:6px;">
              <span>Fee Amount: ₹150.00</span>
              <span style="font-size:11px;background:#d1fae5;color:#065f46;padding:2px 8px;border-radius:12px;">CASH</span>
            </div>
          </div>

          <p style="font-size:15px;color:#1e293b;font-weight:600;margin:0 0 16px 0;line-height:1.5;">
            Confirm that ₹150 cash has been received from this student?
          </p>
          <p style="font-size:13px;color:#64748b;margin:-8px 0 16px 0;line-height:1.4;">
            This will mark payment as PAID, set account to ACTIVE, and immediately send the activation confirmation email with Student ID.
          </p>

          <div style="margin-bottom:16px;">
            <label style="display:block;font-size:12px;font-weight:600;color:#475569;margin-bottom:6px;">
              Verification Note (Optional):
            </label>
            <input 
              type="text" 
              id="cashNoteInput" 
              class="form-control" 
              placeholder="e.g. Paid at front desk receipt #001" 
              style="width:100%;padding:10px 14px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px;"
            />
          </div>

          <div style="display:flex;gap:12px;justify-content:flex-end;margin-top:24px;">
            <button 
              type="button" 
              id="cancelCashModalBtn"
              class="btn btn-ghost" 
              style="padding:10px 18px;font-weight:600;"
            >
              Cancel
            </button>
            <button 
              type="button" 
              id="confirmCashModalBtn"
              class="btn btn-success" 
              style="background:#059669;border-color:#059669;color:#ffffff;padding:10px 22px;font-weight:700;display:flex;align-items:center;gap:8px;"
            >
              <span>✓ Mark Cash Received</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  `;

  document.body.insertAdjacentHTML('beforeend', modalHtml);

  // Close handlers
  const modalEl = document.getElementById('cashPaymentModal');
  const cancelBtn = document.getElementById('cancelCashModalBtn');
  const confirmBtn = document.getElementById('confirmCashModalBtn');
  const noteInput = document.getElementById('cashNoteInput');

  cancelBtn.addEventListener('click', () => modalEl.remove());
  modalEl.addEventListener('click', (e) => {
    if (e.target === modalEl) modalEl.remove();
  });

  // Confirm payment
  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span>⏳ Processing...</span>';

    try {
      const res = await fetch(`/admin/students/${studentId}/mark-cash-paid`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          note: noteInput.value.trim() || '₹150 cash payment verified at library counter'
        }),
      });

      if (res.status === 401) {
        alert('Admin session expired. Please log in again.');
        window.location.href = '/admin/login';
        return;
      }

      const data = await res.json();
      if (data.success) {
        modalEl.remove();
        showToast('✅ ' + (data.message || 'Payment confirmed and account activated!'), 'success');
        setTimeout(() => location.reload(), 1000);
      } else {
        showToast('❌ ' + (data.message || 'Verification failed'), 'danger');
        confirmBtn.disabled = false;
        confirmBtn.innerHTML = '<span>✓ Mark Cash Received</span>';
      }
    } catch (err) {
      console.error('Cash confirmation error:', err);
      showToast('❌ Error: ' + err.message, 'danger');
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>✓ Mark Cash Received</span>';
    }
  });
}
