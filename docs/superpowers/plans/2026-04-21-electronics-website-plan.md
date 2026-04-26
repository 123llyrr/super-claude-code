# 电子产品企业网站实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建华腾科技电子产品企业网站，含首页轮播、优势介绍、产品中心、联系我们、管理后台

**Architecture:** React + Vite + TypeScript + TailwindCSS，单页应用路由，多页面组件，数据存 JSON 文件

**Tech Stack:** React 18, Vite, TypeScript, TailwindCSS, React Router DOM

---

## 项目初始化

### Task 1: 创建项目骨架

**Files:**
- Create: `/home/liuxue/桌面/electronics-website/` (项目根目录)
- Create: `package.json`
- Create: `vite.config.ts`
- Create: `tsconfig.json`
- Create: `index.html`
- Create: `tailwind.config.js`
- Create: `postcss.config.js`
- Create: `src/main.tsx`
- Create: `src/App.tsx`
- Create: `src/index.css`

- [ ] **Step 1: 创建项目目录结构**

```bash
mkdir -p /home/liuxue/桌面/electronics-website/src/{components,pages,data,hooks,utils}
mkdir -p /home/liuxue/桌面/electronics-website/public/uploads
```

- [ ] **Step 2: 创建 package.json**

```json
{
  "name": "electronics-website",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.22.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "autoprefixer": "^10.4.17",
    "postcss": "^8.4.35",
    "tailwindcss": "^3.4.1",
    "typescript": "^5.2.0",
    "vite": "^5.1.0"
  }
}
```

- [ ] **Step 3: 创建 vite.config.ts**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: './',
})
```

- [ ] **Step 4: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 5: 创建 tsconfig.node.json**

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true
  },
  "include": ["vite.config.ts"]
}
```

- [ ] **Step 6: 创建 tailwind.config.js**

```javascript
/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: '#1E40AF',
        secondary: '#3B82F6',
        accent: '#60A5FA',
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 7: 创建 postcss.config.js**

```javascript
export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
```

- [ ] **Step 8: 创建 index.html**

```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>华腾科技 - 电子产品专家</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 9: 创建 src/index.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

- [ ] **Step 10: 创建 src/main.tsx**

```typescript
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
```

- [ ] **Step 11: 创建 src/App.tsx (路由框架)**

```typescript
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import About from './pages/About'
import Contact from './pages/Contact'
import Admin from './pages/Admin'
import Login from './pages/Login'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="products" element={<Products />} />
          <Route path="products/:id" element={<ProductDetail />} />
          <Route path="about" element={<About />} />
          <Route path="contact" element={<Contact />} />
        </Route>
        <Route path="/admin" element={<Admin />} />
        <Route path="/login" element={<Login />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
```

- [ ] **Step 12: 安装依赖**

```bash
cd /home/liuxue/桌面/electronics-website && npm install
```

---

## 通用组件

### Task 2: Header 和 Footer 组件

**Files:**
- Create: `src/components/Header.tsx`
- Create: `src/components/Footer.tsx`
- Create: `src/components/Layout.tsx`

- [ ] **Step 1: 创建 src/components/Header.tsx**

```typescript
import { Link, useLocation } from 'react-router-dom'

const navLinks = [
  { path: '/', label: '首页' },
  { path: '/products', label: '产品中心' },
  { path: '/about', label: '关于我们' },
  { path: '/contact', label: '联系我们' },
]

export default function Header() {
  const location = useLocation()

  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link to="/" className="flex items-center">
            <span className="text-2xl font-bold text-primary">华腾科技</span>
          </Link>
          <nav className="hidden md:flex space-x-8">
            {navLinks.map(({ path, label }) => (
              <Link
                key={path}
                to={path}
                className={`text-sm font-medium transition-colors ${
                  location.pathname === path
                    ? 'text-primary'
                    : 'text-gray-600 hover:text-primary'
                }`}
              >
                {label}
              </Link>
            ))}
          </nav>
          <Link
            to="/admin"
            className="text-sm text-gray-400 hover:text-gray-600"
          >
            管理
          </Link>
        </div>
      </div>
    </header>
  )
}
```

- [ ] **Step 2: 创建 src/components/Footer.tsx**

