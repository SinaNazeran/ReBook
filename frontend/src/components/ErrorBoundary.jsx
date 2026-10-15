import PageMetadata from './PageMetadata.jsx';
import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
    this.heading = React.createRef();
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.heading.current?.focus();
    // در آینده می‌توان اینجا خطا را به یک سرویس لاگ‌گیری ارسال کرد
    console.error('خطای غیرمنتظره:', error, errorInfo);
  }

  componentDidUpdate(previousProps) {
    if (this.state.hasError && previousProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const Wrapper = this.props.global ? 'main' : 'div';
      // همان الگوی خطای صفحه‌های فهرست (.list-state)؛ <a> نه Link، تا رفتن به پشتیبانی برنامه را از نو بار کند
      return (
        <Wrapper className="container py-5" lang="fa" dir="rtl">
          <PageMetadata canonical={null} priority={2} title="مشکلی پیش آمد | ری‌بوک" description="ری‌بوک با مشکلی روبه‌رو شد. صفحه را دوباره بارگذاری کنید یا به پشتیبانی مراجعه کنید." />
          <div className="list-state" role="alert">
            <h1 ref={this.heading} tabIndex={-1} className="h4 mb-2">
              {this.props.global ? 'ری‌بوک با مشکلی روبه‌رو شد' : 'مشکلی پیش آمد'}
            </h1>
            <p>
              صفحه را دوباره بارگذاری کن؛ اگر درست نشد، به <a href="/support">پشتیبانی</a> خبر بده.
              {' '}اگر هنگام ثبت یا پرداخت خطا دیدی، پیش از تلاش دوباره وضعیت درخواستت را بررسی کن.
            </p>
            <button type="button" className="btn btn-outline-secondary" onClick={this.handleReload}>
              بارگذاری دوباره
            </button>
            {' '}<a href="/" className="btn btn-outline-secondary">صفحه اصلی</a>
          </div>
        </Wrapper>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
