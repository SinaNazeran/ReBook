import React from 'react';

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
      // همان الگوی خطای صفحه‌های فهرست (.list-state)؛ <a> نه Link، تا رفتن به پشتیبانی برنامه را از نو بار کند
      return (
        <div className="container py-5">
          <div className="list-state" role="alert">
            <h1 className="h4 mb-2">مشکلی پیش آمد</h1>
            <p>
              صفحه را دوباره بارگذاری کن؛ اگر درست نشد، به <a href="/support">پشتیبانی</a> خبر بده.
            </p>
            <button type="button" className="btn btn-outline-secondary" onClick={this.handleReload}>
              تلاش دوباره
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;