```typescript
import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-xl font-bold text-white mb-4">华腾科技</h3>
            <p className="text-sm">专注电子产品研发与制造</p>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">快速链接</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-white">首页</Link></li>
              <li><Link to="/products" className="hover:text-white">产品中心</Link></li>
              <li><Link to="/about" className="hover:text-white">关于我们</Link></li>
              <li><Link to="/contact" className="hover:text-white">联系我们</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">联系方式</h4>
            <ul className="space-y-2 text-sm">
              <li>电话: 400-888-8888</li>
              <li>邮箱: info@huateng.com</li>
              <li>地址: 深圳市南山区科技园</li>
            </ul>
          </div>
          <div>
            <h4 className="text-white font-medium mb-4">关注我们</h4>
            <div className="flex space-x-4">
              <span className="text-2xl">📱</span>
              <span className="text-2xl">💬</span>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-800 mt-8 pt-8 text-sm text-center">
          © 2026 华腾科技 版权所有
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 3: 创建 src/components/Layout.tsx**

```typescript
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Footer from './Footer'

export default function Layout() {
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
```

---

## 数据层

### Task 3: JSON 数据文件

**Files:**
- Create: `src/data/products.json`
- Create: `src/data/carousels.json`
- Create: `src/data/messages.json`

- [ ] **Step 1: 创建 src/data/products.json**

```json
{
  "products": [
    {
      "id": "1",
      "name": "智能旗舰手机 X1",
      "description": "搭载最新一代处理器，6.7英寸超清屏幕，5000mAh大容量电池，支持超级快充。",
      "price": "3999",
      "images": ["https://picsum.photos/600/600?random=1", "https://picsum.photos/600/600?random=2"],
      "featured": true,
      "createdAt": "2026-04-01"
    },
    {
      "id": "2",
      "name": "无线降噪耳机 Pro",
      "description": "主动降噪技术，40小时超长续航 Hi-Res 金标认证，佩戴舒适。",
      "price": "899",
      "images": ["https://picsum.photos/600/600?random=3", "https://picsum.photos/600/600?random=4"],
      "featured": true,
      "createdAt": "2026-04-05"
    },
    {
      "id": "3",
      "name": "智能手表 Ultra",
      "description": "1.9英寸 AMOLED 屏幕，血氧心率监测，GPS 精准定位，防水 50 米。",
      "price": "2299",
      "images": ["https://picsum.photos/600/600?random=5", "https://picsum.photos/600/600?random=6"],
      "featured": true,
      "createdAt": "2026-04-10"
    },
    {
      "id": "4",
      "name": "便携式蓝牙音箱",
      "description": "360°环绕音效，IPX7防水，12小时连续播放，轻巧便携。",
      "price": "299",
      "images": ["https://picsum.photos/600/600?random=7", "https://picsum.photos/600/600?random=8"],
      "featured": false,
      "createdAt": "2026-04-15"
    },
    {
      "id": "5",
      "name": "移动电源 20000mAh",
      "description": "双向快充，三口输出，可登机，LED 数显电量。",
      "price": "149",
      "images": ["https://picsum.photos/600/600?random=9", "https://picsum.photos/600/600?random=10"],
      "featured": false,
      "createdAt": "2026-04-18"
    },
    {
      "id": "6",
      "name": "智能手环 Band 5",
      "description": "0.95英寸彩屏，睡眠监测，支付功能，21天待机。",
      "price": "199",
      "images": ["https://picsum.photos/600/600?random=11", "https://picsum.photos/600/600?random=12"],
      "featured": true,
      "createdAt": "2026-04-20"
    }
  ]
}
```

- [ ] **Step 2: 创建 src/data/carousels.json**

```json
{
  "carousels": [
    {
      "id": "1",
      "image": "https://picsum.photos/1200/500?random=20",
      "title": "新品上市",
      "subtitle": "智能旗舰手机 X1 震撼发布",
      "link": "/products/1"
    },
    {
      "id": "2",
      "image": "https://picsum.photos/1200/500?random=21",
      "title": "品质承诺",
      "subtitle": "每一款产品都经过严苛测试",
      "link": "/about"
    },
    {
      "id": "3",
      "image": "https://picsum.photos/1200/500?random=22",
      "title": "限时优惠",
      "subtitle": "全场产品享 8 折优惠",
      "link": "/products"
    }
  ]
}
```

- [ ] **Step 3: 创建 src/data/messages.json**

```json
{
  "messages": []
}
```

---

## 首页组件

### Task 4: 首页（轮播图 + 核心优势 + 产品精选）

**Files:**
- Create: `src/pages/Home.tsx`
- Create: `src/components/Carousel.tsx`
- Create: `src/components/ProductCard.tsx`

- [ ] **Step 1: 创建 src/components/Carousel.tsx**

```typescript
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import carouselsData from '../data/carousels.json'

export default function Carousel() {
  const [current, setCurrent] = useState(0)
  const carousels = carouselsData.carousels.filter(c => c.active !== false)

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrent(prev => (prev + 1) % carousels.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [carousels.length])

  if (carousels.length === 0) return null

  return (
    <div className="relative h-[400px] md:h-[500px] overflow-hidden">
      {carousels.map((item, index) => (
        <div
          key={item.id}
          className={`absolute inset-0 transition-opacity duration-700 ${
            index === current ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <img
            src={item.image}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
            <div className="text-center text-white">
              <h2 className="text-3xl md:text-5xl font-bold mb-4">{item.title}</h2>
              <p className="text-lg md:text-xl mb-6">{item.subtitle}</p>
              {item.link && (
                <Link
                  to={item.link}
                  className="inline-block bg-primary hover:bg-blue-700 px-6 py-3 rounded-lg font-medium transition-colors"
                >
                  了解更多
                </Link>
              )}
            </div>
          </div>
        </div>
      ))}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2">
        {carousels.map((_, index) => (
          <button
            key={index}
            onClick={() => setCurrent(index)}
            className={`w-3 h-3 rounded-full transition-colors ${
              index === current ? 'bg-white' : 'bg-white/50'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 src/components/ProductCard.tsx**

```typescript
import { Link } from 'react-router-dom'

interface Product {
  id: string
  name: string
  description: string
  price: string
  images: string[]
}

interface Props {
  product: Product
}

export default function ProductCard({ product }: Props) {
  return (
    <Link
      to={`/products/${product.id}`}
      className="group bg-white rounded-xl shadow-sm hover:shadow-lg transition-all overflow-hidden"
    >
      <div className="aspect-square overflow-hidden">
        <img
          src={product.images[0]}
          alt={product.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
        />
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-gray-900 mb-2 group-hover:text-primary transition-colors">
          {product.name}
        </h3>
        <p className="text-gray-500 text-sm mb-3 line-clamp-2">
          {product.description}
        </p>
        <div className="flex items-center justify-between">
          <span className="text-primary font-bold text-lg">
            ¥{product.price}
          </span>
          <span className="text-sm text-gray-400 group-hover:text-primary transition-colors">
            查看详情 →
          </span>
        </div>
      </div>
    </Link>
  )
}
```

- [ ] **Step 3: 创建 src/pages/Home.tsx**

```typescript
import Carousel from '../components/Carousel'
import ProductCard from '../components/ProductCard'
import productsData from '../data/products.json'

const advantages = [
  { icon: '🏆', title: '品质保证', desc: 'ISO9001认证' },
  { icon: '⚡', title: '技术创新', desc: '专利技术' },
  { icon: '🤝', title: '服务卓越', desc: '全程支持' },
  { icon: '🚚', title: '交付及时', desc: '准时交付' },
]

export default function Home() {
  const featured = productsData.products.filter(p => p.featured).slice(0, 6)

  return (
    <div>
      <Carousel />

      <section className="py-16 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">核心优势</h2>
            <p className="mt-2 text-gray-600">为什么选择华腾科技</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {advantages.map(({ icon, title, desc }) => (
              <div key={title} className="text-center p-6 bg-white rounded-xl shadow-sm">
                <div className="text-4xl mb-4">{icon}</div>
                <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-gray-500 text-sm">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900">精选产品</h2>
            <p className="mt-2 text-gray-600">热门产品推荐</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map(product => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="text-center mt-12">
            <a
              href="/products"
              className="inline-block border-2 border-primary text-primary hover:bg-primary hover:text-white px-8 py-3 rounded-lg font-medium transition-colors"
            >
              查看全部产品
            </a>
          </div>
        </div>
      </section>
    </div>
  )
}
```

---

## 产品中心

### Task 5: 产品中心页 + 产品详情页

**Files:**
- Create: `src/pages/Products.tsx`
- Create: `src/pages/ProductDetail.tsx`
- Create: `src/components/ImageGallery.tsx`

- [ ] **Step 1: 创建 src/pages/Products.tsx**

```typescript
import ProductCard from '../components/ProductCard'
import productsData from '../data/products.json'

export default function Products() {
  const products = productsData.products

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900">产品中心</h1>
          <p className="mt-2 text-gray-600">探索我们的全系列产品</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.map(product => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 src/components/ImageGallery.tsx**

```typescript
import { useState } from 'react'

interface Props {
  images: string[]
}

export default function ImageGallery({ images }: Props) {
  const [current, setCurrent] = useState(0)

  return (
    <div>
      <div className="aspect-square rounded-xl overflow-hidden mb-4">
        <img
          src={images[current]}
          alt="产品图"
          className="w-full h-full object-cover"
        />
      </div>
      <div className="flex gap-2 overflow-x-auto pb-2">
        {images.map((img, index) => (
          <button
            key={index}
            onClick={() => setCurrent(index)}
            className={`flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden border-2 transition-colors ${
              index === current ? 'border-primary' : 'border-transparent'
            }`}
          >
            <img src={img} alt={`细节图${index + 1}`} className="w-full h-full object-cover" />
          </button>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建 src/pages/ProductDetail.tsx**

```typescript
import { useParams, Link } from 'react-router-dom'
import productsData from '../data/products.json'
import ImageGallery from '../components/ImageGallery'

export default function ProductDetail() {
  const { id } = useParams()
  const product = productsData.products.find(p => p.id === id)

  if (!product) {
    return (
      <div className="py-20 text-center">
        <h2 className="text-2xl font-bold text-gray-900">产品未找到</h2>
        <Link to="/products" className="text-primary hover:underline mt-4 inline-block">
          返回产品中心
        </Link>
      </div>
    )
  }

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="mb-8 text-sm">
          <Link to="/" className="text-gray-400 hover:text-gray-600">首页</Link>
          <span className="mx-2 text-gray-400">/</span>
          <Link to="/products" className="text-gray-400 hover:text-gray-600">产品中心</Link>
          <span className="mx-2 text-gray-400">/</span>
          <span className="text-gray-900">{product.name}</span>
        </nav>
        <div className="grid md:grid-cols-2 gap-12">
          <ImageGallery images={product.images} />
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-4">{product.name}</h1>
            <p className="text-3xl font-bold text-primary mb-6">¥{product.price}</p>
            <div className="prose max-w-none mb-8">
              <p className="text-gray-600 leading-relaxed">{product.description}</p>
            </div>
            <div className="space-y-3">
              <button className="w-full bg-primary hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors">
                联系我们获取报价
              </button>
              <Link
                to="/contact"
                className="block w-full text-center border-2 border-primary text-primary hover:bg-primary hover:text-white py-3 rounded-lg font-medium transition-colors"
              >
                在线咨询
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## 关于我们 + 联系我们

### Task 6: 关于我们页

**Files:**
- Create: `src/pages/About.tsx`

- [ ] **Step 1: 创建 src/pages/About.tsx**

```typescript
export default function About() {
  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">关于华腾科技</h1>
          <p className="text-gray-600 max-w-2xl mx-auto">
            专注电子产品研发与制造，为客户提供高品质智能产品解决方案
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-12 mb-16">
          <div>
            <img
              src="https://picsum.photos/600/400?random=100"
              alt="公司大楼"
              className="rounded-xl shadow-lg w-full"
            />
          </div>
          <div className="flex flex-col justify-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">公司简介</h2>
            <p className="text-gray-600 leading-relaxed mb-4">
              华腾科技成立于 2010 年，是一家专注于电子产品研发、生产和销售的高新技术企业。
              公司总部位于深圳，拥有完整的研发体系和先进的生产线。
            </p>
            <p className="text-gray-600 leading-relaxed">
              我们致力于为客户提供高品质的智能电子产品，产品涵盖智能手机、智能穿戴、
              音频设备、移动电源等多个领域。凭借创新的设计和卓越的品质，产品远销全球 50 多个国家和地区。
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-16">
          {[
            { num: '15+', label: '年行业经验' },
            { num: '500+', label: '合作伙伴' },
            { num: '50+', label: '出口国家' },
            { num: '1000+', label: '在售产品' },
          ].map(({ num, label }) => (
            <div key={label} className="text-center p-6 bg-gray-50 rounded-xl">
              <div className="text-3xl font-bold text-primary mb-2">{num}</div>
              <div className="text-gray-600">{label}</div>
            </div>
          ))}
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: '🎯', title: '企业使命', desc: '让科技融入生活' },
            { icon: '👁️', title: '企业愿景', desc: '成为电子行业引领者' },
            { icon: '💡', title: '核心价值', desc: '创新、品质、服务' },
          ].map(({ icon, title, desc }) => (
            <div key={title} className="text-center p-6 bg-primary/5 rounded-xl">
              <div className="text-4xl mb-4">{icon}</div>
              <h3 className="font-semibold text-gray-900 mb-2">{title}</h3>
              <p className="text-gray-600">{desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
```

### Task 7: 联系我们页

**Files:**
- Create: `src/pages/Contact.tsx`

- [ ] **Step 1: 创建 src/pages/Contact.tsx**

```typescript
import { useState } from 'react'
import messagesData from '../data/messages.json'

export default function Contact() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', content: '' })
  const [submitted, setSubmitted] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const newMsg = {
      id: Date.now().toString(),
      ...form,
      createdAt: new Date().toISOString().split('T')[0],
    }
    messagesData.messages.push(newMsg)
    localStorage.setItem('messages', JSON.stringify(messagesData))
    setSubmitted(true)
    setForm({ name: '', email: '', phone: '', content: '' })
  }

  return (
    <div className="py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">联系我们</h1>
          <p className="text-gray-600">期待与您的合作</p>
        </div>

        <div className="grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">联系方式</h2>
            <div className="space-y-6">
              <div className="flex items-start gap-4">
                <span className="text-2xl">📍</span>
                <div>
                  <h3 className="font-medium text-gray-900">地址</h3>
                  <p className="text-gray-600">深圳市南山区科技园南路 88 号</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-2xl">📞</span>
                <div>
                  <h3 className="font-medium text-gray-900">电话</h3>
                  <p className="text-gray-600">400-888-8888</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-2xl">✉️</span>
                <div>
                  <h3 className="font-medium text-gray-900">邮箱</h3>
                  <p className="text-gray-600">info@huateng.com</p>
                </div>
              </div>
              <div className="flex items-start gap-4">
                <span className="text-2xl">🕐</span>
                <div>
                  <h3 className="font-medium text-gray-900">营业时间</h3>
                  <p className="text-gray-600">周一至周五 9:00-18:00</p>
                </div>
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-6">在线留言</h2>
            {submitted ? (
              <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
                <span className="text-4xl mb-4 block">✅</span>
                <h3 className="font-semibold text-green-800 mb-2">留言成功</h3>
                <p className="text-green-600">我们会尽快与您联系</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">姓名 *</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={e => setForm({ ...form, name: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">邮箱 *</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={e => setForm({ ...form, email: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
                  <input
                    type="tel"
                    value={form.phone}
                    onChange={e => setForm({ ...form, phone: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">留言内容 *</label>
                  <textarea
                    required
                    rows={4}
                    value={form.content}
                    onChange={e => setForm({ ...form, content: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent resize-none"
                  />
                </div>
                <button
                  type="submit"
                  className="w-full bg-primary hover:bg-blue-700 text-white py-3 rounded-lg font-medium transition-colors"
                >
                  提交留言
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
```

---

## 管理后台

### Task 8: 登录页 + 管理后台框架

**Files:**
- Create: `src/pages/Login.tsx`
- Create: `src/pages/Admin.tsx`
- Create: `src/utils/auth.ts`

- [ ] **Step 1: 创建 src/utils/auth.ts**

```typescript
const ADMIN_PASSWORD = 'admin123'

export function validatePassword(password: string): boolean {
  return password === ADMIN_PASSWORD
}

export function isLoggedIn(): boolean {
  return sessionStorage.getItem('adminLoggedIn') === 'true'
}

export function login(password: string): boolean {
  if (validatePassword(password)) {
    sessionStorage.setItem('adminLoggedIn', 'true')
    return true
  }
  return false
}

export function logout(): void {
  sessionStorage.removeItem('adminLoggedIn')
}
```

- [ ] **Step 2: 创建 src/pages/Login.tsx**

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { login } from '../utils/auth'

export default function Login() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (login(password)) {
      navigate('/admin')
    } else {
      setError('密码错误')
    }
  }

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg w-full max-w-md">
        <h1 className="text-2xl font-bold text-gray-900 mb-6 text-center">管理后台登录</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
              placeholder="请输入管理员密码"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full bg-primary hover:bg-blue-700 text-white py-2 rounded-lg font-medium transition-colors"
          >
            登录
          </button>
        </form>
        <p className="mt-4 text-center text-sm text-gray-500">默认密码: admin123</p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: 创建 src/pages/Admin.tsx**

```typescript
import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { isLoggedIn, logout } from '../utils/auth'
import productsData from '../data/products.json'
import carouselsData from '../data/carousels.json'

type Tab = 'products' | 'carousels' | 'messages'

export default function Admin() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('products')

  useEffect(() => {
    if (!isLoggedIn()) {
      navigate('/login')
    }
  }, [navigate])

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900">管理后台</h1>
          <div className="flex gap-4">
            <Link to="/" className="text-gray-600 hover:text-gray-900">查看网站</Link>
            <button onClick={handleLogout} className="text-red-600 hover:text-red-700">退出登录</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex gap-4 mb-8">
          {(['products', 'carousels', 'messages'] as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                tab === t ? 'bg-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'
              }`}
            >
              {t === 'products' ? '产品管理' : t === 'carousels' ? '轮播图管理' : '留言管理'}
            </button>
          ))}
        </div>

        {tab === 'products' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">产品列表</h2>
              <button className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                添加产品
              </button>
            </div>
            <table className="w-full">
              <thead>
                <tr className="text-left border-b">
                  <th className="pb-3 font-medium">产品名</th>
                  <th className="pb-3 font-medium">价格</th>
                  <th className="pb-3 font-medium">精选</th>
                  <th className="pb-3 font-medium">操作</th>
                </tr>
              </thead>
              <tbody>
                {productsData.products.map(p => (
                  <tr key={p.id} className="border-b last:border-0">
                    <td className="py-4">{p.name}</td>
                    <td className="py-4">¥{p.price}</td>
                    <td className="py-4">{p.featured ? '✓' : '-'}</td>
                    <td className="py-4">
                      <button className="text-primary hover:underline mr-4">编辑</button>
                      <button className="text-red-600 hover:underline">删除</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {tab === 'carousels' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-lg font-semibold">轮播图列表</h2>
              <button className="bg-primary text-white px-4 py-2 rounded-lg hover:bg-blue-700">
                添加轮播图
              </button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {carouselsData.carousels.map(c => (
                <div key={c.id} className="border rounded-lg overflow-hidden">
                  <img src={c.image} alt={c.title} className="w-full h-32 object-cover" />
                  <div className="p-4">
                    <h3 className="font-medium">{c.title}</h3>
                    <p className="text-sm text-gray-500">{c.subtitle}</p>
                    <div className="mt-2 flex gap-2">
                      <button className="text-sm text-primary hover:underline">编辑</button>
                      <button className="text-sm text-red-600 hover:underline">删除</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'messages' && (
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-lg font-semibold mb-6">留言列表</h2>
            <p className="text-gray-500">暂无留言数据</p>
          </div>
        )}
      </div>
    </div>
  )
}
```

---

## 最终验证

### Task 9: 构建并验证

- [ ] **Step 1: 构建项目**

```bash
cd /home/liuxue/桌面/electronics-website && npm run build
```

- [ ] **Step 2: 验证构建产物**

```bash
ls -la /home/liuxue/桌面/electronics-website/dist
```

- [ ] **Step 3: 预览**

```bash
cd /home/liuxue/桌面/electronics-website && npm run preview
```

---
