import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";

// 1. فریم‌ورک پایه استایل
import "bootstrap/dist/css/bootstrap.rtl.min.css";

// 2. فونت برند
import "vazirmatn/Vazirmatn-font-face.css";

// 3. تم اختصاصی
import "./styles/theme.css";

// 4. استایل‌های سطح اپلیکیشن
import "./App.css";

// 5. استایل کتابخانه‌های ثالث
import "react-toastify/dist/ReactToastify.css";

import App from "./App.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);