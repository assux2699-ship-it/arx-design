(() => {
  if (window.ARXFormValidation) return;

  const fieldHost = (control) => {
    if (!control) return null;
    return control.closest('.arx-inline-field, label, .field, .form-field') || control.parentElement;
  };

  const clear = (scope) => {
    const root = scope || document;
    root.querySelectorAll('.arx-inline-error').forEach((node) => node.remove());
    root.querySelectorAll('.arx-input-invalid').forEach((node) => {
      node.classList.remove('arx-input-invalid');
      node.removeAttribute('aria-invalid');
      delete node.dataset.clientInvalid;
    });
  };

  const fail = (control, message) => {
    if (!control) return null;
    control.classList.add('arx-input-invalid');
    control.setAttribute('aria-invalid', 'true');
    control.dataset.clientInvalid = '1';
    const host = fieldHost(control);
    if (!host) return control;
    const error = document.createElement('small');
    error.className = 'arx-inline-error';
    error.dataset.clientError = '1';
    error.textContent = String(message || '');
    host.appendChild(error);
    return control;
  };

  const focusFirst = (scope) => {
    const root = scope || document;
    const first = root.querySelector('.arx-input-invalid');
    if (!first) return null;
    first.scrollIntoView({behavior: 'smooth', block: 'center'});
    window.setTimeout(() => {
      try { first.focus({preventScroll: true}); } catch (_) { try { first.focus(); } catch (_) {} }
    }, 180);
    return first;
  };

  window.ARXFormValidation = Object.freeze({clear, fail, focusFirst});
})();
