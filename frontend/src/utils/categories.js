import { useEffect, useState } from 'react';
import { bookAPI } from '../services/api';

// سربرگ و فوتر روی همه‌ی صفحه‌ها هستند؛ دسته‌ها یک بار گرفته و میان آن دو تقسیم می‌شوند.
// Home و BookList هنوز درخواست خودشان را دارند؛ اگر لازم شد، آن‌ها هم از همین استفاده کنند
let request = null;

function fetchCategories() {
  request ??= bookAPI
    .getCategories()
    .then((response) => response.data.results ?? response.data)
    .catch((error) => {
      request = null; // بار بعد دوباره امتحان شود
      throw error;
    });
  return request;
}

/** دسته‌های سطح اول (مجموعه‌ها)؛ اگر نرسید، فهرست خالی می‌ماند و پیوندهای مجموعه دیده نمی‌شوند */
export function useSeries() {
  const [series, setSeries] = useState([]);
  useEffect(() => {
    let ignore = false;
    fetchCategories()
      .then((list) => {
        if (!ignore) setSeries(list.filter((category) => category.parent === null));
      })
      .catch(() => {});
    return () => {
      ignore = true;
    };
  }, []);
  return series;
}
