export const languages = {
  en: 'English',
  fr: 'Français',
  es: 'Español',
  jp: '日本語',
};

export const defaultLang = 'en';

export const showDefaultLang = false;

export const ui = {
  en: {
    'nav.home': 'Home',
    'nav.about': 'About',
    'nav.community': 'Community',
    

    'auth.admin': 'Administrator',
    'auth.dashboard': 'Dashboard',
    'auth.signin': 'Sign In',
    'auth.signup': 'Sign Up',
    'auth.signout': 'Sign Out',
    'auth.newHere': 'New here?',
    'auth.forgotPassword': 'Forgot password?',
    'auth.resetPassword': 'Reset password',
    'auth.alreadyHaveAccount': 'Already have an account?',
    'auth.username': 'Username',
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.passwordConfirm': 'Confirm password',
    'auth.createAccount': 'Create an account',
  },
  fr: {
    'nav.home': 'Accueil',
    'nav.about': 'À propos',
    'nav.community': 'Communauté',

    'auth.admin': 'Administrateur',
    'auth.dashboard': 'Tableau de bord',
    'auth.signin': 'Se connecter',
    'auth.signup': 'S\'inscrire',
    'auth.signout': 'Se déconnecter',
    'auth.newHere': 'Nouveau ici?',
    'auth.forgotPassword': 'Mot de passe oublié?',
    'auth.resetPassword': 'Réinitialiser le mot de passe',
    'auth.alreadyHaveAccount': 'Déjà un compte?',
    'auth.username': 'Nom d\'utilisateur',
    'auth.email': 'Email',
    'auth.password': 'Mot de passe',
    'auth.passwordConfirm': 'Confirmer le mot de passe',
    'auth.createAccount': 'Créer un compte',
  },
  es: {
    'nav.home': 'Inicio',
    'nav.about': 'Acerca',
    'nav.community': 'Comunidad',

    'auth.admin': 'Administrador',
    'auth.dashboard': 'Tablero',
    'auth.signin': 'Registrarse',
    'auth.signup': 'Inscribirse',
    'auth.signout': 'Desconectar',
    'auth.newHere': '¿Nuevo aquí?',
    'auth.forgotPassword': '¿Olvidaste tu contraseña?',
    'auth.resetPassword': 'Restablecer la contraseña',
    'auth.alreadyHaveAccount': '¿Ya tienes una cuenta?',
    'auth.username': 'Nombre de usuario',
    'auth.email': 'Correo electrónico',
    'auth.password': 'Contraseña',
    'auth.passwordConfirm': 'Confirmar contraseña',
    'auth.createAccount': 'Crear una cuenta',
  },
  jp: {
    'nav.home': 'ホーム',
    'nav.about': '約',
    'nav.community': 'コミュニティ',

    'auth.admin': '管理者',
    'auth.dashboard': 'ダッシュボード',
    'auth.signin': 'サインイン',
    'auth.signup': 'サインアップ',
    'auth.signout': 'サインアウト',
    'auth.newHere': '新しいですか？',
    'auth.forgotPassword': 'パスワードをお忘れですか？',
    'auth.resetPassword': 'パスワードをリセット',
    'auth.alreadyHaveAccount': 'すでにアカウントをお持ちですか？',
    'auth.username': 'ユーザー名',
    'auth.email': 'Eメール',
    'auth.password': 'パスワード',
    'auth.passwordConfirm': 'パスワードを確認',
    'auth.createAccount': 'アカウントを作成',
  },
} as const;

export const routes = {
  en: {
    'about': 'about',
    'community': 'community',
    'admin': 'administrator',
    'dashboard': 'dashboard',
    'signin': 'signin',
    'signup': 'signup',
  },
  fr: {
    'about': 'a-propos',
    'community': 'communaute',
    'admin': 'administrateur',
    'dashboard': 'tableau-de-bord',
    'signin': 'se-connecter',
    'signup': 's-inscrire',
  },
  es: {
    'about': 'acerca',
    'community': 'comunidad',
    'admin': 'administrador',
    'dashboard': 'tablero',
    'signin': 'registrarse',
    'signup': 'inscribirse',
  },
  jp: {
    'about': 'yaku',
    'community': 'komyuniti',
    'admin': 'kanrisha',
    'dashboard': 'dashibōdo',
    'signin': 'sainin',
    'signup': 'sainappu',
  },
} as const;
