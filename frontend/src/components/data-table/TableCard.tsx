import { ReactNode } from 'react';

interface TableCardProps {
    children: ReactNode;
    pagination?: ReactNode;
    visibleRows?: number; // 可见行数，默认 15
    rowHeight?: number; // 每行高度（px），默认 44
}

/**
 * 统一的卡片式表格容器组件
 *
 * 特性:
 * - 基于行数计算固定高度
 * - 表头和数据行高度一致
 * - 分页控件固定在底部
 * - 丰富的卡片样式
 * - 响应式设计
 *
 * @param visibleRows - 可见数据行数（不包括表头），默认 15
 * @param rowHeight - 每行高度（px），默认 44px（包括表头行）
 */
export default function TableCard({
    children,
    pagination,
    visibleRows = 15,
    rowHeight = 44
}: TableCardProps) {
    // 计算容器高度: 表头高度 + 可见行数 * 行高 + 分页区域高度(64px)
    const headerHeight = rowHeight;
    const contentHeight = visibleRows * rowHeight;
    const paginationHeight = 64;
    const totalHeight = headerHeight + contentHeight + paginationHeight;

    return (
        <div
            className="bg-white border-2 border-gray-100 rounded-xl overflow-hidden shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col"
            style={{ height: `${totalHeight}px` }}
        >
            {/* 表格滚动区域 */}
            <div
                className="overflow-auto"
                style={{ height: `${headerHeight + contentHeight}px` }}
            >
                {children}
            </div>

            {/* 固定的分页区域 */}
            {pagination && (
                <div
                    className="border-t border-gray-100 bg-gradient-to-r from-gray-50 to-white flex-shrink-0"
                    style={{ height: `${paginationHeight}px` }}
                >
                    {pagination}
                </div>
            )}
        </div>
    );
}
