// js/main.js - Sistema de Autenticação Firebase com GitHub
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GithubAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";

// Configuração do Firebase (substitua pelos seus valores reais)
const firebaseConfig = {
    apiKey: "SUA_API_KEY",
    authDomain: "SEU_PROJETO.firebaseapp.com",
    projectId: "SEU_PROJETO",
    storageBucket: "SEU_PROJETO.appspot.com",
    messagingSenderId: "SEU_SENDER_ID",
    appId: "SEU_APP_ID"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GithubAuthProvider();

// Elementos do DOM
const loginForm = document.getElementById('login-form');
const loginButton = document.getElementById('login-button');
const logoutButton = document.getElementById('logout-button');
const menuContainer = document.getElementById('menu-container');
const authContainer = document.getElementById('auth-container');
const loadingSpinner = document.getElementById('loading-spinner');
const errorMessage = document.getElementById('error-message');

// Mostra/oculta elementos de loading
function showLoading(show) {
    loadingSpinner.style.display = show ? 'block' : 'none';
    loginButton.disabled = show;
}

// Exibe mensagens de erro
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.style.display = 'block';
    
    // Esconde a mensagem após 5 segundos
    setTimeout(() => {
        errorMessage.style.display = 'none';
    }, 5000);
}

// Realiza login com GitHub
async function loginWithGitHub() {
    showLoading(true);
    errorMessage.style.display = 'none';
    
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        
        console.log('Usuário logado:', user);
        // Aqui você pode salvar informações adicionais no Firestore se necessário
        
    } catch (error) {
        console.error('Erro no login:', error);
        
        // Mensagens de erro personalizadas
        switch (error.code) {
            case 'auth/popup-closed-by-user':
                showError('Login cancelado. Tente novamente.');
                break;
            case 'auth/popup-blocked':
                showError('Pop-up bloqueado. Permita pop-ups e tente novamente.');
                break;
            case 'auth/cancelled-popup-request':
                showError('Aguardando fechamento do popup anterior.');
                break;
            default:
                showError('Erro ao fazer login. Tente novamente mais tarde.');
        }
    } finally {
        showLoading(false);
    }
}

// Realiza logout
async function logout() {
    showLoading(true);
    
    try {
        await signOut(auth);
        console.log('Logout realizado');
        
    } catch (error) {
        console.error('Erro no logout:', error);
        showError('Erro ao fazer logout. Tente novamente.');
    } finally {
        showLoading(false);
    }
}

// Atualiza a interface baseado no estado de autenticação
function updateUI(user) {
    if (user) {
        // Usuário logado
        authContainer.style.display = 'none';
        menuContainer.style.display = 'block';
        
        // Atualiza informações do usuário no menu
        const menuUsername = document.getElementById('menu-username');
        const menuEmail = document.getElementById('menu-email');
        const menuAvatar = document.getElementById('menu-avatar');
        
        if (menuUsername) menuUsername.textContent = user.displayName || 'Usuário GitHub';
        if (menuEmail) menuEmail.textContent = user.email || '';
        if (menuAvatar && user.photoURL) {
            menuAvatar.src = user.photoURL;
            menuAvatar.alt = `Foto de perfil de ${user.displayName || 'usuário'}`;
        }
    } else {
        // Usuário deslogado
        authContainer.style.display = 'block';
        menuContainer.style.display = 'none';
    }
}

// Configura listener de estado de autenticação
function setupAuthListener() {
    onAuthStateChanged(auth, (user) => {
        updateUI(user);
    });
}

// Inicialização
function init() {
    // Configura eventos dos botões
    if (loginButton) {
        loginButton.addEventListener('click', loginWithGitHub);
    }
    
    if (logoutButton) {
        logoutButton.addEventListener('click', logout);
    }
    
    // Configura listener de autenticação
    setupAuthListener();
    
    console.log('Sistema de autenticação inicializado');
}

// Inicia quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', init);

export { auth, loginWithGitHub, logout };