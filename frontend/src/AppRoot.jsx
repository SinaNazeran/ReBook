import { BrowserRouter } from 'react-router-dom';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';

export default function AppRoot() {
  return (
    <ErrorBoundary global>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
