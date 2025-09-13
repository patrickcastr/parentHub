export type AuthProvider = {
  id: 'microsoft' | 'google' | 'guest';
  label: string;
  redirectPath: string;
  iconSrc?: string;
  bgClass?: string;
  textClass?: string;
};

export const AUTH_PROVIDERS: AuthProvider[] = [
  {
    id: 'microsoft',
    label: 'Sign in with Microsoft',
    redirectPath: '/api/auth/login/microsoft', // adjust if backend differs
    iconSrc: '/microsoft-logo.png',
    bgClass: 'bg-blue-600 hover:bg-blue-700',
    textClass: 'text-white',
  },
  // Future examples (commented for now):
  // { id: 'google', label: 'Sign in with Google', redirectPath: '/api/auth/login/google', iconSrc: '/google-logo.png' },
  // { id: 'guest', label: 'Continue as Guest', redirectPath: '/auth/guest', bgClass: 'bg-gray-200 hover:bg-gray-300', textClass: 'text-gray-900' },
];
