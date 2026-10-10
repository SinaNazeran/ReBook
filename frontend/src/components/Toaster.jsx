import { ToastContainer, cssTransition } from 'react-toastify';
import { FiCheck, FiAlertCircle, FiAlertTriangle, FiInfo, FiX } from 'react-icons/fi';

// شکل هر نوع جدا از رنگش خوانده می‌شود (مثل StatusMark): تیک = انجام شد، دایره = خطا، مثلث = هشدار، i = اطلاع
const ICONS = { success: FiCheck, error: FiAlertCircle, warning: FiAlertTriangle, info: FiInfo };

// ورود: کمی از پایین بالا می‌آید و روشن می‌شود؛ خروج کوتاه‌تر. keyframeها در App.css (بخش toast)، با حرکت کمتر فقط محو
const Rise = cssTransition({ enter: 'rb-toast-in', exit: 'rb-toast-out', collapseDuration: 200 });

function ToastIcon({ type }) {
  const Icon = ICONS[type];
  return Icon ? (
    <span className="rb-toast-icon">
      <Icon aria-hidden="true" />
    </span>
  ) : null;
}

// دکمه‌ی پیش‌فرض برچسب انگلیسی «close» دارد و ۱۴ پیکسل است؛ این یکی فارسی و ۴۴ پیکسل برای انگشت
function CloseButton({ closeToast }) {
  return (
    <button type="button" className="rb-toast-close" onClick={closeToast} aria-label="بستن">
      <FiX aria-hidden="true" />
    </button>
  );
}

/**
 * جای toastها: پایین، سمت پایانِ صفحه (چپ در RTL) روی دسکتاپ، تمام‌عرض با حاشیه روی موبایل.
 * بالای صفحه سربرگ چسبان، سبد و منوی حساب است؛ پایین آزاد است (و روی موبایل بالای نوار خرید می‌نشیند، App.css).
 */
function Toaster() {
  return (
    <ToastContainer
      position="bottom-left"
      rtl
      limit={3}
      hideProgressBar
      transition={Rise}
      icon={ToastIcon}
      closeButton={CloseButton}
      draggablePercent={35}
      closeOnClick={false}
    />
  );
}

export default Toaster;
