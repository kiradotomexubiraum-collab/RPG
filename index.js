import { iniciarAutenticacao } from './auth.js';

document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.querySelector('#login-container button');
    
    if (loginButton) {
        loginButton.addEventListener('click', async () => {
            try {
                const resultado = await iniciarAutenticacao();
                
                if (resultado) {
                    document.getElementById('verification-uri').innerText = `Acesse: ${resultado.verification_uri}`;
                    document.getElementById('user-code').innerText = `Insira o código: ${resultado.user_code}`;
                }
            } catch (error) {
                console.error('Erro ao iniciar autenticação:', error);
            }
        });
    }
});