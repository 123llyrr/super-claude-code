# Queenwin Promotion 网站实施方案

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 1:1 复刻 Queenwin Promotion 促销礼品电商网站（Next.js + TailwindCSS）

**Architecture:** 页面路由驱动 + JSON 本地数据 + 组件化布局。Header/Footer 全局共享，首页各模块独立组件。

**Tech Stack:** Next.js 14 + App Router + TypeScript + TailwindCSS + Swiper

---

## 文件结构

```
/home/liuxue/2号员工/queenwin-promotion/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # 全局布局（Header/Footer）
│   │   ├── page.tsx                # 首页
│   │   ├── about/page.tsx
│   │   ├── contact/page.tsx
│   │   ├── products/
│   │   │   ├── [category]/page.tsx      # 分类页
│   │   │   └── [category]/[id]/page.tsx # 详情页
│   │   └── admin/
│   │       ├── page.tsx            # 管理面板
│   │       └── login/page.tsx      # 登录页
│   ├── components/
│   │   ├── Header/Header.tsx       # 顶栏 + 主导航 + 下拉
│   │   ├── Footer/Footer.tsx
│   │   ├── Banner/Banner.tsx       # Swiper 轮播
│   │   ├── ProductCard/ProductCard.tsx
│   │   ├── ProductGrid/ProductGrid.tsx
│   │   ├── CategoryNav/CategoryNav.tsx
│   │   ├── FeaturedItem/FeaturedItem.tsx
│   │   └── ui/                    # Button/Input 等通用组件
│   ├── data/
│   │   ├── products.json
│   │   ├── categories.json
│   │   ├── carousels.json
│   │   └── company.json
│   ├── lib/
│   │   └── types.ts                # 类型定义
│   └── styles/
│       └── globals.css             # Tailwind + CSS 变量
├── public/
│   └── images/                     # 本地图片（如需）
├── tailwind.config.ts
├── next.config.ts
├── package.json
└── tsconfig.json
```

---

## 任务列表

### Task 1: 初始化项目

**Files:**
- Create: `/home/liuxue/2号员工/queenwin-promotion/package.json`
- Create: `/home/liuxue/2号员工/queenwin-promotion/next.config.ts`
- Create: `/home/liuxue/2号员工/queenwin-promotion/tailwind.config.ts`
- Create: `/home/liuxue/2号员工/queenwin-promotion/tsconfig.json`
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/styles/globals.css`

- [ ] **Step 1: 创建 package.json**

```json
{
  "name": "queenwin-promotion",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.2.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "swiper": "^11.1.14",
    "react-hot-toast": "^2.4.1"
  },
  "devDependencies": {
    "@types/node": "^20.14.12",
    "@types/react": "^18.3.3",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.4",
    "tailwindcss": "^3.4.7",
    "postcss": "^8.4.40",
    "autoprefixer": "^10.4.19"
  }
}
```

- [ ] **Step 2: 创建 next.config.ts**

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'www.promoplace.com' },
    ],
  },
}

export default nextConfig
```

- [ ] **Step 3: 创建 tailwind.config.ts**

```ts
import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'header-bg': '#1A1E21',
        'accent': '#E2AC9E',
        'accent-light': '#F0D6D1',
        'text-primary': '#1A1E21',
        'text-muted': '#ADAAA5',
        'card-bg': '#FFFFFF',
      },
      fontFamily: {
        montserrat: ['Montserrat', 'sans-serif'],
        sans: ['Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
export default config
```

- [ ] **Step 4: 创建 tsconfig.json**

```json
{
  "compilerOptions": {
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 5: 创建 globals.css**

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --header-bg: #1A1E21;
    --accent: #E2AC9E;
    --accent-light: #F0D6D1;
    --text-primary: #1A1E21;
    --text-muted: #ADAAA5;
  }

  body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: 'Montserrat', sans-serif;
  }
}

@layer components {
  .product-card-overlay {
    @apply absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center;
  }

  .product-card-overlay-btn {
    @apply opacity-0 hover:opacity-100 transition-opacity duration-300 bg-white text-header-bg px-4 py-2 rounded;
  }
}
```

- [ ] **Step 6: 安装依赖**

Run: `cd /home/liuxue/2号员工/queenwin-promotion && npm install`
Expected: 安装成功，生成 node_modules

- [ ] **Step 7: Commit**

```bash
cd /home/liuxue/2号员工/queenwin-promotion
git init
git add package.json next.config.ts tailwind.config.ts tsconfig.json src/styles/globals.css
git commit -m "feat: initialize Next.js project with TailwindCSS

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 2: 类型定义与数据

**Files:**
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/lib/types.ts`
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/data/products.json`
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/data/categories.json`
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/data/carousels.json`
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/data/company.json`

- [ ] **Step 1: 创建 types.ts**

