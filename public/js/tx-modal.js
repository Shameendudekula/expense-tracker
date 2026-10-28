// Add / edit transaction modal and delete confirmation, shared by the dashboard and transactions pages.
// The markup is injected once so it isn't duplicated in every HTML file.

const TxModal = (() => {
  let dialog, form, saveBtn, onSaved, editingId;

  function build() {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<dialog id="tx-modal" aria-labelledby="tx-title">
        <form id="tx-form" novalidate>
          <div class="modal-header">
            <h2 id="tx-title">Add transaction</h2>
            <button type="button" class="icon-btn" data-close aria-label="Close">✕</button>
          </div>
          <div class="modal-body form-grid">
            <div class="field field-full">
              <span class="label" id="tx-type-label">Type</span>
              <div class="segmented" role="radiogroup" aria-labelledby="tx-type-label">
                <input type="radio" name="type" id="tx-type-expense" value="expense" checked>
                <label for="tx-type-expense" class="seg-expense">Expense</label>
                <input type="radio" name="type" id="tx-type-income" value="income">
                <label for="tx-type-income" class="seg-income">Income</label>
              </div>
              <small class="field-error" data-error-for="type"></small>
            </div>
            <div class="field">
              <label for="tx-amount">Amount *</label>
              <input id="tx-amount" name="amount" type="number" inputmode="decimal" min="0.01" step="0.01" required>
              <small class="field-error" data-error-for="amount"></small>
            </div>
            <div class="field">
              <label for="tx-date">Date *</label>
              <input id="tx-date" name="date" type="date" required>
              <small class="field-error" data-error-for="date"></small>
            </div>
            <div class="field field-full">
              <label for="tx-category">Category *</label>
              <select id="tx-category" name="category" required></select>
              <small class="field-error" data-error-for="category"></small>
            </div>
            <div class="field field-full">
              <label for="tx-description">Description</label>
              <input id="tx-description" name="description" type="text" maxlength="120" autocomplete="off" placeholder="e.g. Weekly groceries">
              <small class="field-error" data-error-for="description"></small>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-ghost" data-close>Cancel</button>
            <button type="submit" class="btn btn-primary" id="tx-save">Save</button>
          </div>
        </form>
      </dialog>`
    );
    dialog = document.getElementById('tx-modal');
    form = document.getElementById('tx-form');
    saveBtn = document.getElementById('tx-save');

    form.addEventListener('submit', submit);
    // Switching between income and expense swaps the category list
    form.addEventListener('change', (e) => { if (e.target.name === 'type') fillCategories(e.target.value); });
    form.addEventListener('input', (e) => clearError(e.target.name));
    dialog.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === dialog) dialog.close(); });
  }

  function fillCategories(type, selected) {
    const select = form.elements.category;
    select.innerHTML =
      '<option value="">Select category</option>' +
      appState.meta.categories[type].map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');
    if (selected && appState.meta.categories[type].includes(selected)) select.value = selected;
  }

  function clearError(field) {
    if (!field) return;
    const slot = form.querySelector(`[data-error-for="${field}"]`);
    if (slot) slot.textContent = '';
    form.elements[field]?.removeAttribute?.('aria-invalid');
  }

  function showErrors(errors) {
    let first;
    for (const [field, message] of Object.entries(errors)) {
      const slot = form.querySelector(`[data-error-for="${field}"]`);
      if (slot) slot.textContent = message;
      const input = form.elements[field];
      if (input && input.setAttribute) {
        input.setAttribute('aria-invalid', 'true');
        first ??= input;
      }
    }
    first?.focus();
  }

  // Quick checks in the browser for instant feedback. The server validates everything again.
  function validate(data) {
    const errors = {};
    const amount = Number(data.amount);
    if (!data.amount) errors.amount = 'Amount is required';
    else if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'Amount must be greater than 0';
    if (!data.date) errors.date = 'Date is required';
    else if (data.date > today()) errors.date = 'Date cannot be in the future';
    if (!data.category) errors.category = 'Category is required';
    return errors;
  }

  async function submit(e) {
    e.preventDefault();
    form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));

    const data = Object.fromEntries(new FormData(form));
    data.description = (data.description || '').trim();
    const errors = validate(data);
    if (Object.keys(errors).length) return showErrors(errors);
    data.amount = Number(data.amount);

    const label = saveBtn.textContent;
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving…';
    try {
      if (editingId) {
        await api.updateTransaction(editingId, data);
        toast('Transaction updated');
      } else {
        await api.createTransaction(data);
        toast(`${data.type === 'income' ? 'Income' : 'Expense'} of ${formatMoney(data.amount)} added`);
      }
      dialog.close();
      onSaved?.();
    } catch (err) {
      if (Object.keys(err.errors).length) showErrors(err.errors);
      toast(err.message, 'error');
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = label;
    }
  }

  // open() for a new transaction, open(tx) to edit an existing one
  function open(tx = null, callback) {
    if (!dialog) build();
    onSaved = callback;
    editingId = tx?._id ?? null;
    form.reset();
    form.querySelectorAll('.field-error').forEach((el) => (el.textContent = ''));
    form.querySelectorAll('[aria-invalid]').forEach((el) => el.removeAttribute('aria-invalid'));

    const type = tx?.type || 'expense';
    form.elements.type.value = type;
    fillCategories(type, tx?.category);
    form.elements.amount.value = tx?.amount ?? '';
    form.elements.date.value = tx ? tx.date.slice(0, 10) : today();
    form.elements.date.max = today();
    form.elements.description.value = tx?.description ?? '';

    document.getElementById('tx-title').textContent = tx ? 'Edit transaction' : 'Add transaction';
    saveBtn.textContent = tx ? 'Save changes' : 'Add transaction';
    dialog.showModal();
    form.elements.amount.focus();
  }

  return { open };
})();

const ConfirmDelete = (() => {
  let dialog, text, confirmBtn, pending;

  function build() {
    document.body.insertAdjacentHTML(
      'beforeend',
      `<dialog id="confirm-modal" class="modal-sm" aria-labelledby="confirm-title">
        <div class="modal-header"><h2 id="confirm-title">Delete transaction?</h2></div>
        <div class="modal-body"><p id="confirm-text"></p></div>
        <div class="modal-footer">
          <button type="button" class="btn btn-ghost" data-close>Cancel</button>
          <button type="button" class="btn btn-danger" id="confirm-delete">Delete</button>
        </div>
      </dialog>`
    );
    dialog = document.getElementById('confirm-modal');
    text = document.getElementById('confirm-text');
    confirmBtn = document.getElementById('confirm-delete');
    dialog.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === dialog) dialog.close(); });
    confirmBtn.addEventListener('click', async () => {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting…';
      try {
        await api.deleteTransaction(pending.tx._id);
        toast('Transaction deleted');
        dialog.close();
        pending.onDeleted?.();
      } catch (err) {
        toast(err.message, 'error');
        if (err.status === 404) { dialog.close(); pending.onDeleted?.(); }
      } finally {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Delete';
      }
    });
  }

  function open(tx, onDeleted) {
    if (!dialog) build();
    pending = { tx, onDeleted };
    const what = tx.description || tx.category;
    text.innerHTML = `This will permanently delete <strong>${escapeHtml(what)}</strong> (${escapeHtml(formatMoney(tx.amount))}, ${escapeHtml(formatDate(tx.date))}). This can't be undone.`;
    dialog.showModal();
  }

  return { open };
})();
