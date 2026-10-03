import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import { authAPI } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let ignore = false;

    authAPI
      .getCsrfToken()
      .then(() => authAPI.getProfile())
      .then((response) => {
        if (!ignore) {
          setUser(response.data);
        }
      })
      .catch(() => {
        // ✅ بدون پارامتر error (Optional Catch Binding)
        if (!ignore) {
          setUser(null);
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoading(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => setUser(null);
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const loginUser = useCallback(async (credentials) => {
    const response = await authAPI.login(credentials);
    setUser(response.data.user);
    return response;
  }, []);

  const logoutUser = useCallback(async () => {
    await authAPI.logout();
    setUser(null);
  }, []);

  const registerUser = useCallback(async (data) => {
    const response = await authAPI.register(data);
    setUser(response.data.user);
    return response;
  }, []);

  const updateUser = useCallback(async (data) => {
    const response = await authAPI.updateProfile(data);
    setUser(response.data);
    return response;
  }, []);

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
