import { renderHook, waitFor } from '@testing-library/react-native';
import { useAuth, AuthProvider } from '../auth-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from "react";

jest.mock('@/lib/sentry', () => ({
  captureException: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
}));

jest.mock('@/lib/supabase', () => ({
  supabase: {
    auth: {
      setSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      getSession: jest.fn(async () => ({ data: { session: null }, error: null })),
      signOut: jest.fn(async () => ({ error: null })),
      onAuthStateChange: jest.fn(() => ({ data: { subscription: { unsubscribe: jest.fn() } } })),
      mfa: {
        listFactors: jest.fn(async () => ({ data: { factors: [] }, error: null })),
        getAuthenticatorAssuranceLevel: jest.fn(async () => ({ data: { currentLevel: 'aal1' }, error: null })),
      },
    },
  },
  createMemoryAuthClient: jest.fn(),
}));

jest.mock('@/lib/trpc', () => {
  const useMutation = () => ({ mutateAsync: jest.fn(async () => ({})), mutate: jest.fn(), isPending: false });
  const auth = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'me') {
        return { useQuery: () => ({ data: undefined, error: null, refetch: jest.fn() }) };
      }
      return { useMutation };
    },
  });
  const Provider = ({ children }: { children: React.ReactNode }) => children;
  return { trpc: { auth, Provider }, trpcClient: {}, trpcProxyClient: {} };
});

jest.mock('@/lib/expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>
        <AuthProvider>{children}</AuthProvider>
      </QueryClientProvider>
    );
  }
  return Wrapper;
};

describe('AuthProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should initialize with loading state', () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });
    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('leaves a stored profile signed out when there is no session', async () => {
    const mockUser = {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      role: 'platetaker',
      createdAt: new Date().toISOString(),
    };

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(JSON.stringify(mockUser));

    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });
    expect(result.current.user).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
  });

  it('should handle logout correctly', async () => {
    const { result } = renderHook(() => useAuth(), { wrapper: createWrapper() });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    await result.current.logout();

    expect(AsyncStorage.removeItem).toHaveBeenCalled();
    expect(result.current.user).toBe(null);
    expect(result.current.isAuthenticated).toBe(false);
  });
});
