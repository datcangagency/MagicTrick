# MagicTrick

Kho giao diện biểu diễn của Đất Cảng Agency. Mỗi trick có một thư mục riêng trong `site/` và một đường dẫn trên GitHub Pages.

- [Picture Prediction](https://datcangagency.github.io/MagicTrick/picture-prediction/)
- [Danh mục](https://datcangagency.github.io/MagicTrick/)

GitHub Actions tự xuất bản `site/` khi phần web thay đổi trên `main`. Biến Actions `PICTURE_API_BASE` là URL HTTPS của dịch vụ Picture Prediction. Khi cập nhật biến, chạy lại workflow **Publish MagicTrick to GitHub Pages** để áp dụng.
