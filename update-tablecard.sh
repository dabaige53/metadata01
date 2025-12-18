#!/bin/bash

# 批量更新所有模块页面的 TableCard 使用方式

echo "开始批量更新 TableCard..."

# 定义需要更新的文件列表
files=(
    "frontend/src/app/tables/page.tsx"
    "frontend/src/app/metrics/page.tsx"
    "frontend/src/app/workbooks/page.tsx"
    "frontend/src/app/datasources/page.tsx"
    "frontend/src/app/users/page.tsx"
    "frontend/src/app/views/page.tsx"
    "frontend/src/app/projects/page.tsx"
)

for file in "${files[@]}"; do
    echo "更新 $file..."

    # 1. 为 TableCard 添加 visibleRows 和 rowHeight 参数
    sed -i '' 's/<TableCard$/<TableCard\n                visibleRows={12}\n                rowHeight={48}/g' "$file"

    # 2. 更新表头行高度
    sed -i '' 's/<tr className="border-b border-gray-200 text-left">/<tr className="border-b border-gray-200 text-left h-12">/g' "$file"

    # 3. 更新表头单元格样式 (移除 py-2)
    sed -i '' 's/className="px-3 py-2 /className="px-3 /g' "$file"

    # 4. 更新数据行样式
    sed -i '' 's/className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors"/className="border-b border-gray-50 hover:bg-gray-50 cursor-pointer transition-colors h-12"/g' "$file"

    # 5. 更新数据单元格样式 (移除 py-2.5)
    sed -i '' 's/className="px-3 py-2.5/className="px-3/g' "$file"

    # 6. 更新空数据行
    sed -i '' 's/<tr>$/<tr className="h-12">/g' "$file"
    sed -i '' 's/<td colSpan={[0-9]*} className="text-center py-12/<td colSpan={5} className="text-center/g' "$file"
    sed -i '' 's/<td colSpan={[0-9]*} className="text-center py-12/<td colSpan={6} className="text-center/g' "$file"
    sed -i '' 's/<td colSpan={[0-9]*} className="text-center py-12/<td colSpan={12} className="text-center/g' "$file"
done

echo "批量更新完成！"
