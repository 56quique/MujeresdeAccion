document.addEventListener('DOMContentLoaded', async () => {
    const [menuData, siteData] = await Promise.all([
        Utils.fetchJSON(CONFIG.DATA_PATHS.MENU),
        Utils.fetchJSON(CONFIG.DATA_PATHS.SITE)
    ]);

    if (menuData) Utils.renderMenu(menuData, 'menu-list');

    if (siteData) {
        if (siteData.siteTitle) {
            document.title = siteData.siteTitle;
            const logoText = document.getElementById('site-logo-text');
            if (logoText) logoText.textContent = siteData.siteTitle;
        }

        if (siteData.footerText) {
            const footer = document.querySelector('#main-footer p');
            if (footer) footer.textContent = siteData.footerText;
        }

        if (siteData.hero) {
            const heroTitle = document.getElementById('hero-title');
            const heroSubtitle = document.getElementById('hero-subtitle');
            const heroImg = document.getElementById('hero-img');
            const heroActions = document.getElementById('hero-actions');

            if (heroTitle) heroTitle.textContent = siteData.hero.title || '';
            if (heroSubtitle) heroSubtitle.textContent = siteData.hero.subtitle || '';
            if (heroImg && siteData.hero.image) heroImg.src = siteData.hero.image;

            if (heroActions && siteData.hero.buttonText && siteData.hero.buttonUrl) {
                heroActions.innerHTML = `<a href="${siteData.hero.buttonUrl}" class="btn-primary">${siteData.hero.buttonText}</a>`;
            }
        }

        if (siteData.categories && Array.isArray(siteData.categories)) {
            const categoriesGrid = document.getElementById('categories-grid');
            if (categoriesGrid) {
                categoriesGrid.innerHTML = siteData.categories.map(cat => `
                    <div class="card category-card">
                        <div class="category-icon">${cat.icon || '📌'}</div>
                        <h3>${cat.title}</h3>
                        <p>${cat.description}</p>
                        <a href="${cat.url}" class="card-link">Ver más &rarr;</a>
                    </div>
                `).join('');
            }
        }
    }
});