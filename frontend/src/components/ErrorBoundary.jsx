import React from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // در آینده می‌توان اینجا خطا را به یک سرویس لاگ‌گیری ارسال کرد
    console.error('خطای غیرمنتظره:', error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="container text-center py-5">
          <FiAlertTriangle size={48} className="text-danger mb-3" />
          <h4 className="mb-2">متأسفانه مشکلی پیش آمد</h4>
          <p className="text-muted mb-4">
            لطفاً صفحه را دوباره بارگذاری کنید. اگر مشکل ادامه داشت با پشتیبانی
            تماس بگیرید.
          </p>
          <button className="btn btn-primary" onClick={this.handleReload}>
            <FiRefreshCw className="me-2" />
            بارگذاری مجدد
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;