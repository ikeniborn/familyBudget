import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000';

export interface LoginResponse {
  success: boolean;
  user?: {
    id: number;
    username: string;
    firstName: string;
    lastName: string;
    isAdmin: boolean;
  };
  error?: string;
}

export interface AuthCheckResponse {
  enabled: boolean;
}

class AuthService {
  async loginWithPassword(username: string, password: string): Promise<LoginResponse> {
    const response = await axios.post(`${API_URL}/auth/login`, 
      { username, password },
      { 
        withCredentials: true,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    return response.data;
  }

  async checkPasswordAuthEnabled(): Promise<AuthCheckResponse> {
    const response = await axios.get(`${API_URL}/auth/password-auth-enabled`);
    return response.data;
  }

  async getCurrentUser() {
    const response = await axios.get(`${API_URL}/auth/me`, {
      withCredentials: true
    });
    return response.data;
  }

  async logout() {
    const response = await axios.post(`${API_URL}/auth/logout`, {}, {
      withCredentials: true
    });
    return response.data;
  }
}

export const authService = new AuthService();