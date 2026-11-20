// main.js - Autenticação Firebase com GitHub e Menu
// Configuração do Firebase (substitua pelas suas credenciais reais)
const firebaseConfig = {
  apiKey: "SUA_API_KEY",
  authDomain: "SEU_PROJETO.firebaseapp.com",
  projectId: "SEU_PROJETO",
  storageBucket: "SEU_PROJETO.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId: "SEU_APP_ID"
};

// Inicializa Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GithubAuthProvider();

// Elementos da UI
const loginForm = document.getElementById('login-form');
const menuContainer = document.getElementById('menu-container');
const loadingSpinner = document.getElementById('loading-spinner');
const errorMessage = document.getElementById('error-message');

// Estado atual
let currentUser = null;

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
  // Verifica se já há usuário autenticado
  auth.onAuthStateChanged(user => {
    if (user) {
      currentUser = user;
      showMenu();
    } else {
      showLogin();
    }
  });

  // Configura evento de login
  setupLoginButton();
});

// Configura botão de login
function setupLoginButton() {
  const loginBtn = document.getElementById('login-btn');
  if (loginBtn) {
    loginBtn.addEventListener('click', handleLogin);
  }
}

// Handler de login com GitHub
async function handleLogin() {
  try {
    showLoading(true);
    hideError();
    
    const result = await auth.signInWithPopup(provider);
    currentUser = result.user;
    
    // Salva dados do usuário no Firestore (opcional)
    await saveUserData(currentUser);
    
    showMenu();
  } catch (error) {
    handleError(error);
  } finally {
    showLoading(false);
  }
}

// Salva dados do usuário no Firestore
async function saveUserData(user) {
  const db = firebase.firestore();
  const userRef = db.collection('users').doc(user.uid);
  
  await userRef.set({
    uid: user.uid,
    email: user.email,
    displayName: user.displayName || 'Usuário GitHub',
    photoURL: user.photoURL,
    createdAt: firebase.firestore.FieldValue.serverTimestamp(),
    lastLogin: firebase.firestore.FieldValue.serverTimestamp()
  }, { merge: true });
}

// Mostra tela de login
function showLogin() {
  loginForm.style.display = 'block';
  menuContainer.style.display = 'none';
}

// Mostra menu após login
function showMenu() {
  loginForm.style.display = 'none';
  menuContainer.style.display = 'block';
  
  // Atualiza informações do usuário no menu
  updateUserMenu();
}

// Atualiza informações do usuário no menu
function updateUserMenu() {
  if (!currentUser) return;
  
  const userNameElement = document.getElementById('user-name');
  const userEmailElement = document.getElementById('user-email');
  const userAvatarElement = document.getElementById('user-avatar');
  
  if (userNameElement) userNameElement.textContent = currentUser.displayName || 'Usuário';
  if (userEmailElement) userEmailElement.textContent = currentUser.email || '';
  if (userAvatarElement && currentUser.photoURL) {
    userAvatarElement.src = currentUser.photoURL;
  }
}

// Handler de logout
async function handleLogout() {
  try {
    await auth.signOut();
    currentUser = null;
    showLogin();
  } catch (error) {
    handleError(error);
  }
}

// Configura evento de logout
function setupLogoutButton() {
  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', handleLogout);
  }
}

// Mostra/esconde loading
function showLoading(show) {
  loadingSpinner.style.display = show ? 'block' : 'none';
}

// Mostra erro
function showError(message) {
  errorMessage.textContent = message;
  errorMessage.style.display = 'block';
}

// Esconde erro
function hideError() {
  errorMessage.style.display = 'none';
}

// Handler de erro centralizado
function handleError(error) {
  console.error('Erro na autenticação:', error);
  
  let message = 'Ocorreu um erro inesperado.';
  
  switch (error.code) {
    case 'auth/popup-closed-by-user':
      message = 'Login cancelado pelo usuário.';
      break;
    case 'auth/cancelled-request-popup-open':
      message = 'Já existe uma janela de login aberta.';
      break;
    case 'auth/account-exists-with-different-credential':
      message = 'Conta já existe com outro método de autenticação.';
      break;
    case 'auth/invalid-credential':
      message = 'Credenciais inválidas.';
      break;
    case 'auth/user-disabled':
      message = 'Usuário desativado.';
      break;
    case 'auth/too-many-requests':
      message = 'Muitas tentativas. Tente novamente mais tarde.';
      break;
    case 'auth/unauthorized-domain':
      message = 'Domínio não autorizado. Configure seu domínio no Firebase.';
      break;
    default:
      message = `Erro: ${error.message}`;
  }
  
  showError(message);
}

// Inicializa botão de logout quando menu é mostrado
const originalShowMenu = showMenu;
showMenu = function() {
  originalShowMenu();
  setupLogoutButton();
};

export { handleLogin, handleLogout, currentUser };