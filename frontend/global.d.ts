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