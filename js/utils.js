const Utils = {
    async fetchJSON(url) {
        try {
            const response = await fetch(url + '?v=' + new Date().getTime());
            if (!response.ok) throw new Error(`Error al cargar ${url}`);
            return await response.json();
        } catch (error) {
            console.error('Utils.fetchJSON Error:', error);
            return null;
        }
    },

    renderMenu(menuItems, containerId = 'menu-list') {
        const container = document.getElementById(containerId);
        if (!container || !menuItems) return;

        const currentPath = window.location.pathname.split('/').pop() || 'index.html';

        container.innerHTML = menuItems
            .filter(item => item.active)
            .map(item => {
                const isActive = currentPath === item.url ? 'class="active"' : '';
                return `<li><a href="${item.url}" ${isActive}>${item.label}</a></li>`;
            })
            .join('');
    }
};