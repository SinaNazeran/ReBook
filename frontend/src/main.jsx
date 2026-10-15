import React from "react";
import ReactDOM from "react-dom/client";

// 1. فریم‌ورک پایه استایل
import "bootstrap/dist/css/bootstrap.rtl.min.css";

// 2. فونت برند — نسخه‌ی FD: رقم‌های لاتین (شابک، کد پیگیری، متن‌های API) به شکل فارسی نمایش داده می‌شوند
//    ولی خودِ متن لاتین می‌ماند. نسخه‌ی عادی فقط برای شناسه‌های لاتین (.latin-id در theme.css) است؛
//    @font-face تا وقتی استفاده نشود دانلود نمی‌شود
import "vazirmatn/misc/Farsi-Digits/Vazirmatn-FD-font-face.css";
import "vazirmatn/Vazirmatn-font-face.css";
// حروف نمایشی (تیترهای بزرگ، برند، جلد ساده)؛ فقط زیرمجموعه‌ی عربی
import "@fontsource/lalezar/arabic-400.css";

// 3. تم اختصاصی
import "./styles/theme.css";

// 4. استایل‌های سطح اپلیکیشن
import "./App.css";
import "./styles/depth.css";

// 5. استایل کتابخانه‌های ثالث
import "react-toastify/dist/ReactToastify.css";

import AppRoot from "./AppRoot.jsx";
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppRoot />
  </React.StrictMode>
);
