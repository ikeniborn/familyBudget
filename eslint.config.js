const js = require("@eslint/js");
const tseslint = require("@typescript-eslint/eslint-plugin");
const tsparser = require("@typescript-eslint/parser");

module.exports = [
  {
    ignores: [
      "node_modules/**",
      "dist/**",
      ".vite-build/**",
      "frontend/**/static/js/dist/**",
      "frontend/**/static/js/**/*.min.js",
      "frontend/shared/db/assets/**",
      "**/*.bundle.js",
      "coverage/**",
      ".npm-isolated/**",
      ".claude/**",
      "backend/**",
      "bot/**",
      "scripts/**",
      ".venv/**",
      "venv/**",
      "config/**",
      "*.config.js",
      "*.config.ts",
      "build-all.js",
      "sw.js",
      "sw.min.js",
      "**/*.min.js",
      "**/*.d.ts",
      // Vendor libraries (third-party code)
      "frontend/**/static/js/vendor/**",
      "frontend/**/static/css/vendor/**",
    ],
  },
  js.configs.recommended,
  {
    files: ["frontend/**/*.ts", "frontend/**/*.js"],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 2022,
      sourceType: "module",
      globals: {
        window: "readonly",
        document: "readonly",
        navigator: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        setInterval: "readonly",
        clearTimeout: "readonly",
        clearInterval: "readonly",
        fetch: "readonly",
        WebSocket: "readonly",
        localStorage: "readonly",
        sessionStorage: "readonly",
        IndexedDB: "readonly",
        requestAnimationFrame: "readonly",
        cancelAnimationFrame: "readonly",
        URL: "readonly",
        URLSearchParams: "readonly",
        FormData: "readonly",
        Headers: "readonly",
        Request: "readonly",
        Response: "readonly",
        Blob: "readonly",
        File: "readonly",
        FileReader: "readonly",
        crypto: "readonly",
        CustomEvent: "readonly",
        Event: "readonly",
        EventTarget: "readonly",
        MutationObserver: "readonly",
        ResizeObserver: "readonly",
        IntersectionObserver: "readonly",
        performance: "readonly",
        PerformanceObserver: "readonly",
        queueMicrotask: "readonly",
        AbortController: "readonly",
        AbortSignal: "readonly",
        HTMLInputElement: "readonly",
        HTMLElement: "readonly",
        HTMLButtonElement: "readonly",
        HTMLFormElement: "readonly",
        HTMLTextAreaElement: "readonly",
        HTMLSelectElement: "readonly",
        HTMLDivElement: "readonly",
        alert: "readonly",
        confirm: "readonly",
        prompt: "readonly",
        Choices: "readonly",
        TextEncoder: "readonly",
        TextDecoder: "readonly",
        // DOM types (for TypeScript interfaces used in code)
        Node: "readonly",
        Element: "readonly",
        RequestInit: "readonly",
        ResponseInit: "readonly",
        // Additional globals (Phase 1 fix: no-undef errors)
        DateFormatter: "readonly",
        debugLog: "readonly",
        WorkerWrapper: "readonly",
        // CommonJS/Node.js globals
        module: "readonly",
        global: "readonly",
        // Additional DOM types
        Window: "readonly",
        HTMLMetaElement: "readonly",
        HTMLDialogElement: "readonly",
        MessageEvent: "readonly",
        // Vitest test globals
        afterEach: "readonly",
        beforeAll: "readonly",
        afterAll: "readonly",
        vi: "readonly",
        // Web APIs
        BroadcastChannel: "readonly",
        Notification: "readonly",
        // IndexedDB API types
        IDBOpenDBRequest: "readonly",
        IDBVersionChangeEvent: "readonly",
        // Additional DOM types
        HTMLLabelElement: "readonly",
        HTMLSpanElement: "readonly",
        Document: "readonly",
        DocumentFragment: "readonly",
        NodeListOf: "readonly",
        TouchEvent: "readonly",
        // Node.js globals
        process: "readonly",
        // Web Worker globals
        self: "readonly",
        // Application-specific globals
        pglite: "readonly",
        IndexedDBManager: "readonly",
      },
    },
    plugins: {
      "@typescript-eslint": tseslint,
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
      "no-unused-vars": "off",  // Disabled in favor of @typescript-eslint/no-unused-vars

      // Critical rules (Phase 1) - upgraded to "error"
      "no-undef": "error",              // Undefined variables → runtime crashes
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "no-debugger": "warn",
      "prefer-const": "warn",
      "no-var": "warn",
      "no-useless-catch": "warn",
      "no-inner-declarations": "warn",
      "no-prototype-builtins": "warn",
      "no-case-declarations": "warn",
      "no-empty": "warn",

      // Critical rules (Phase 1) - logic errors
      "no-redeclare": "error",          // Variable shadowing → logic bugs
      "no-dupe-class-members": "error", // Duplicate members → runtime error
      "no-fallthrough": "warn",
      "no-useless-escape": "warn",

      // Critical rules (Phase 1) - logic errors
      "no-constant-condition": "error", // if(true) → dead code
      "no-cond-assign": "error",        // if(x=1) instead of if(x==1)
      "no-self-assign": "error",        // x=x → useless code
      "no-dupe-else-if": "error",       // Duplicate conditions → dead code
      "no-extra-boolean-cast": "warn",
      "no-extra-semi": "warn",
    },
  },
];