```ts
export interface Product {
  id: string
  name: string
  category: string
  subcategory?: string
  priceMin: number
  priceMax: number
  image: string
  images?: string[]
  description: string
  featured?: boolean
  sku: string
}

export interface Category {
  id: string
  name: string
  subcategories: { id: string; name: string }[]
}

export interface Carousel {
  id: string
  image: string
  link: string
  alt: string
}

export interface Company {
  name: string
  location: string
  phone: string
  email: string
  sage: string
  asi: string
  description: string
}
```

- [ ] **Step 2: 创建 categories.json**

```json
{
  "categories": [
    {
      "id": "apparel",
      "name": "Apparel",
      "subcategories": [
        { "id": "caps-and-hats", "name": "Caps & Hats" },
        { "id": "t-shirts", "name": "T-Shirts" },
        { "id": "sweatshirts", "name": "Sweatshirts" },
        { "id": "outerwear-and-jackets", "name": "Outerwear" },
        { "id": "polo-shirts", "name": "Polo Shirts" },
        { "id": "activewear", "name": "Activewear" },
        { "id": "pants-and-shorts", "name": "Pants & Shorts" }
      ]
    },
    {
      "id": "bags",
      "name": "Bags",
      "subcategories": [
        { "id": "drawstring-bag", "name": "Drawstring Bag" },
        { "id": "fanny-pack", "name": "Fanny Pack" },
        { "id": "cooler", "name": "Cooler" },
        { "id": "tote-bag", "name": "Tote Bag" },
        { "id": "backpack-and-crossbody-bag", "name": "Backpack & Crossbody Bag" },
        { "id": "luggage-and-travel-and-accessories", "name": "Luggage & Travel" },
        { "id": "foldable-bag", "name": "Foldable Bag" }
      ]
    },
    {
      "id": "drinkware",
      "name": "Drinkware",
      "subcategories": [
        { "id": "travel-mugs-and-tumblers", "name": "Travel Mugs & Tumblers" },
        { "id": "coffee-and-tea-mugs", "name": "Coffee & Tea Mugs" },
        { "id": "sport-and-water", "name": "Sport & Water" },
        { "id": "bottles", "name": "Bottles" },
        { "id": "drinkware-accessories", "name": "Accessories" },
        { "id": "plastic-cups", "name": "Plastic Cups" }
      ]
    },
    {
      "id": "events-occasions",
      "name": "Events & Occasions",
      "subcategories": [
        { "id": "lanyards-and-badge-holders", "name": "Lanyards & Badge Holders" },
        { "id": "display", "name": "Display" },
        { "id": "awards-and-recognition", "name": "Awards & Recognition" },
        { "id": "table-throw-and-accessories", "name": "Table Throw & Accessories" },
        { "id": "tents-and-accessories", "name": "Tents & Accessories" },
        { "id": "flags", "name": "Flags" }
      ]
    },
    {
      "id": "office-stationery",
      "name": "Office & Stationery",
      "subcategories": [
        { "id": "writing-instrument-and-correction-supplies", "name": "Writing Instrument" },
        { "id": "folders-and-organizers", "name": "Folders & Organizers" },
        { "id": "computer-accessories", "name": "Computer Accessories" }
      ]
    },
    {
      "id": "outdoor-sports",
      "name": "Outdoor Sports & Entertainment",
      "subcategories": [
        { "id": "fitness-and-body-building", "name": "Fitness & Body Building" },
        { "id": "camping-and-hiking", "name": "Camping & Hiking" },
        { "id": "outdoor-tool", "name": "Outdoor Tool" },
        { "id": "toy-and-games", "name": "Toy & Games" }
      ]
    },
    {
      "id": "home-tool",
      "name": "Home & Tool",
      "subcategories": [
        { "id": "pet-supplies", "name": "Pet Supplies" },
        { "id": "towels", "name": "Towels" },
        { "id": "household-merchandises", "name": "Household Merchandises" },
        { "id": "bedding-accessories", "name": "Bedding Accessories" }
      ]
    },
    {
      "id": "technology",
      "name": "Technology",
      "subcategories": [
        { "id": "data-and-power", "name": "Data & Power" },
        { "id": "audio-and-video", "name": "Audio & Video" },
        { "id": "phone-accessories", "name": "Phone Accessories" },
        { "id": "lights-and-lighting", "name": "Lights & Lighting" }
      ]
    }
  ]
}
```

- [ ] **Step 3: 创建 products.json（含12个产品）**

