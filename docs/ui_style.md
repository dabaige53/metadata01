# UI 设计规范

## 1. 核心配色 (Color Palette)

基于 Tailwind CSS 的 Indigo 色系与 Neutral Gray 色系。

### 品牌色 (Brand)

- **Primary**: `#4f46e5` (`indigo-600`) - 主要操作按钮、选中状态
- **Primary Light**: `#eef2ff` (`indigo-50`) - 背景高亮、Hover 状态
- **Accent**: `#4338ca` (`indigo-700`) - 激活状态文字

### 功能色 (Functional)

- **Success**: `#10b981` (`emerald-500`) - 成功、正常状态
- **Warning**: `#f59e0b` (`amber-500`) - 警告、注意
- **Danger**: `#ef4444` (`red-500`) - 错误、删除操作

### 中性色 (Neutrals)

- **Background**: `#f9fafb` (`gray-50`) - 页面底色
- **Surface**: `#ffffff` (`white`) - 卡片、侧边栏、顶栏背景
- **Border**: `#e5e7eb` (`gray-200`) - 边框、分割线
- **Divider**: `#f3f4f6` (`gray-100`) - 列表分割线

### 文字颜色 (Typography Colors)

- **Primary Text**: `#111827` (`gray-900`) - 标题、主要内容
- **Secondary Text**: `#4b5563` (`gray-600`) -次要信息、正文
- **Muted Text**: `#9ca3af` (`gray-400`) - 占位符、图标、元数据

---

## 2. 排版 (Typography)

**字体**: `Inter`, system-ui, sans-serif

### 层级

- **Page Title**: `text-2xl font-bold text-gray-900`
- **Section Title**: `text-lg font-semibold text-gray-800`
- **Body**: `text-sm` (默认字号)
- **Small**: `text-xs` (元数据、标签)

---

## 3. 布局 (Layout)

### 整体结构

- **Sidebar**: 宽度 `w-64`，固定定位，背景白色，右侧边框。
- **Header**: 高度 `h-16`，吸顶 (`sticky top-0`)，白色背景，底部边框。
- **Main Content**: `bg-gray-50`，内边距 `p-8`。

### 容器

- **Card**: `bg-white border border-gray-200 rounded-lg shadow-sm`
- **Table Container**: `bg-white border border-gray-200 rounded-lg overflow-hidden`

---

## 4. 组件风格 (Component Styles)

### 按钮 & 交互

- **Hover Effects**: 大部分交互元素 hover 时使用 `bg-gray-50` 或 `text-gray-900`。
- **Transitions**: `transition-colors`, `transition-all` 用于平滑交互。
- **Rounded**: 常用 `rounded-lg` (8px)。

### 表格 (Data Table)

- **Header**: `bg-gray-50`, `text-xs uppercase font-medium text-gray-500`.
- **Row**: `border-b border-gray-50`, hover 时 `bg-gray-50`.
- **Cell**: `px-3 py-2.5 text-sm`.

### 导航 (Navigation)

- **Item**: `px-3 py-2 rounded-lg text-sm`.
- **Active**: `bg-indigo-50 text-indigo-700`.
- **Inactive**: `text-gray-600 hover:bg-gray-50 hover:text-gray-900`.

---

## 5. 图标 (Icons)

使用 `lucide-react` 图标库。

- 默认尺寸: `w-4 h-4` 或 `w-5 h-5`。
- 默认颜色: `text-gray-400`，激活/Hover 时变色。
