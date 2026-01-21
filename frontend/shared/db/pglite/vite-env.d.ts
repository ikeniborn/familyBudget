/// <reference types="vite/client" />

// Declare SQL files as raw strings
declare module '*.sql?raw' {
  const content: string;
  export default content;
}
