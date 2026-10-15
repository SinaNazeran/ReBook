import ErrorBoundary from './ErrorBoundary';
import { useLocation } from 'react-router-dom';

export default function RouteErrorBoundary({ children }) {
  const { pathname, search } = useLocation();
  return <ErrorBoundary resetKey={pathname + search}>{children}</ErrorBoundary>;
}
