import { useState } from "react";
import { ACCEPTED_IMAGES, MAX_IMAGE_SIZE_MB } from "./validation.js";
export function useCoverUpload(clearFieldError, setFieldErrors) {
  const [coverImage, setCoverImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
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
    setCoverImage(file);
    clearFieldError('cover_image');
    const reader = new FileReader();
    reader.onloadend = () => setImagePreview(reader.result);
    reader.readAsDataURL(file);
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
  const removeImage = () => {
    setCoverImage(null);
    setImagePreview(null);
  };
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
