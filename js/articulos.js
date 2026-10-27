document.addEventListener('DOMContentLoaded', async () => {
    const [menuData, dataArticulos] = await Promise.all([
        Utils.fetchJSON(CONFIG.DATA_PATHS.MENU),
        Utils.fetchJSON(CONFIG.DATA_PATHS.ARTICULOS)
    ]);

    if (menuData) Utils.renderMenu(menuData, 'menu-list');

    if (!dataArticulos || !dataArticulos.articulos) return;

    const listaArticulos = dataArticulos.articulos;
    const gridContainer = document.getElementById('articles-grid');
    const detailContainer = document.getElementById('article-detail');

    if (gridContainer) {
        gridContainer.innerHTML = listaArticulos.map(art => `
            <div class="card article-card">
                ${art.imagen ? `<img src="${art.imagen}" alt="${art.titulo}" class="card-img">` : ''}
                <span class="card-fecha">${art.fecha}</span>
                <h3>${art.titulo}</h3>
                <p>${art.extracto || ''}</p>
                <a href="articulo.html?id=${art.id}" class="card-link">Leer artículo &rarr;</a>
            </div>
        `).join('');
    } else if (detailContainer) {
        const urlParams = new URLSearchParams(window.location.search);
        const articleId = urlParams.get('id');
        const articuloActual = listaArticulos.find(art => art.id === articleId);

        if (articuloActual) {
            document.title = `${articuloActual.titulo} - App`;
            document.getElementById('art-fecha').textContent = articuloActual.fecha || '';
            document.getElementById('art-titulo').textContent = articuloActual.titulo || '';
            document.getElementById('art-autor').textContent = articuloActual.autor ? `Por ${articuloActual.autor}` : '';

            if (articuloActual.imagen) {
                const imgContainer = document.getElementById('art-img-container');
                const imgEl = document.getElementById('art-img');
                if (imgContainer && imgEl) {
                    imgEl.src = articuloActual.imagen;
                    imgContainer.style.display = 'block';
                }
            }

            const contenidoEl = document.getElementById('art-contenido');
            if (contenidoEl && Array.isArray(articuloActual.contenido)) {
                contenidoEl.innerHTML = articuloActual.contenido.map(p => `<p>${p}</p>`).join('');
            }
        }
    }
});