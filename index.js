import { iniciarAutenticacao } from './auth.js';

function atualizarDOM(resultado) {
    document.getElementById('verification-uri').innerText = `Acesse: ${resultado.verification_uri}`;
    document.getElementById('user-code').innerText = `Insira o código: ${resultado.user_code}`;
}

async function iniciarAutenticacaoEAtualizarDOM() {
    try {
        const resultado = await iniciarAutenticacao();
        if (resultado) {
            atualizarDOM(resultado);
        }
    } catch (error) {
        console.error('Erro ao iniciar autenticação:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const loginButton = document.querySelector('#login-container button');
    if (loginButton) {
        loginButton.addEventListener('click', iniciarAutenticacaoEAtualizarDOM);
    }
});