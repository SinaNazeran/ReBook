import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/useAuth.js";
import { useState, useEffect } from "react";
import { INITIAL_FORM, FIELD_ORDER, validate, normalizeIsbn, normalizeServerErrors } from "./validation.js";
import { useCoverUpload } from "./useCoverUpload.js";
import { bookAPI, getErrorMessage } from "../../services/api";
import { onlyDigits } from "../../utils/digits";
import { toast } from "../../utils/toast";
import { CONDITION_LABELS } from "../../utils/condition";
export function useBookEditor() {
  const {
    id
  } = useParams();
  const editing = id != null;
  const {
    user
  } = useAuth();
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [baseline, setBaseline] = useState(INITIAL_FORM);
  const [existingCover, setExistingCover] = useState(null);
  const [listing, setListing] = useState(editing ? {
    state: 'loading'
  } : {
    state: 'ready'
  });
  const [reloadKey, setReloadKey] = useState(0);
  const [categories, setCategories] = useState([]);
  const [fieldErrors, setFieldErrors] = useState({});
  const [generalError, setGeneralError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const clearFieldError = name => {
    if (fieldErrors[name]) {
      setFieldErrors(prev => {
        const next = {
          ...prev
        };
        delete next[name];
        return next;
      });
    }
  };
  const {
    coverImage,
    imagePreview,
    dragging,
    setDragging,
    handleImageChange,
    handleDrop,
    removeImage
  } = useCoverUpload(clearFieldError, setFieldErrors);
  useEffect(() => {
    let ignore = false;
    bookAPI.getCategories().then(response => {
      if (!ignore) setCategories(response.data.results ?? response.data);
    }).catch(() => {
      // بدون دسته‌بندی هم می‌شود ثبت کرد؛ فقط فهرست خالی می‌ماند
    });
    return () => {
      ignore = true;
    };
  }, []);
  useEffect(() => {
    if (!editing) return undefined;
    let ignore = false;
    bookAPI.getBook(id).then(({
      data: book
    }) => {
      if (ignore) return;
      // آگهی دیگران مثل آگهی‌ای است که نیست
      if (book.seller?.id !== user?.id) {
        setListing({
          state: 'not_found'
        });
      } else if (book.status === 'sold') {
        setListing({
          state: 'sold'
        });
      } else if (book.open_order) {
        setListing({
          state: 'ordered'
        });
      } else {
        const values = {
          title: book.title,
          author: book.author,
          publisher: book.publisher || '',
          isbn: book.isbn || '',
          description: book.description || '',
          price: String(book.price),
          condition: book.condition,
          category: book.category ? String(book.category.id) : ''
        };
        setFormData(values);
        setBaseline(values);
        setExistingCover(book.cover_image);
        setListing({
          state: 'ready',
          status: book.status
        });
      }
    }).catch(err => {
      if (ignore) return;
      setListing(err.response?.status === 404 ? {
        state: 'not_found'
      } : {
        state: 'error',
        message: getErrorMessage(err)
      });
    });
    return () => {
      ignore = true;
    };
  }, [editing, id, user?.id, reloadKey]);
  const isDirty = coverImage !== null || Object.keys(INITIAL_FORM).some(key => formData[key] !== baseline[key]);
  useEffect(() => {
    if (!isDirty || loading) return undefined;
    const warn = event => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [isDirty, loading]);
  const handleChange = e => {
    const {
      name
    } = e.target;
    const value = name === 'price' ? onlyDigits(e.target.value) : e.target.value;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    clearFieldError(name);
  };
  const focusFirstError = errors => {
    const first = FIELD_ORDER.find(name => errors[name]);
    document.getElementById(first === 'condition' ? 'condition-good' : first)?.focus();
  };
  const handleSubmit = async e => {
    e.preventDefault();
    setGeneralError('');
    const errors = validate(formData);
    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors);
      focusFirstError(errors);
      return;
    }
    setFieldErrors({});
    setLoading(true);
    try {
      const data = new FormData();
      const payload = {
        ...formData,
        isbn: normalizeIsbn(formData.isbn)
      };
      // در ویرایش، فیلد خالی هم فرستاده می‌شود تا مقدار قبلی (مثلاً انتشارات) پاک شود
      Object.entries(payload).forEach(([key, value]) => {
        if (value !== '' || editing) data.append(key, typeof value === 'string' ? value.trim() : value);
      });
      // جلد فقط اگر عکس تازه‌ای انتخاب شده باشد؛ وگرنه جلد فعلی می‌ماند
      if (coverImage) data.append('cover_image', coverImage);
      if (editing) {
        await bookAPI.updateBook(id, data);
        toast.success('تغییرات ذخیره شد و آگهی برای بررسی رفت.');
      } else {
        await bookAPI.createBook(data);
        toast.success('آگهی ثبت شد و پس از بررسی در فهرست دیده می‌شود.');
      }
      navigate('/my-books', {
        replace: true
      });
    } catch (err) {
      const errorData = err.response?.data;
      if (errorData && typeof errorData === 'object' && !Array.isArray(errorData)) {
        const {
          nextFieldErrors,
          nextGeneralError
        } = normalizeServerErrors(errorData);
        setFieldErrors(nextFieldErrors);
        if (nextGeneralError) setGeneralError(nextGeneralError);
        focusFirstError(nextFieldErrors);
      } else {
        setGeneralError(getErrorMessage(err));
      }
      if (!errorData || Object.keys(errorData).some(key => key === 'detail' || key === 'non_field_errors')) {
        window.scrollTo({
          top: 0,
          behavior: 'smooth'
        });
      }
    } finally {
      setLoading(false);
    }
  };
  const roots = categories.filter(cat => cat.parent === null);
  const selectedCategory = categories.find(cat => String(cat.id) === String(formData.category));
  const previewBook = {
    id: 'preview',
    title: formData.title.trim() || 'عنوان کتاب',
    author: formData.author.trim() || 'نویسنده',
    cover_image: imagePreview || existingCover,
    category_root: selectedCategory ? selectedCategory.parent || selectedCategory.id : null,
    category_name: selectedCategory?.name,
    condition: formData.condition,
    condition_display: CONDITION_LABELS[formData.condition],
    price: formData.price || null
  };
  const error = name => fieldErrors[name]?.[0];
  const shownCover = imagePreview || existingCover;
  return {
    editing,
    listing,
    setListing,
    setReloadKey,
    generalError,
    handleSubmit,
    categories,
    formData,
    handleChange,
    error,
    roots,
    previewBook,
    shownCover,
    imagePreview,
    coverImage,
    removeImage,
    existingCover,
    dragging,
    setDragging,
    handleDrop,
    handleImageChange,
    loading
  };
}