```json
{
  "products": [
    {
      "id": "CQRNY-AGHNR",
      "name": "Lined Diaries Notebook A5 Leather Har...",
      "category": "office-stationery",
      "subcategory": "folders-and-organizers",
      "priceMin": 6.90,
      "priceMax": 9.20,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=948774992&I=0&PX=300",
      "description": "Lined Diaries Notebook A5 Leather Hardcover...",
      "featured": true,
      "sku": "SQTKI014"
    },
    {
      "id": "ZTCZQ-BLKTQ",
      "name": "20L Lightweight Puffy Tote Bag with C...",
      "category": "bags",
      "subcategory": "tote-bag",
      "priceMin": 10.69,
      "priceMax": 23.06,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=328177181&I=0&PX=300",
      "description": "20L Lightweight Puffy Tote Bag with C...",
      "featured": true,
      "sku": "SQTAW041"
    },
    {
      "id": "BTDXY-GBCCU",
      "name": "9\" 1 Multitool Pen",
      "category": "office-stationery",
      "subcategory": "writing-instrument-and-correction-supplies",
      "priceMin": 3.55,
      "priceMax": 5.50,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=348255935&I=0&PX=300",
      "description": "9\" 1 Multitool Pen",
      "featured": true,
      "sku": "SQTAW057"
    },
    {
      "id": "CJLXY-GKLGU",
      "name": "Tyvek Paper Tote Bag Waterproof Tear...",
      "category": "bags",
      "subcategory": "tote-bag",
      "priceMin": 4.90,
      "priceMax": 7.50,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=128974935&I=0&PX=300",
      "description": "Tyvek Paper Tote Bag Waterproof Tear...",
      "featured": false,
      "sku": "SQTAA372"
    },
    {
      "id": "ECCJS-GWCPT",
      "name": "Urinal Deodorizing And Splash Proof F...",
      "category": "home-tool",
      "subcategory": "household-merchandises",
      "priceMin": 1.11,
      "priceMax": 2.89,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=178642334&I=0&PX=300",
      "description": "Urinal Deodorizing And Splash Proof F...",
      "featured": false,
      "sku": "SQWAN008"
    },
    {
      "id": "GLRLS-AQXMU",
      "name": "Professional Resistance Exercise Bands",
      "category": "outdoor-sports",
      "subcategory": "fitness-and-body-building",
      "priceMin": 1.09,
      "priceMax": 2.99,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=508340395&I=0&PX=300",
      "description": "Professional Resistance Exercise Bands",
      "featured": true,
      "sku": "SQTAW246"
    },
    {
      "id": "BHCWY-ICPFU",
      "name": "A5 Hardcover Notebook with Elastic Ba...",
      "category": "office-stationery",
      "subcategory": "folders-and-organizers",
      "priceMin": 2.98,
      "priceMax": 5.79,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=129015915&I=0&PX=300",
      "description": "A5 Hardcover Notebook with Elastic Ba...",
      "featured": false,
      "sku": "SQWMI053"
    },
    {
      "id": "ECCJQ-DDPYU",
      "name": "Tote Cooler Bag",
      "category": "bags",
      "subcategory": "cooler",
      "priceMin": 1.98,
      "priceMax": 2.64,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=768642165&I=0&PX=300",
      "description": "Tote Cooler Bag",
      "featured": false,
      "sku": "SQWOL132"
    },
    {
      "id": "GWKGT-JXWYV",
      "name": "Computer Blue Light Blocking Eye Glasses",
      "category": "technology",
      "subcategory": "phone-accessories",
      "priceMin": 0.84,
      "priceMax": 2.32,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=338340406&I=0&PX=300",
      "description": "Computer Blue Light Blocking Eye Glasses",
      "featured": false,
      "sku": "SQTAW257"
    },
    {
      "id": "EYHLS-GDRBS",
      "name": "Long Lasting Urinal Screen And Deodor...",
      "category": "home-tool",
      "subcategory": "household-merchandises",
      "priceMin": 2.17,
      "priceMax": 5.37,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=778642333&I=0&PX=300",
      "description": "Long Lasting Urinal Screen And Deodor...",
      "featured": false,
      "sku": "SQWAN007"
    },
    {
      "id": "GLRLS-DQHWV",
      "name": "Absorbent Waffle Weave Drying Towel w...",
      "category": "home-tool",
      "subcategory": "towels",
      "priceMin": 1.18,
      "priceMax": 2.86,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=918340366&I=0&PX=300",
      "description": "Absorbent Waffle Weave Drying Towel w...",
      "featured": false,
      "sku": "SQTAW222"
    },
    {
      "id": "XQPNX-JYTFR",
      "name": "Vintage Fashion Narrow Square Frame R...",
      "category": "apparel",
      "subcategory": "accessories",
      "priceMin": 0.68,
      "priceMax": 2.15,
      "image": "https://www.promoplace.com/ws/ws.dll/QPic?SN=53364&P=908389802&I=0&PX=300",
      "description": "Vintage Fashion Narrow Square Frame R...",
      "featured": false,
      "sku": "SQTAW482"
    }
  ]
}
```

- [ ] **Step 4: 创建 carousels.json**

```json
{
  "carousels": [
    {
      "id": "1",
      "image": "https://www.promoplace.com/we/we.dll/Pic?UN=270120&F=B&S=8&T=801&N=901&TS=1526029783",
      "link": "/products/bags/tote-bag",
      "alt": "Tote Bag"
    },
    {
      "id": "2",
      "image": "https://www.promoplace.com/we/we.dll/Pic?UN=270120&F=B&S=8&T=801&N=900&TS=1526032066",
      "link": "/products/drinkware",
      "alt": "Drinkware"
    }
  ]
}
```

- [ ] **Step 5: 创建 company.json**

