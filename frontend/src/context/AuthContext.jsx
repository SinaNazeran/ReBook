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
  const [authError, setAuthError] = useState(null);
  const [sessionAttempt, setSessionAttempt] = useState(0);
  const sessionBusy = useRef(true);
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
    setAuthError(null);
  }, [ensureGeneration]);

  const retrySession = useCallback(() => {
    if (sessionBusy.current) return;
    sessionBusy.current = true;
    beginAuth();
    setUser(null);
    setAuthError(null);
    setLoading(true);
    setSessionAttempt(attempt => attempt + 1);
  }, [beginAuth]);

  useEffect(() => {
    const generation = beginAuth();
    sessionBusy.current = true;

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
      .catch(error => {
        if (generation === authGeneration.current) {
          if (error.response?.status === 401) applyUser(null, generation);
          else {
            setUser(null);
            setAuthError('وضعیت ورود بررسی نشد. اتصال اینترنت را بررسی کن و دوباره تلاش کن.');
          }
        }
      })
      .finally(() => {
        if (generation === authGeneration.current) {
          setLoading(false);
          sessionBusy.current = false;
        }
      });

    return () => {
      beginAuth();
    };
  }, [applyUser, beginAuth, ensureGeneration, sessionAttempt]);

  useEffect(() => {
    const handleUnauthorized = () => {
      const generation = beginAuth();
      applyUser(null, generation);
      setLoading(false);
      sessionBusy.current = false;
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
      if (generation === authGeneration.current) {
        setLoading(false);
        sessionBusy.current = false;
      }
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
      authError,
      retrySession,
      loginUser,
      logoutUser,
      registerUser,
      updateUser,
      isAuthenticated: !!user,
      isAdmin: !!user?.is_staff,
    }),
    [user, loading, authError, retrySession, loginUser, logoutUser, registerUser, updateUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export default AuthContext;
