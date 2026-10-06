// Registration Form Validation & Dual Payment (Online + Cash) Flow
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('registrationForm');
  const passwordInput = document.getElementById('password');
  const confirmPasswordInput = document.getElementById('confirmPassword');
  const passwordStrengthDiv = document.getElementById('password-strength');
  const passwordMatchMsg = document.getElementById('password-match-msg');
  const proceedPayBtn = document.getElementById('proceedPayBtn');
  const btnSubmitText = document.getElementById('btnSubmitText');
  const paymentModal = document.getElementById('paymentModal');
  const payConfirmBtn = document.getElementById('payConfirmBtn');
  const payCancelBtn = document.getElementById('payCancelBtn');
  const paymentStatusBox = document.getElementById('paymentStatusBox');
  const orderIdInput = document.getElementById('orderId');
  const paymentIdInput = document.getElementById('paymentId');
  const signatureInput = document.getElementById('signature');

  const payMethodOnline = document.getElementById('payMethodOnline');
  const payMethodCash = document.getElementById('payMethodCash');
  const cardMethodOnline = document.getElementById('cardMethodOnline');
  const cardMethodCash = document.getElementById('cardMethodCash');
  const methodNoticeBox = document.getElementById('methodNoticeBox');

  // Toggle Password Visibility
  document.querySelectorAll('.toggle-password').forEach((btn) => {
    btn.addEventListener('click', function () {
      const targetId = this.getAttribute('data-target');
      const targetInput = document.getElementById(targetId);
      if (targetInput) {
        if (targetInput.type === 'password') {
          targetInput.type = 'text';
          this.textContent = '🙈';
        } else {
          targetInput.type = 'password';
          this.textContent = '👁';
        }
      }
    });
  });

  // Password Strength Checker
  if (passwordInput && passwordStrengthDiv) {
    passwordInput.addEventListener('input', () => {
      const val = passwordInput.value;
      let score = 0;
      if (val.length >= 8) score++;
      if (/[A-Z]/.test(val)) score++;
      if (/[a-z]/.test(val)) score++;
      if (/\d/.test(val)) score++;
      if (/[^A-Za-z0-9]/.test(val)) score++;

      let text = '';
      let color = '#94a3b8';
      if (val.length === 0) {
        text = '';
      } else if (score <= 2) {
        text = 'Weak password';
        color = '#ef4444';
      } else if (score === 3 || score === 4) {
        text = 'Medium strength';
        color = '#f59e0b';
      } else {
        text = 'Strong password ✓';
        color = '#10b981';
      }
      passwordStrengthDiv.innerHTML = `<span style="font-size:12px;font-weight:600;color:${color}">${text}</span>`;
    });
  }

  // Password Match Checker
  if (confirmPasswordInput && passwordMatchMsg) {
    const checkMatch = () => {
      if (!confirmPasswordInput.value) {
        passwordMatchMsg.textContent = '';
        return;
      }
      if (passwordInput.value === confirmPasswordInput.value) {
        passwordMatchMsg.textContent = 'Passwords match ✓';
        passwordMatchMsg.style.color = '#10b981';
      } else {
        passwordMatchMsg.textContent = 'Passwords do not match ❌';
        passwordMatchMsg.style.color = '#ef4444';
      }
    };
    confirmPasswordInput.addEventListener('input', checkMatch);
    if (passwordInput) passwordInput.addEventListener('input', checkMatch);
  }

  // Payment Method Switching (Online vs Cash)
  function updatePaymentMethodUI() {
    const isCash = payMethodCash && payMethodCash.checked;
    if (isCash) {
      if (cardMethodCash) {
        cardMethodCash.style.borderColor = '#4f46e5';
        cardMethodCash.style.background = '#f5f3ff';
      }
      if (cardMethodOnline) {
        cardMethodOnline.style.borderColor = '#cbd5e1';
        cardMethodOnline.style.background = '#ffffff';
      }
      if (btnSubmitText) {
        btnSubmitText.textContent = '💵 Submit Registration (Pay ₹150 Cash at Counter) →';
      }
      if (methodNoticeBox) {
        methodNoticeBox.style.background = '#fffbeb';
        methodNoticeBox.style.borderColor = '#fde68a';
        methodNoticeBox.style.color = '#92400e';
        methodNoticeBox.innerHTML =
          '⏳ <strong>Cash Payment Selected:</strong> Submit registration now. You must pay ₹150 in cash at the library desk. Your account will be activated once the admin marks the cash payment received.';
      }
    } else {
      if (cardMethodOnline) {
        cardMethodOnline.style.borderColor = '#4f46e5';
        cardMethodOnline.style.background = '#f5f3ff';
      }
      if (cardMethodCash) {
        cardMethodCash.style.borderColor = '#cbd5e1';
        cardMethodCash.style.background = '#ffffff';
      }
      if (btnSubmitText) {
        btnSubmitText.textContent = '💳 Proceed to Pay ₹150 Online →';
      }
      if (methodNoticeBox) {
        methodNoticeBox.style.background = '#f0fdf4';
        methodNoticeBox.style.borderColor = '#bbf7d0';
        methodNoticeBox.style.color = '#166534';
        methodNoticeBox.innerHTML =
          '✅ <strong>Online Payment Selected:</strong> Pay ₹150 through our gateway. Server will verify the transaction, assign your Student ID, and immediately activate your account!';
      }
    }
  }

  if (payMethodOnline) payMethodOnline.addEventListener('change', updatePaymentMethodUI);
  if (payMethodCash) payMethodCash.addEventListener('change', updatePaymentMethodUI);
  if (cardMethodOnline) {
    cardMethodOnline.addEventListener('click', () => {
      payMethodOnline.checked = true;
      updatePaymentMethodUI();
    });
  }
  if (cardMethodCash) {
    cardMethodCash.addEventListener('click', () => {
      payMethodCash.checked = true;
      updatePaymentMethodUI();
    });
  }

  // Payment Tabs handling inside modal
  const tabs = document.querySelectorAll('.pay-tab');
  tabs.forEach((tab) => {
    tab.addEventListener('click', function () {
      tabs.forEach((t) => {
        t.classList.remove('active');
        t.style.background = 'transparent';
        t.style.color = '#64748b';
        t.style.boxShadow = 'none';
      });
      this.classList.add('active');
      this.style.background = '#fff';
      this.style.color = '#1e293b';
      this.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';

      const tabTarget = this.getAttribute('data-tab');
      document.querySelectorAll('.tab-content').forEach((tc) => (tc.style.display = 'none'));
      const activeContent = document.getElementById(`tab-${tabTarget}`);
      if (activeContent) activeContent.style.display = 'block';
    });
  });

  // Proceed / Submit Clicked
  if (proceedPayBtn && form) {
    proceedPayBtn.addEventListener('click', () => {
      // Validate form
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // Check passwords match
      if (passwordInput && confirmPasswordInput && passwordInput.value !== confirmPasswordInput.value) {
        alert('Passwords do not match. Please ensure both password fields match.');
        confirmPasswordInput.focus();
        return;
      }

      const isCash = payMethodCash && payMethodCash.checked;

      if (isCash) {
        // Cash Payment Flow: Direct submission without online gateway
        proceedPayBtn.disabled = true;
        proceedPayBtn.innerHTML = '⏳ Submitting Cash Registration...';
        form.submit();
      } else {
        // Online Payment Flow: Open payment modal
        if (paymentModal) {
          paymentModal.style.display = 'flex';
        }
      }
    });
  }

  // Cancel payment modal
  if (payCancelBtn && paymentModal) {
    payCancelBtn.addEventListener('click', () => {
      paymentModal.style.display = 'none';
      if (paymentStatusBox) paymentStatusBox.style.display = 'none';
      if (payConfirmBtn) {
        payConfirmBtn.disabled = false;
        payConfirmBtn.innerHTML = 'Pay ₹150 & Complete Registration';
      }
    });
  }

  // Confirm Online ₹150 Payment
  if (payConfirmBtn && form) {
    payConfirmBtn.addEventListener('click', async () => {
      payConfirmBtn.disabled = true;
      payConfirmBtn.innerHTML = '⏳ Processing ₹150 Payment...';
      payConfirmBtn.style.opacity = '0.75';

      if (paymentStatusBox) {
        paymentStatusBox.style.display = 'block';
        paymentStatusBox.style.background = '#eff6ff';
        paymentStatusBox.style.color = '#1e40af';
        paymentStatusBox.style.border = '1px solid #bfdbfe';
        paymentStatusBox.innerHTML = 'Connecting to Secure Payment Gateway...';
      }

      try {
        // Step 1: Create Order on server
        const orderRes = await fetch('/student/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ amount: 150 }),
        });
        const orderData = await orderRes.json();
        if (!orderData.success) throw new Error(orderData.message || 'Could not initiate payment order');

        const orderId = orderData.orderId;

        // Step 2: Simulate Gateway Processing & obtain server-signed receipt
        const simRes = await fetch('/student/simulate-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId, method: 'upi' }),
        });
        const simData = await simRes.json();
        if (!simData.success) throw new Error(simData.message || 'Payment simulation failed');

        const { paymentId, signature } = simData;

        if (paymentStatusBox) {
          paymentStatusBox.style.background = '#eff6ff';
          paymentStatusBox.style.color = '#1e40af';
          paymentStatusBox.style.border = '1px solid #bfdbfe';
          paymentStatusBox.innerHTML = 'Verifying payment signature with server...';
        }

        // Step 3: Bundle all form data + payment signature and verify on backend
        const formDataObj = {};
        new FormData(form).forEach((value, key) => {
          formDataObj[key] = value;
        });

        formDataObj.orderId = orderId;
        formDataObj.paymentId = paymentId;
        formDataObj.signature = signature;
        formDataObj.paymentMethod = 'online';

        const verifyRes = await fetch('/student/verify-payment', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(formDataObj),
        });

        const verifyData = await verifyRes.json();

        if (verifyData.success) {
          if (paymentStatusBox) {
            paymentStatusBox.style.background = '#ecfdf5';
            paymentStatusBox.style.color = '#065f46';
            paymentStatusBox.style.border = '1px solid #a7f3d0';
            paymentStatusBox.innerHTML = `✅ <strong>Payment Verified & Approved!</strong><br/><span style="font-size:12px;">Student ID: ${verifyData.studentId}</span>`;
          }
          payConfirmBtn.innerHTML = '✓ Account Activated! Redirecting...';
          setTimeout(() => {
            window.location.href = verifyData.redirectUrl || '/student/registration-success';
          }, 800);
        } else {
          throw new Error(verifyData.message || 'Payment verification failed');
        }
      } catch (err) {
        console.error('Payment verification error:', err);
        if (paymentStatusBox) {
          paymentStatusBox.style.display = 'block';
          paymentStatusBox.style.background = '#fef2f2';
          paymentStatusBox.style.color = '#991b1b';
          paymentStatusBox.style.border = '1px solid #fecaca';
          paymentStatusBox.innerHTML = `❌ ${err.message}`;
        }
        payConfirmBtn.disabled = false;
        payConfirmBtn.innerHTML = 'Retry Payment';
        payConfirmBtn.style.opacity = '1';
      }
    });
  }
});