```json
{
  "name": "Queenwin Promotion Inc",
  "location": "Pasadena, CA",
  "phone": "(213) 616-5906",
  "email": "Info@queenwinpromotion.com",
  "sage": "53364",
  "asi": "80225",
  "description": "At Queenwin Promotion.Inc, we've carved out a niche as a leading provider in the promotional gifts industry. Specializing in transforming everyday items into powerful marketing tools, we focus on imprinting clients' logos onto a wide array of promotional gifts with precision and finesse. Our team consists of seasoned professionals who possess in-depth knowledge and extensive experience in both the promotional products..."
}
```

- [ ] **Step 6: Commit**

```bash
cd /home/liuxue/2号员工/queenwin-promotion
git add src/lib/types.ts src/data/
git commit -m "feat: add TypeScript types and JSON data

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Header 组件

**Files:**
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/components/Header/Header.tsx`
- Modify: `/home/liuxue/2号员工/queenwin-promotion/src/app/layout.tsx`

- [ ] **Step 1: 创建 Header.tsx**

```tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import categoriesData from '@/data/categories.json'

const categories = categoriesData.categories

export default function Header() {
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)

  return (
    <header className="sticky-top bg-[#1A1E21]">
      {/* Top Menu */}
      <div id="top-menu-wrap" className="bg-[#1A1E21]">
        <div className="container-fluid">
          <div className="row">
            <div className="col-sm-6 col-xs-12">
              <ul id="nav1" className="sf-menu hidden-xs flex space-x-4 py-2 text-white text-sm">
                <li><Link href="/" className="hover:text-[#E2AC9E] transition-colors">Home</Link></li>
                <li><Link href="/about" className="hover:text-[#E2AC9E] transition-colors">About</Link></li>
                <li><Link href="/contact" className="hover:text-[#E2AC9E] transition-colors">Contact</Link></li>
              </ul>
            </div>
            <div className="col-sm-6 col-xs-12">
              <div className="utlity-wrap flex justify-end space-x-4 py-2 text-white text-sm">
                <Link href="/admin/login" className="hover:text-[#E2AC9E] transition-colors">
                  <span className="fa-regular fa-right-to-bracket mr-1"></span> Sign In
                </Link>
                <Link href="/cart" className="hover:text-[#E2AC9E] transition-colors">
                  <span className="fa-regular fa-cart-shopping mr-1"></span> Cart
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div id="header-inner" className="py-4">
        <div className="container-fluid">
          <div className="row items-center">
            {/* Phone */}
            <div className="col-sm text-center">
              <ul id="header-contact" className="list-none p-0 m-0 text-white">
                <li className="phone">
                  <a href="tel:2136165906" className="text-white hover:text-[#E2AC9E]">(213) 616-5906</a>
                </li>
              </ul>
              <div className="d-none d-md-inline-block text-white text-sm mt-1">
                <strong>SAGE</strong>&nbsp;53364 <span>|</span><strong>ASI</strong> 80225
              </div>
            </div>

            {/* Logo */}
            <div className="col-sm text-center">
              <Link href="/" className="site-brand">
                <img
                  src="https://www.promoplace.com/we/we.dll/Pic?UN=270120&F=C&T=801&Age=1519737868"
                  alt="Queenwin Promotion Inc"
                  className="img-responsive max-h-16 mx-auto"
                />
              </Link>
            </div>

            {/* Search & Social */}
            <div className="col-sm">
              <div className="flex justify-end items-center space-x-4">
                <ul className="socialmediabar flex space-x-3 text-white text-xl">
                  {/* Social icons - currently commented out in original */}
                </ul>
                <div className="d-none d-md-block">
                  <form className="quicksearch flex" role="search">
                    <input
                      type="text"
                      className="form-control bg-white text-black px-3 py-1 rounded-l"
                      placeholder="What are you looking for?"
                      aria-label="Quick Search"
                    />
                    <button className="btn bg-[#E2AC9E] px-3 py-1 rounded-r" type="submit">
                      <i className="fa fa-search"></i>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <nav className="yamm navbar navbar-expand-lg bg-[#1A1E21]">
        <button
          className="navbar-toggler custom-toggler text-white lg:hidden"
          type="button"
          onClick={() => setActiveDropdown(activeDropdown === 'menu' ? null : 'menu')}
        >
          <i className="fas fa-bars"></i>
        </button>

        <div className={`collapse navbar-collapse ${activeDropdown === 'menu' ? 'show' : ''}`} id="navbarNav">
          <ul className="navbar-nav mx-auto">
            <li className="nav-item show-mobile lg:hidden">
              <Link href="/" className="nav-link text-white">Home</Link>
            </li>
            {categories.map((cat) => (
              <li
                key={cat.id}
                className="nav-item dropdown"
                onMouseEnter={() => setActiveDropdown(cat.id)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <Link
                  href={`/products/${cat.id}`}
                  className="nav-link dropdown-toggle text-white"
                >
                  {cat.name}
                </Link>
                <div className={`dropdown-menu p-0 ${activeDropdown === cat.id ? 'show' : ''}`}>
                  <div className="nav-content p-3">
                    <div className="row">
                      <ul className="col-sm">
                        {cat.subcategories.map((sub) => (
                          <li key={sub.id} className="nav-item">
                            <Link
                              href={`/products/${cat.id}/${sub.id}`}
                              className="nav-link text-black hover:text-[#E2AC9E]"
                            >
                              {sub.name}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </nav>
    </header>
  )
}
```

