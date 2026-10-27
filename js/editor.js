document.addEventListener('DOMContentLoaded', async () => {
    const menuData = await Utils.fetchJSON(CONFIG.DATA_PATHS.MENU);
    if (menuData) Utils.renderMenu(menuData, 'menu-list');

    const loadBtn = document.getElementById('load-btn');
    const fileSelector = document.getElementById('file-selector');
    const formContainer = document.getElementById('form-fields-container');
    const formActions = document.getElementById('form-actions');
    const editorForm = document.getElementById('editor-form');

    let currentJsonData = null;
    let currentFileName = '';

    loadBtn.addEventListener('click', async () => {
        currentFileName = fileSelector.value;
        currentJsonData = await Utils.fetchJSON(`data/${currentFileName}`);

        if (currentJsonData) {
            renderFormFields(currentJsonData);
            formActions.style.display = 'block';
        } else {
            formContainer.innerHTML = `<p class="placeholder-text">Error al cargar ${currentFileName}.</p>`;
            formActions.style.display = 'none';
        }
    });

    function renderFormFields(data) {
        formContainer.innerHTML = '';
        for (const [key, value] of Object.entries(data)) {
            const fieldWrapper = document.createElement('div');
            fieldWrapper.className = 'form-group';

            const label = document.createElement('label');
            label.textContent = key.toUpperCase();
            fieldWrapper.appendChild(label);

            if (typeof value === 'string' || typeof value === 'number') {
                const input = document.createElement('input');
                input.type = 'text';
                input.name = key;
                input.value = value;
                input.className = 'form-input';
                fieldWrapper.appendChild(input);
            } else if (typeof value === 'object' && value !== null) {
                const textarea = document.createElement('textarea');
                textarea.name = key;
                textarea.value = JSON.stringify(value, null, 2);
                textarea.className = 'form-textarea';
                textarea.rows = 6;
                
                const hint = document.createElement('small');
                hint.textContent = 'Estructura en formato JSON válido (editable con precaución).';
                hint.className = 'form-hint';
                
                fieldWrapper.appendChild(textarea);
                fieldWrapper.appendChild(hint);
            }
            formContainer.appendChild(fieldWrapper);
        }
    }

    editorForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const statusSpan = document.getElementById('save-status');
        statusSpan.textContent = 'Guardando cambios...';
        statusSpan.style.color = 'blue';

        const formData = new FormData(editorForm);
        const updatedData = {};

        for (const [key, value] of formData.entries()) {
            if (value.startsWith('{') || value.startsWith('[')) {
                try {
                    updatedData[key] = JSON.parse(value);
                } catch (err) {
                    updatedData[key] = value;
                }
            } else {
                updatedData[key] = value;
            }
        }

        try {
            const success = await GitHubAPI.saveFileContent(
                `data/${currentFileName}`, 
                JSON.stringify(updatedData, null, 2), 
                `Actualización de ${currentFileName} desde el panel editor`
            );

            if (success) {
                statusSpan.textContent = '¡Guardado y publicado con éxito!';
                statusSpan.style.color = 'green';
            } else {
                throw new Error('Error al conectar con GitHub');
            }
        } catch (error) {
            console.error(error);
            statusSpan.textContent = 'Error al guardar. Revisa la consola o credenciales.';
            statusSpan.style.color = 'red';
        }
    });
});