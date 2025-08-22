import { AuthService } from '../auth.service';
import * as bcrypt from 'bcryptjs';

// Простые unit тесты без сложных моков
describe('AuthService - Simple Tests', () => {
  describe('hashPassword', () => {
    it('должен создавать хеш пароля', async () => {
      const password = 'testPassword123';
      const hashedPassword = await AuthService.hashPassword(password);
      
      expect(hashedPassword).toBeDefined();
      expect(hashedPassword).not.toBe(password);
      expect(typeof hashedPassword).toBe('string');
    });
  });

  describe('comparePassword', () => {
    it('должен корректно сравнивать пароли', async () => {
      const password = 'testPassword123';
      const hashedPassword = await bcrypt.hash(password, 12);
      
      const isValid = await AuthService.comparePassword(password, hashedPassword);
      const isInvalid = await AuthService.comparePassword('wrongPassword', hashedPassword);
      
      expect(isValid).toBe(true);
      expect(isInvalid).toBe(false);
    });
  });

  describe('isPasswordAuthEnabled', () => {
    it('должен возвращать true', async () => {
      const result = await AuthService.isPasswordAuthEnabled();
      expect(result).toBe(true);
    });
  });
});