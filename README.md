# ST Support VNUA - Frontend React (Next.js 15)

Hệ thống hỗ trợ sinh viên Học viện Nông nghiệp Việt Nam (VNUA) ứng dụng Trí tuệ Nhân tạo (AI Chatbot & RAG Vector Search).

---

## 🚀 Giới thiệu dự án

**ST Support VNUA** là ứng dụng web frontend được thiết kế để hỗ trợ sinh viên tra cứu thông tin, giải đáp thắc mắc tự động thông qua AI Chatbot thông minh, đồng thời cung cấp giao diện quản trị cho nhà trường để quản lý tài liệu PDF, bộ câu hỏi và thống kê lượt tương tác.

---

## 🌟 Tính năng chính

### 1. 🤖 Giao diện Chatbot AI độc lập (`/chatbot`)
- Giao diện trò chuyện trực quan, hỗ trợ cuộc gọi API xử lý ngôn ngữ tự nhiên từ server AI.
- Tự động cuộn thông minh, hiển thị trạng thái đang xử lý và hỗ trợ tạo cuộc hội thoại mới.

### 2. 📊 Báo cáo & Thống kê Quản trị (`/admin/dashboard`)
- Thống kê tỷ lệ câu hỏi được trả lời, tỷ lệ tài liệu đã xử lý dữ liệu (Vector Embeddings).
- Biểu đồ Top 5 câu hỏi được hỏi nhiều nhất và xu hướng hội thoại theo ngày.
- Nhật ký lịch sử hội thoại hỗ trợ bộ lọc và tìm kiếm nhanh.

### 3. 📄 Thư viện & Xử lý Tài liệu PDF (`/admin/documents`)
- Tải lên tài liệu PDF thông tin nhà trường.
- Xem trực tiếp tài liệu PDF.
- Tích hợp công cụ chia nhỏ văn bản (Chunking) và xử lý Embedding cho hệ thống RAG (Retrieval-Augmented Generation).

### 4. ❓ Quản lý & Duyệt Câu hỏi (`/admin/questions`)
- Duyệt và chỉnh sửa câu hỏi mới do hệ thống/sinh viên cập nhật.
- Tự động so sánh và phát hiện câu hỏi trùng lặp.
- Hỗ trợ nhập (Import) danh sách câu hỏi hàng loạt từ tệp Excel.

### 5. 🔐 Xác thực người dùng (`/login`)
- Trang đăng nhập quản trị viên an toàn với mã hóa token và phân quyền dữ liệu.

---

## 🛠️ Công nghệ sử dụng (Tech Stack)

| Thành phần | Công nghệ |
| :--- | :--- |
| **Framework** | Next.js 15 (App Router) |
| **Ngôn ngữ** | TypeScript |
| **Styling** | Tailwind CSS v4 & Material UI (MUI v6) |
| **Icons** | Lucide React |
| **Biểu đồ** | MUI X-Charts |
| **HTTP Client** | Axios |
| **Quản lý Form** | React Hook Form & Yup |

---

## 📁 Cấu trúc thư mục

```text
st.support-vnua-react/
├── app/                        # Next.js App Router
│   ├── (dashboard)/            # Cấu trúc App Router Group
│   │   ├── admin/              # Module Quản trị (/admin/dashboard, /admin/documents, /admin/questions)
│   │   ├── chatbot/            # Module Chatbot độc lập (/chatbot)
│   │   └── login/              # Module Đăng nhập (/login)
│   ├── api/                    # API Service Clients phân theo module (admin, auth, chatbot)
│   ├── globals.css             # Cấu hình Tailwind CSS v4
│   ├── layout.tsx              # Root Layout chính
│   └── page.tsx                # Trang chủ gốc (tự động chuyển hướng về /chatbot)
├── components/                 # Các component tái sử dụng (chatbot, dashboard, questions, documents...)
├── contexts/                   # React Context Providers (AuthContext...)
├── utils/                      # Các hàm tiện ích (currency, formatters...)
└── public/                     # Tài nguyên tĩnh (logo VNUA, hình ảnh icon)
```

---

## ⚙️ Hướng dẫn cài đặt và khởi chạy

### Yêu cầu hệ thống
- **Node.js**: >= 18.x
- **npm**: >= 9.x

### Các bước cài đặt

1. **Clone repository và di chuyển vào thư mục dự án**:
   ```bash
   git clone <repository_url>
   cd st.support-vnua-react
   ```

2. **Cài đặt các gói phụ thuộc (Dependencies)**:
   ```bash
   npm install
   ```

3. **Cấu hình biến môi trường (`.env`)**:
   Tạo hoặc cập nhật tệp `.env` tại thư mục gốc của dự án:
   ```env
   NEXT_PUBLIC_LARAVEL_API_BASE_URL=http://localhost:8000/api
   NEXT_PUBLIC_PYTHON_API_BASE_URL=http://localhost:5000
   ```

4. **Khởi chạy ứng dụng ở chế độ Phát triển (Development)**:
   ```bash
   npm run dev
   ```
   Ứng dụng sẽ chạy tại địa chỉ: `http://localhost:3000`

5. **Đóng gói cho Môi trường Thực tế (Production)**:
   ```bash
   npm run build
   npm start
   ```

---

## 🔗 Liên kết các Route chính

- 🤖 **Chatbot**: [http://localhost:3000/chatbot](http://localhost:3000/chatbot)
- 📊 **Admin Dashboard**: [http://localhost:3000/admin/dashboard](http://localhost:3000/admin/dashboard)
- 📄 **Quản lý Tài liệu**: [http://localhost:3000/admin/documents](http://localhost:3000/admin/documents)
- ❓ **Quản lý Câu hỏi**: [http://localhost:3000/admin/questions](http://localhost:3000/admin/questions)
- 🔐 **Đăng nhập**: [http://localhost:3000/login](http://localhost:3000/login)
