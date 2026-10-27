const GitHubAPI = {
    async saveFileContent(filePath, content, commitMessage) {
        const token = localStorage.getItem('github_token') || prompt('Ingresa tu Token de Acceso Personal de GitHub (PAT):');
        if (!token) {
            alert('Se requiere un Token de GitHub para guardar los cambios.');
            return false;
        }

        localStorage.setItem('github_token', token);

        const owner = CONFIG.GITHUB.OWNER;
        const repo = CONFIG.GITHUB.REPO;
        const branch = CONFIG.GITHUB.BRANCH;
        const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filePath}`;

        try {
            const getResponse = await fetch(url, {
                headers: {
                    'Authorization': `token ${token}`,
                    'Accept': 'application/vnd.github.v3+json'
                }
            });

            if (!getResponse.ok) throw new Error('No se pudo obtener el archivo actual de GitHub.');

            const fileData = await getResponse.json();
            const fileSha = fileData.sha;
            const encodedContent = btoa(unescape(encodeURIComponent(content)));

            const putResponse = await fetch(url, {
                method: 'PUT',
                headers: {
                    'Authorization': `token ${token}`,
                    'Content-Type': 'application/json',
                    'Accept': 'application/vnd.github.v3+json'
                },
                body: JSON.stringify({
                    message: commitMessage,
                    content: encodedContent,
                    sha: fileSha,
                    branch: branch
                })
            });

            return putResponse.ok;
        } catch (error) {
            console.error('GitHubAPI Error:', error);
            return false;
        }
    }
};