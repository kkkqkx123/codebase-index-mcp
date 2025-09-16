import { authService, User } from '../auth.service';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] || null,
    setItem: (key: string, value: string) => {
      store[key] = value.toString();
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    }
  };
})();

Object.defineProperty(window, 'localStorage', {
  value: localStorageMock
});

// Since we're testing the actual implementation, we don't need to mock the axios calls
// The tests will work with the real implementation

describe('Auth Service', () => {
  const mockUser: User = {
    id: 'user-1',
    username: 'testuser',
    email: 'test@example.com',
    role: 'user',
    createdAt: '2023-01-01T00:00:00Z'
  };

  const mockToken = 'mock-jwt-token';

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    // Reset authService state
    (authService as any).token = null;
    (authService as any).user = null;
    (authService as any).tokenExpiry = null;
  });

  describe('isAuthenticated', () => {
    test('should return false when no token exists', () => {
      expect(authService.isAuthenticated()).toBe(false);
    });

    test('should return false when token is expired', () => {
      (authService as any).token = mockToken;
      (authService as any).tokenExpiry = Date.now() - 1000; // Expired 1 second ago
      
      expect(authService.isAuthenticated()).toBe(false);
    });

    test('should return true when token is valid', () => {
      (authService as any).token = mockToken;
      (authService as any).tokenExpiry = Date.now() + 3600000; // Expires in 1 hour
      
      expect(authService.isAuthenticated()).toBe(true);
    });
  });

  describe('hasRole', () => {
    beforeEach(() => {
      (authService as any).user = mockUser;
    });

    test('should return true for exact role match', () => {
      expect(authService.hasRole('user')).toBe(true);
    });

    test('should return true for admin checking user role', () => {
      (authService as any).user = { ...mockUser, role: 'admin' };
      expect(authService.hasRole('user')).toBe(true);
    });

    test('should return false for role mismatch', () => {
      expect(authService.hasRole('admin')).toBe(false);
    });

    test('should return false when no user', () => {
      (authService as any).user = null;
      expect(authService.hasRole('user')).toBe(false);
    });
  });

  describe('addAuthHeader', () => {
    test('should add authorization header when authenticated', () => {
      (authService as any).token = mockToken;
      (authService as any).tokenExpiry = Date.now() + 3600000; // Expires in 1 hour
      const config: any = { headers: {} };
      
      const result = authService.addAuthHeader(config);
      
      expect(result.headers.Authorization).toBe(`Bearer ${mockToken}`);
    });

    test('should not add authorization header when not authenticated', () => {
      (authService as any).token = null;
      const config: any = { headers: {} };
      
      const result = authService.addAuthHeader(config);
      
      expect(result.headers.Authorization).toBeUndefined();
    });
  });

  describe('localStorage integration', () => {
    test('should load auth data from localStorage on initialization', () => {
      // Set up localStorage with valid auth data
      const futureExpiry = Date.now() + 3600000;
      localStorage.setItem('authToken', mockToken);
      localStorage.setItem('authUser', JSON.stringify(mockUser));
      localStorage.setItem('authExpiry', futureExpiry.toString());

      // Create a new instance to trigger loading from storage
      const newAuthService = new (authService.constructor as any)();

      expect(newAuthService.getToken()).toBe(mockToken);
      expect(newAuthService.getCurrentUser()).toEqual(mockUser);
      expect(newAuthService.isAuthenticated()).toBe(true);
    });

    test('should clear auth data when token is expired', () => {
      // Set up localStorage with expired auth data
      const pastExpiry = Date.now() - 1000;
      localStorage.setItem('authToken', mockToken);
      localStorage.setItem('authUser', JSON.stringify(mockUser));
      localStorage.setItem('authExpiry', pastExpiry.toString());

      // Create a new instance to trigger loading from storage
      const newAuthService = new (authService.constructor as any)();

      expect(newAuthService.getToken()).toBeNull();
      expect(newAuthService.getCurrentUser()).toBeNull();
      expect(newAuthService.isAuthenticated()).toBe(false);
    });
  });
});