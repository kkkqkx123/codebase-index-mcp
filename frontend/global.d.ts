// CSS Modules
declare module '*.module.css' {
  const classes: { [key: string]: string };
  export default classes;
}

// Global CSS
declare module '*.css' {
  const content: { [key: string]: string };
  export default content;
}

// Vite environment variables
interface ImportMeta {
  readonly env: {
    readonly VITE_API_BASE_URL?: string;
    readonly VITE_ENABLE_DEBUG_MODE?: string;
  };
}