- [ ] **Step 2: 更新 layout.tsx**

```tsx
import type { Metadata } from 'next'
import { Inter, Montserrat } from 'next/font/google'
import './globals.css'
import Header from '@/components/Header/Header'
import Footer from '@/components/Footer/Footer'

const montserrat = Montserrat({ subsets: ['latin'], variable: '--font-montserrat' })

export const metadata: Metadata = {
  title: 'Queenwin Promotion Inc | Promotional Products & Apparel | Pasadena, CA',
  description: 'Best selection of promotional products. Let us earn your business with our 1st class service and low prices.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} font-sans antialiased`}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  )
}
```

- [ ] **Step 3: 添加 Font Awesome CDN 到 layout**

在 `</head>` 前添加：
```tsx
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet" />
```

- [ ] **Step 4: Commit**

```bash
cd /home/liuxue/2号员工/queenwin-promotion
git add src/components/Header/Header.tsx src/app/layout.tsx
git commit -m "feat: add Header component with navigation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Footer 组件

**Files:**
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/components/Footer/Footer.tsx`

- [ ] **Step 1: 创建 Footer.tsx**

```tsx
import Link from 'next/link'

export default function Footer() {
  return (
    <footer id="footer" className="footer-three bg-[#1A1E21] text-white">
      <div id="footer-top" className="py-8">
        <div className="container-fluid">
          <div className="row justify-content-center">
            <div className="col-sm-3 text-center">
              <ul className="nav4 list-none p-0">
                <li><Link href="/" className="hover:text-[#E2AC9E]">Home</Link></li>
              </ul>
            </div>
            <div className="col-sm-3 text-center">
              <ul className="nav4 list-none p-0">
                <li><Link href="/about" className="hover:text-[#E2AC9E]">About</Link></li>
              </ul>
            </div>
            <div className="col-sm-3 text-center">
              <ul className="nav4 list-none p-0">
                <li><Link href="/contact" className="hover:text-[#E2AC9E]">Contact</Link></li>
              </ul>
            </div>
            <div className="col-sm-3 text-center">
              <ul className="nav4 list-none p-0">
                <li><a href="https://www.sagemember.com/SuppRate?S=53364" target="_blank" rel="noopener noreferrer" className="hover:text-[#E2AC9E]">Rate Us Now</a></li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <div id="footer-bottom" className="py-6 border-t border-gray-700">
        <div className="container">
          <div className="row">
            <div className="col-12 text-center">
              <div id="ftlogo" className="mb-4">
                <Link href="/">
                  <img
                    src="https://www.promoplace.com/we/we.dll/Pic?UN=270120&F=C&T=801&Age=1519737868"
                    alt="Queenwin Promotion Inc"
                    className="img-responsive max-h-12 mx-auto"
                  />
                </Link>
              </div>

              <ul id="credit-cards" className="list-none p-0 flex justify-center space-x-3 text-2xl mb-4">
                <li><i className="fa-brands fa-cc-mastercard"></i></li>
                <li><i className="fa-brands fa-cc-visa"></i></li>
                <li><i className="fa-brands fa-cc-amex"></i></li>
              </ul>

              <div className="copyright-container">
                <p className="text-xs text-gray-400">
                  Information, data and designs from this website may not be copied, archived, mined, stored, captured, harvested or used in any way except in connection with use of the site in the ordinary course for its intended purpose.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/liuxue/2号员工/queenwin-promotion
git add src/components/Footer/Footer.tsx
git commit -m "feat: add Footer component

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Banner 轮播组件

**Files:**
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/components/Banner/Banner.tsx`

- [ ] **Step 1: 创建 Banner.tsx（使用 Swiper）**

```tsx
'use client'

import { Swiper, SwiperSlide } from 'swiper/react'
import { Autoplay, Navigation, Pagination } from 'swiper/modules'
import 'swiper/css'
import 'swiper/css/navigation'
import 'swiper/css/pagination'
import carouselsData from '@/data/carousels.json'
import Link from 'next/link'

const { carousels } = carouselsData

export default function Banner() {
  return (
    <div id="banner-full" className="mb-8">
      <div className="container-fluid">
        <div className="row">
          <div className="col g-0">
            <Swiper
              modules={[Autoplay, Navigation, Pagination]}
              navigation
              pagination={{ clickable: true }}
              autoplay={{ delay: 7000, disableOnInteraction: false }}
              loop
              className="main-slider"
            >
              {carousels.map((slide) => (
                <SwiperSlide key={slide.id}>
                  <Link href={slide.link}>
                    <div className="banner-pic-container">
                      <img
                        src={slide.image}
                        alt={slide.alt}
                        className="w-full h-auto"
                      />
                    </div>
                  </Link>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd /home/liuxue/2号员工/queenwin-promotion
git add src/components/Banner/Banner.tsx
git commit -m "feat: add Banner carousel component with Swiper

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 6: ProductCard + ProductGrid 组件

**Files:**
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/components/ProductCard/ProductCard.tsx`
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/components/ProductGrid/ProductGrid.tsx`

- [ ] **Step 1: 创建 ProductCard.tsx**

```tsx
import Link from 'next/link'
import { Product } from '@/lib/types'

interface ProductCardProps {
  product: Product
}

export default function ProductCard({ product }: ProductCardProps) {
  const href = `/products/${product.category}/${product.id}`

  return (
    <div className="product-card product-item">
      <Link href={href}>
        <div className="product-image relative overflow-hidden">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-auto"
          />
          <div className="product-card-overlay absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-40 transition-all duration-300 flex items-center justify-center">
            <span className="btn product-card-overlay-btn bg-white text-[#1A1E21] px-4 py-2 opacity-0 hover:opacity-100 transition-opacity duration-300">
              View
            </span>
          </div>
        </div>
        <div className="product-info p-2">
          <p className="product text-sm text-black">{product.name}</p>
          <p className="price text-gray-600 text-sm">
            ${product.priceMin.toFixed(2)} - ${product.priceMax.toFixed(2)}
          </p>
        </div>
      </Link>
    </div>
  )
}
```

- [ ] **Step 2: 创建 ProductGrid.tsx**

```tsx
'use client'

import { useState } from 'react'
import { Product } from '@/lib/types'
import ProductCard from '@/components/ProductCard/ProductCard'

interface ProductGridProps {
  products: Product[]
  initialVisible?: number
}

export default function ProductGrid({ products, initialVisible = 6 }: ProductGridProps) {
  const [visibleCount, setVisibleCount] = useState(initialVisible)
  const [showMore, setShowMore] = useState(products.length > initialVisible)

  const visibleProducts = products.slice(0, visibleCount)
  const hiddenProducts = products.slice(visibleCount)

  const handleLoadMore = () => {
    const newCount = visibleCount + 6
    setVisibleCount(newCount)
    if (newCount >= products.length) {
      setShowMore(false)
    }
  }

  return (
    <section id="featured-products">
      <div className="container-fluid">
        <h2 className="product-title-bar text-2xl font-bold text-center mb-6">Popular Products</h2>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {visibleProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>

        {hiddenProducts.length > 0 && showMore && (
          <div className="text-center mt-8">
            <button
              onClick={handleLoadMore}
              className="btn btn-default px-6 py-2 bg-gray-200 hover:bg-gray-300 transition-colors"
            >
              See more
            </button>
          </div>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/liuxue/2号员工/queenwin-promotion
git add src/components/ProductCard/ProductCard.tsx src/components/ProductGrid/ProductGrid.tsx
git commit -m "feat: add ProductCard and ProductGrid components

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 7: 首页（Home Content 区块 + FeaturedItem）

**Files:**
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/components/FeaturedItem/FeaturedItem.tsx`
- Modify: `/home/liuxue/2号员工/queenwin-promotion/src/app/page.tsx`

- [ ] **Step 1: 创建 FeaturedItem.tsx**

```tsx
import Link from 'next/link'
import { Product } from '@/lib/types'

interface FeaturedItemProps {
  product: Product
}

export default function FeaturedItem({ product }: FeaturedItemProps) {
  return (
    <div id="featured-item">
      <h3 className="text-xl font-bold mb-4">Featured Item</h3>
      <div className="inner">
        <Link href={`/products/${product.category}/${product.id}`}>
          <img
            src={product.image}
            alt={product.name}
            className="mx-auto block mb-3"
          />
          <p className="font-medium">{product.name}</p>
          <p className="text-gray-600 text-sm">{product.description}</p>
          <p className="mt-2">
            <span className="notranslate">${product.priceMin.toFixed(2)}</span> -{' '}
            <span className="notranslate">${product.priceMax.toFixed(2)}</span>
          </p>
        </Link>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建首页 page.tsx**

```tsx
import Banner from '@/components/Banner/Banner'
import ProductGrid from '@/components/ProductGrid/ProductGrid'
import FeaturedItem from '@/components/FeaturedItem/FeaturedItem'
import productsData from '@/data/products.json'
import companyData from '@/data/company.json'

const { products } = productsData
const company = companyData

export default function HomePage() {
  const featuredProducts = products.filter((p) => p.featured)
  const featuredProduct = products[1] // Tote Bag as featured

  return (
    <>
      <Banner />

      <ProductGrid products={featuredProducts.length > 0 ? featuredProducts : products.slice(0, 12)} initialVisible={12} />

      <div id="home-content-top" className="py-8">
        <div className="container">
          <div className="row">
            <div className="col-sm-8">
              <h1>{company.name} | {company.location}</h1>
              <p>{company.description}</p>
            </div>
            <div className="col-sm-4">
              <FeaturedItem product={featuredProduct} />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/liuxue/2号员工/queenwin-promotion
git add src/components/FeaturedItem/FeaturedItem.tsx src/app/page.tsx
git commit -m "feat: implement homepage with Banner, ProductGrid, and FeaturedItem

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 8: 产品分类页 + 详情页

**Files:**
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/app/products/[category]/page.tsx`
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/app/products/[category]/[id]/page.tsx`

- [ ] **Step 1: 创建分类页 products/[category]/page.tsx**

```tsx
import ProductGrid from '@/components/ProductGrid/ProductGrid'
import categoriesData from '@/data/categories.json'
import productsData from '@/data/products.json'
import { notFound } from 'next/navigation'

const { categories } = categoriesData
const { products } = productsData

interface CategoryPageProps {
  params: { category: string }
}

export default function CategoryPage({ params }: CategoryPageProps) {
  const category = categories.find((c) => c.id === params.category)

  if (!category) {
    return notFound()
  }

  const categoryProducts = products.filter((p) => p.category === params.category)

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">{category.name}</h1>

      {/* Subcategory Links */}
      <div className="mb-8">
        <div className="flex flex-wrap gap-2">
          {category.subcategories.map((sub) => (
            <a
              key={sub.id}
              href={`/products/${category.id}/${sub.id}`}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded transition-colors text-sm"
            >
              {sub.name}
            </a>
          ))}
        </div>
      </div>

      <ProductGrid products={categoryProducts} initialVisible={12} />
    </div>
  )
}
```

- [ ] **Step 2: 创建产品详情页 products/[category]/[id]/page.tsx**

```tsx
import productsData from '@/data/products.json'
import { notFound } from 'next/navigation'

const { products } = productsData

interface ProductPageProps {
  params: { category: string; id: string }
}

export default function ProductPage({ params }: ProductPageProps) {
  const product = products.find((p) => p.id === params.id)

  if (!product) {
    return notFound()
  }

  return (
    <div className="container py-8">
      <div className="row">
        <div className="col-md-6">
          <img
            src={product.image}
            alt={product.name}
            className="w-full h-auto"
          />
        </div>
        <div className="col-md-6">
          <h1 className="text-3xl font-bold mb-4">{product.name}</h1>
          <p className="text-gray-600 mb-4">SKU: {product.sku}</p>
          <p className="text-2xl font-bold mb-4">
            ${product.priceMin.toFixed(2)} - ${product.priceMax.toFixed(2)}
          </p>
          <p className="mb-6">{product.description}</p>
          <button className="btn btn-default px-6 py-3 bg-[#E2AC9E] text-white hover:bg-[#d49a8c] transition-colors">
            Add to Cart
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/liuxue/2号员工/queenwin-promotion
git add src/app/products/\[category\]/page.tsx src/app/products/\[category\]/\[id\]/page.tsx
git commit -m "feat: add product category and detail pages

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 9: About + Contact 页面

**Files:**
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/app/about/page.tsx`
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/app/contact/page.tsx`

- [ ] **Step 1: 创建 About 页面**

```tsx
import companyData from '@/data/company.json'

export default function AboutPage() {
  const company = companyData

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">About Us</h1>
      <div className="row">
        <div className="col-12">
          <img
            src="https://www.promoplace.com/we/we.dll/Pic?UN=270120&F=C&T=801&Age=1519737868"
            alt={company.name}
            className="mb-6 max-h-64"
          />
          <h2 className="text-2xl font-bold mb-4">{company.name}</h2>
          <p className="text-gray-600 mb-4">Location: {company.location}</p>
          <p className="mb-6">{company.description}</p>

          <div className="bg-gray-100 p-6 rounded">
            <h3 className="font-bold mb-2">Contact Information</h3>
            <p>Phone: <a href={`tel:${company.phone}`}>{company.phone}</a></p>
            <p>Email: <a href={`mailto:${company.email}`}>{company.email}</a></p>
            <p>SAGE: {company.sage}</p>
            <p>ASI: {company.asi}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 创建 Contact 页面**

```tsx
'use client'

import { useState } from 'react'

export default function ContactPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    message: '',
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // In production, send to API
    alert('Thank you for your message! We will contact you soon.')
    setFormData({ name: '', email: '', phone: '', message: '' })
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Contact Us</h1>

      <div className="row">
        <div className="col-md-6 mb-6">
          <div className="bg-gray-100 p-6 rounded">
            <h2 className="font-bold mb-4">Get in Touch</h2>
            <p className="mb-2">Phone: <a href="tel:2136165906">(213) 616-5906</a></p>
            <p className="mb-2">Email: <a href="mailto:Info@queenwinpromotion.com">Info@queenwinpromotion.com</a></p>
            <p className="mb-2">Location: Pasadena, CA</p>
          </div>
        </div>

        <div className="col-md-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block mb-1">Name</label>
              <input
                type="text"
                className="w-full border p-2 rounded"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block mb-1">Email</label>
              <input
                type="email"
                className="w-full border p-2 rounded"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            <div>
              <label className="block mb-1">Phone</label>
              <input
                type="tel"
                className="w-full border p-2 rounded"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="block mb-1">Message</label>
              <textarea
                className="w-full border p-2 rounded h-32"
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                required
              />
            </div>
            <button
              type="submit"
              className="btn px-6 py-2 bg-[#E2AC9E] text-white hover:bg-[#d49a8c] transition-colors rounded"
            >
              Send Message
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/liuxue/2号员工/queenwin-promotion
git add src/app/about/page.tsx src/app/contact/page.tsx
git commit -m "feat: add About and Contact pages

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 10: 管理后台 + 登录页

**Files:**
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/app/admin/login/page.tsx`
- Create: `/home/liuxue/2号员工/queenwin-promotion/src/app/admin/page.tsx`

- [ ] **Step 1: 创建登录页 admin/login/page.tsx**

```tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function AdminLoginPage() {
  const [password, setPassword] = useState('')
  const [error, setError] = useState(false)
  const router = useRouter()

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // Simple password check - in production use env variable
    const adminPassword = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || 'admin123'

    if (password === adminPassword) {
      sessionStorage.setItem('adminLoggedIn', 'true')
      router.push('/admin')
    } else {
      setError(true)
    }
  }

  return (
    <div className="container py-8 max-w-md mx-auto">
      <h1 className="text-3xl font-bold mb-6 text-center">Admin Login</h1>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1">Password</label>
          <input
            type="password"
            className="w-full border p-2 rounded"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value)
              setError(false)
            }}
            required
          />
          {error && <p className="text-red-500 mt-1">Invalid password</p>}
        </div>
        <button
          type="submit"
          className="w-full btn px-6 py-2 bg-[#E2AC9E] text-white hover:bg-[#d49a8c] transition-colors rounded"
        >
          Sign In
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: 创建管理后台 admin/page.tsx**

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import productsData from '@/data/products.json'

const { products } = productsData

export default function AdminPage() {
  const [loggedIn, setLoggedIn] = useState(false)
  const router = useRouter()

  useEffect(() => {
    const isLoggedIn = sessionStorage.getItem('adminLoggedIn') === 'true'
    if (!isLoggedIn) {
      router.push('/admin/login')
    } else {
      setLoggedIn(true)
    }
  }, [router])

  if (!loggedIn) {
    return null
  }

  return (
    <div className="container py-8">
      <h1 className="text-3xl font-bold mb-6">Admin Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Products */}
        <div className="bg-gray-100 p-6 rounded">
          <h2 className="text-xl font-bold mb-4">Products ({products.length})</h2>
          <p className="text-gray-600 mb-4">Manage your product catalog</p>
          <button className="btn px-4 py-2 bg-[#E2AC9E] text-white rounded">
            Manage Products
          </button>
        </div>

        {/* Carousels */}
        <div className="bg-gray-100 p-6 rounded">
          <h2 className="text-xl font-bold mb-4">Carousels (2)</h2>
          <p className="text-gray-600 mb-4">Update homepage banners</p>
          <button className="btn px-4 py-2 bg-[#E2AC9E] text-white rounded">
            Manage Carousels
          </button>
        </div>
      </div>

      <div className="mt-8">
        <h2 className="text-xl font-bold mb-4">Recent Products</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2 text-left">Name</th>
              <th className="border p-2 text-left">Category</th>
              <th className="border p-2 text-left">Price</th>
            </tr>
          </thead>
          <tbody>
            {products.slice(0, 5).map((product) => (
              <tr key={product.id}>
                <td className="border p-2">{product.name}</td>
                <td className="border p-2">{product.category}</td>
                <td className="border p-2">${product.priceMin.toFixed(2)} - ${product.priceMax.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
cd /home/liuxue/2号员工/queenwin-promotion
git add src/app/admin/login/page.tsx src/app/admin/page.tsx
git commit -m "feat: add Admin login and dashboard pages

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

### Task 11: 最终检查 + 运行测试

- [ ] **Step 1: 构建项目**

Run: `cd /home/liuxue/2号员工/queenwin-promotion && npm run build`
Expected: 构建成功，无 error

- [ ] **Step 2: 启动开发服务器**

Run: `npm run dev`
Expected: Server running on http://localhost:3000

- [ ] **Step 3: 验证页面**

访问以下页面，确认无 console error：
- http://localhost:3000 (首页)
- http://localhost:3000/products/bags (分类页)
- http://localhost:3000/products/bags/ZTCZQ-BLKTQ (详情页)
- http://localhost:3000/about
- http://localhost:3000/contact
- http://localhost:3000/admin/login

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete Queenwin Promotion website

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## 自查清单

- [ ] Spec 覆盖完整：Header/Footer/Banner/ProductCard/HomeContent/About/Contact/Admin
- [ ] 无占位符：所有代码完整，无 TODO/TBD
- [ ] 类型一致：Product/Carousel/Category 接口定义与使用处匹配
- [ ] 提交记录：每任务一提交，共 11 次 commit
