document.addEventListener('DOMContentLoaded', () => {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js')
            .then(() => console.log('Service Worker registrado con éxito.'))
            .catch((err) => console.log('Error al registrar Service Worker:', err));
    }
});