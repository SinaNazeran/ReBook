import { useState } from "react";
import { useFilePreview } from "../../hooks/useFilePreview.js";
import { ACCEPTED_IMAGES, MAX_IMAGE_SIZE_MB } from "./validation.js";
export function useCoverUpload(clearFieldError, setFieldErrors) {
  const { file: coverImage, preview: imagePreview, selectFile, clearFile } = useFilePreview();
  const [dragging, setDragging] = useState(false);
  const setCoverError = message => setFieldErrors(prev => ({
    ...prev,
    cover_image: [message]
  }));
  const pickImage = file => {
    if (!file) return;
    if (!ACCEPTED_IMAGES.split(',').includes(file.type)) {
      setCoverError('فقط تصویر JPG، PNG یا WebP.');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_MB * 1024 * 1024) {
      setCoverError(`حجم تصویر بیشتر از ${MAX_IMAGE_SIZE_MB.toLocaleString('fa-IR')} مگابایت است؛ تصویر کوچک‌تری انتخاب کن.`);
      return;
    }
    selectFile(file);
    clearFieldError('cover_image');
  };
  const handleImageChange = e => {
    pickImage(e.target.files?.[0]);
    e.target.value = ''; // انتخاب دوباره‌ی همان فایل هم change بدهد
  };
  const handleDrop = e => {
    e.preventDefault();
    setDragging(false);
    pickImage(e.dataTransfer.files?.[0]);
  };
  const removeImage = clearFile;
  return {
    coverImage,
    imagePreview,
    dragging,
    setDragging,
    handleImageChange,
    handleDrop,
    removeImage
  };
}
