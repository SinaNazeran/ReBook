import { useAuth } from '../context/useAuth';

export default function SessionStatus() {
  const { authError, retrySession } = useAuth();
  if (!authError) return null;
  return <div className="container py-3" role="alert">
    <p>{authError}</p>
    <button type="button" className="btn btn-outline-primary" onClick={retrySession}>بررسی دوباره وضعیت ورود</button>
  </div>;
}
