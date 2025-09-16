// See https://svelte.dev/docs/kit/types#app
// for information about these interfaces
declare global {
  namespace App {
    interface Error {
      message: string;
      code?: string;
    }
    interface Locals {
      user?: {
        id: number;
        telegram_id: string;
        username: string;
        first_name: string;
        last_name?: string;
        role: 'admin' | 'user';
      };
      authenticated: boolean;
      sessionId?: string;
    }
    interface PageData {}
    interface PageState {}
    interface Platform {}
  }
}

export {};