document.addEventListener('DOMContentLoaded', async () => {
    const [menuData, devData] = await Promise.all([
        Utils.fetchJSON(CONFIG.DATA_PATHS.MENU),
        Utils.fetchJSON(CONFIG.DATA_PATHS.DEVOCIONALES)
    ]);

    if (menuData) Utils.renderMenu(menuData, 'menu-list');

    if (devData && devData.devocionalDelDia) {
        const dev = devData.devocionalDelDia;
        const fechaEl = document.getElementById('dev-fecha');
        const tituloEl = document.getElementById('dev-titulo');
        if (fechaEl) fechaEl.textContent = dev.fecha || '';
        if (tituloEl) tituloEl.textContent = dev.titulo || '';

        const versiculoEl = document.getElementById('dev-versiculo');
        const pasajeEl = document.getElementById('dev-pasaje');
        if (versiculoEl) versiculoEl.textContent = dev.versiculoTexto || '';
        if (pasajeEl) pasajeEl.textContent = dev.pasajeClave ? `— ${dev.pasajeClave}` : '';

        if (dev.imagen) {
            const imgContainer = document.getElementById('dev-img-container');
            const imgEl = document.getElementById('dev-img');
            if (imgContainer && imgEl) {
                imgEl.src = dev.imagen;
                imgContainer.style.display = 'block';
            }
        }

        const reflexionEl = document.getElementById('dev-reflexion');
        if (reflexionEl && Array.isArray(dev.reflexion)) {
            reflexionEl.innerHTML = dev.reflexion.map(p => `<p>${p}</p>`).join('');
        }

        if (dev.oracion) {
            const oracionBox = document.getElementById('dev-oracion-box');
            const oracionEl = document.getElementById('dev-oracion');
            if (oracionBox && oracionEl) {
                oracionEl.textContent = dev.oracion;
                oracionBox.style.display = 'block';
            }
        }

        if (dev.preguntasReflexion && Array.isArray(dev.preguntasReflexion) && dev.preguntasReflexion.length > 0) {
            const preguntasBox = document.getElementById('dev-preguntas-box');
            const preguntasList = document.getElementById('dev-preguntas');
            if (preguntasBox && preguntasList) {
                preguntasList.innerHTML = dev.preguntasReflexion.map(q => `<li>${q}</li>`).join('');
                preguntasBox.style.display = 'block';
            }
        }
    }

    if (devData && devData.historial && Array.isArray(devData.historial)) {
        const historialList = document.getElementById('historial-list');
        if (historialList) {
            historialList.innerHTML = devData.historial.map(item => `
                <div class="card historial-card">
                    <span class="historial-fecha">${item.fecha}</span>
                    <h3>${item.titulo}</h3>
                    <p class="historial-pasaje"><strong>${item.pasajeClave}</strong></p>
                    <p>${item.resumen || ''}</p>
                </div>
            `).join('');
        }
    }
});