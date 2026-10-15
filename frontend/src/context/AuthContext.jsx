import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { authAPI } from "../services/api";
import { setMutationActor } from "../services/mutations";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const authGeneration = useRef(0);
  const ensureGeneration = useCallback((generation) => {
    if (generation !== authGeneration.current) {
      const error = new Error('حساب کاربری تغییر کرده است؛ دوباره تلاش کن.');
      error.code = 'ERR_CANCELED';
      throw error;
    }
  }, []);
  const beginAuth = useCallback(() => {
    setMutationActor(undefined);
    return ++authGeneration.current;
  }, []);
  const applyUser = useCallback((nextUser, generation) => {
    ensureGeneration(generation);
    setMutationActor(nextUser?.id ?? null);
    setUser(nextUser);
  }, [ensureGeneration]);

  useEffect(() => {
    const generation = beginAuth();

    authAPI
      .getCsrfToken()
      .then(() => {
        ensureGeneration(generation);
        return authAPI.getProfile();
      })
      .then((response) => {
        if (generation === authGeneration.current) {
          applyUser(response.data, generation);
        }
      })
      .catch(() => {
        if (generation === authGeneration.current) {
          applyUser(null, generation);
        }
      })
      .finally(() => {
        if (generation === authGeneration.current) {
          setLoading(false);
        }
      });

    return () => {
      beginAuth();
    };
  }, [applyUser, beginAuth, ensureGeneration]);

  useEffect(() => {
    const handleUnauthorized = () => {
      const generation = beginAuth();
      applyUser(null, generation);
      setLoading(false);
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, [applyUser, beginAuth]);

  const transition = useCallback(async (send, selectUser) => {
    // تا روشن شدن حساب تازه، هیچ درخواست تغییردهنده‌ای نباید با session جدید ارسال شود.
    const generation = beginAuth();
    try {
      const response = await send();
      applyUser(selectUser(response), generation);
      return response;
    } catch (error) {
      if (generation !== authGeneration.current && error.response) throw error;
      ensureGeneration(generation);
      // پاسخ گم‌شده ممکن است session را عوض کرده باشد؛ حساب قبلی را حدس نمی‌زنیم.
      const profile = await authAPI.getProfile().catch(() => null);
      if (generation !== authGeneration.current && error.response) throw error;
      applyUser(profile?.data ?? null, generation);
      throw error;
    } finally {
      if (generation === authGeneration.current) setLoading(false);
    }
  }, [applyUser, beginAuth, ensureGeneration]);

  const loginUser = useCallback(async (credentials) => {
    return transition(() => authAPI.login(credentials), response => response.data.user);
  }, [transition]);

  const logoutUser = useCallback(async () => {
    return transition(() => authAPI.logout(), () => null);
  }, [transition]);

  const registerUser = useCallback(async (data) => {
    return transition(() => authAPI.register(data), response => response.data.user);
  }, [transition]);

  const updateUser = useCallback(async (data) => {
    const generation = authGeneration.current;
    try {
      const response = await authAPI.updateProfile(data);
      applyUser(response.data, generation);
      return response;
    } catch (error) {
      if (generation !== authGeneration.current && error.response) throw error;
      ensureGeneration(generation);
      throw error;
    }
  }, [applyUser, ensureGeneration]);

  const value = useMemo(
    () => ({
      user,
      loading,
      loginUser,
      logoutUser,
      registerUser,
      updateUser,
      isAuthenticated: !!user,
      isAdmin: !!user?.is_staff,
    }),
    [user, loading, loginUser, logoutUser, registerUser, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
