
document.addEventListener('DOMContentLoaded', () => {
  const title = document.getElementById('appTitle');
  if (title) {
    const params = new URLSearchParams(location.search);
    title.textContent = params.get('app') || 'Coming Soon';
  }

  const lock = document.querySelector('[data-lock]');
  if (lock) {
    lock.addEventListener('click', () => {
      lock.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M12 15v2"/></svg> Locked';
      setTimeout(() => {
        lock.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 11V8a5 5 0 0 1 10 0v3"/><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M12 15v2"/></svg> Lock';
      }, 1200);
    });
  }

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('service-worker.js').catch(() => {});
  }
});
