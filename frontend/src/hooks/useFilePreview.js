import { useCallback, useEffect, useRef, useState } from 'react';

// هر انتخاب فقط خواندنِ خودش را مالک است؛ callback قدیمی حق تغییر پیش‌نمایش را ندارد.
export function useFilePreview(fallbackPreview = null) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const readerRef = useRef(null);
  const mounted = useRef(false);

  const stopRead = useCallback(() => {
    const reader = readerRef.current;
    readerRef.current = null;
    if (!reader) return;
    reader.onload = reader.onloadend = null;
    if (reader.readyState === FileReader.LOADING) reader.abort();
  }, []);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      stopRead();
    };
  }, [stopRead]);

  const selectFile = useCallback(nextFile => {
    if (!mounted.current) return;
    stopRead();
    setFile(nextFile);
    setPreview(null);
    if (!nextFile) return;

    const reader = new FileReader();
    readerRef.current = reader;
    reader.onload = () => {
      if (mounted.current && readerRef.current === reader) setPreview(reader.result);
    };
    reader.onloadend = () => {
      if (readerRef.current === reader) readerRef.current = null;
      reader.onload = reader.onloadend = null;
    };
    reader.readAsDataURL(nextFile);
  }, [stopRead]);

  const clearFile = useCallback(() => {
    stopRead();
    if (!mounted.current) return;
    setFile(null);
    setPreview(null);
  }, [stopRead]);

  return { file, preview: preview ?? fallbackPreview, selectFile, clearFile };
}
