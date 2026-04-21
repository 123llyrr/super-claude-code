# Queenwin Promotion 促销礼品网站设计

## 概述

1:1 复刻 promoplace.com/queenwin-promotion 促销礼品电商网站。采用 Next.js 全栈重构，提升性能与可维护性。

## 技术栈

- **框架**：Next.js 14 + App Router + TypeScript
- **样式**：TailwindCSS + 自定义 CSS 变量（匹配原站色彩）
- **数据**：本地 JSON 配置文件（`src/data/*.json`）
- **轮播**：Swiper.js（React 封装）
- **菜单**：react-hot-toast + 自定义下拉组件
- **部署**：Vercel / 静态导出

## 页面结构

| 页面 | 路径 | 说明 |
|------|------|------|
| 首页 | `/` | 轮播 + 产品网格 + 公司介绍 + Featured Item |
| 产品分类 | `/products/[category]` | 分类页（如 `/products/apparel`） |
| 产品详情 | `/products/[category]/[id]` | 产品图 + 价格 + 描述 |
| 关于我们 | `/about` | 公司介绍 |
| 联系我们 | `/contact` | 留言表单 + 联系信息 |
| 管理后台 | `/admin` | 需登录，增删改产品/轮播图 |

## 页面设计详述

### 首页

#### 1. Header
- **顶栏**：Home / About / Contact 链接 + Sign In + Cart 图标
- **主导航行**：Logo（居中）+ 搜索框 + 社交媒体图标
- **导航菜单**：8 个下拉分类（Apparel, Bags, Drinkware, Events & Occasions, Office & Stationery, Outdoor Sports, Home & Tool, Technology）
- **样式**：Sticky top，原站深色背景（#1A1E21）

#### 2. Banner 轮播
- Flexslider 风格（全屏滑动）
- 2 张图：Tote Bag、Drinkware
- 自动轮播 + 左右箭头 + 底部指示点

#### 3. Popular Products
- 标题："Popular Products"
- 网格布局：PC 6列 / tablet 4列 / mobile 2列
- 产品卡片：图片 + 名称 + 价格区间
- Hover：显示半透明遮罩 + "View" 按钮
- 底部「See more」按钮：点击加载更多（每次6个）

#### 4. Home Content
- 左侧 2/3：公司介绍文字 + h1 标题
- 右侧 1/3：Featured Item 卡片（图片 + 名称 + 描述 + 价格）

#### 5. Footer
- 四栏导航：Home / About / Contact / Rate Us
- 底部：Logo + 信用卡图标（Mastercard/Visa/Amex）+ 版权声明

### 产品分类页
- 分类侧边栏（或顶部导航筛选）
- 产品网格：同首页 Popular Products 布局
- 分页或加载更多

### 产品详情页
- 左侧：产品图片（支持多图）
- 右侧：产品名、型号、价格区间、详细描述
- 底部：相关产品推荐

## 数据结构

### 产品 `src/data/products.json`
```json
{
  "products": [
    {
      "id": "CQRNY-AGHNR",
      "name": "Lined Diaries Notebook A5 Leather Har...",
      "category": "office-stationery",
      "priceMin": 6.90,
      "priceMax": 9.20,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=948774992&I=0&PX=300",
      "images": [],
      "description": "...",
      "featured": true,
      "sku": "SQTKI014"
    }
  ]
}
```

### 分类 `src/data/categories.json`
```json
{
  "categories": [
    {
      "id": "apparel",
      "name": "Apparel",
      "subcategories": ["Caps & Hats", "T-Shirts", "Sweatshirts", ...]
    }
  ]
}
```

### 轮播图 `src/data/carousels.json`
```json
{
  "carousels": [
    {
      "id": "1",
      "image": "...",
      "link": "/products/bags/tote-bag",
      "alt": "Tote Bag"
    }
  ]
}
```

### 公司信息 `src/data/company.json`
```json
{
  "name": "Queenwin Promotion Inc",
  "location": "Pasadena, CA",
  "phone": "(213) 616-5906",
  "email": "Info@queenwinpromotion.com",
  "sage": "53364",
  "asi": "80225",
  "description": "At Queenwin Promotion.Inc, we've carved out a niche..."
}
```

## 设计风格

### 色彩（匹配原站）
- **主背景**：#1A1E21（深灰黑）
- **Primary accent**：#E2AC9E（粉橙）
- **文字**：#ADAAA5（灰）/ #1A1E21（深色）
- **卡片背景**：白色
- **Footer 背景**：原站深色风格

### 字体
- 标题：Montserrat
- 正文：Helvetica Neue / Arial

### 布局
- 最大宽度：原站自适应（container-fluid 全宽）
- 卡片间距：gutter 统一
- 响应式断点：sm:640 / md:768 / lg:1024 / xl:1280

### 动效
- 导航下拉：Superfish 风格（slide-down）
- 产品卡片 hover：opacity 遮罩 + View 按钮淡入
- 轮播：slide 切换，7000ms 间隔
- 加载更多：slideDown 动画

## 管理后台 `/admin`

### 登录
- 简单密码验证（环境变量 `ADMIN_PASSWORD`）
- 登录状态存 sessionStorage

### 产品管理
- 列表展示所有产品（支持分类筛选）
- 新增：名称、分类、价格、图片 URL
- 编辑 / 删除

### 轮播图管理
- 新增 / 编辑 / 删除轮播图
- 设置跳转链接

### 公司信息
- 修改联系方式、描述

## 目录结构

```
src/
├── app/
│   ├── layout.tsx          # 全局布局 + Header + Footer
│   ├── page.tsx            # 首页
│   ├── about/page.tsx
│   ├── contact/page.tsx
│   ├── products/
│   │   ├── [category]/page.tsx    # 分类页
│   │   └── [category]/[id]/page.tsx  # 详情页
│   └── admin/
│       ├── page.tsx        # 管理面板
│       └── login/page.tsx
├── components/
│   ├── Header/
│   ├── Footer/
│   ├── Banner/
│   ├── ProductCard/
│   ├── ProductGrid/
│   ├── CategoryNav/
│   └── ui/                # 通用按钮、输入框等
├── data/
│   ├── products.json
│   ├── categories.json
│   ├── carousels.json
│   └── company.json
├── lib/
│   └── types.ts
└── styles/
    └── globals.css        # Tailwind + 自定义变量
```

## 实施步骤

1. 初始化 Next.js 项目 + TailwindCSS
2. 配置全局样式（色彩变量、字体）
3. 构建 Header 组件（含下拉导航）
4. 构建 Footer 组件
5. 实现首页各模块（轮播、产品网格、公司介绍）
6. 构建产品分类页 + 详情页
7. 实现 About / Contact 页面
8. 构建管理后台（含登录）
9. 填充真实产品数据
10. 响应式测试 + 动效调优

## 后续优化空间（当前版本不含）

- 真实数据库（PostgreSQL / MongoDB）
- 购物车 + 订单系统
- 用户注册 / 登录
- 搜索功能（全文检索）
- SEO 优化（metadata、sitemap）
- 图片懒加载优化
