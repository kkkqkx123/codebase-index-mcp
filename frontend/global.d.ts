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

// Jest matchers from @testing-library/jest-dom
declare namespace jest {
  interface Matchers<R> {
    toBeInTheDocument(): R;
    toBeVisible(): R;
    toBeDisabled(): R;
    toBeEnabled(): R;
    toBeRequired(): R;
    toBeInvalid(): R;
    toBeValid(): R;
    toHaveAttribute(attr: string, value?: string): R;
    toHaveClass(...classNames: string[]): R;
    toHaveStyle(css: string): R;
    toHaveTextContent(text: string | RegExp): R;
    toHaveValue(value?: string | string[] | number): R;
    toHaveFocus(): R;
    toBeChecked(): R;
    toHaveErrorMessage(message: string | RegExp): R;
  }
}