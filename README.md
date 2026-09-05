# TeDebo Web

La web lee las cuentas publicadas por la app desde `shared_accounts/{codigo}`
en Firestore. El link que genera Flutter usa el formato `/c/{codigo}`.
La URL pública configurada por defecto es `https://te-debo-web.vercel.app`.

## Configuración Firebase

Los valores públicos del proyecto `tedeboapp` están incluidos como fallback en
`src/firebase.js`. Para usar otra app web, crear un archivo `.env.local` con:

```env
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Publicar `firestore.rules` en el proyecto Firebase antes de probar la web.
Los links nuevos incluyen `expiresAt` a los 7 días; los links antiguos se
validan usando `createdAt`. Para borrado automático de documentos sin visitas,
configurá una política TTL de Firestore sobre el campo `expiresAt`.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
