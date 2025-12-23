import React from 'react';
import { Loader2 } from 'lucide-react';
import FieldCatalogCard, { FieldCatalogItem } from '../cards/FieldCatalogCard';
import Pagination from '../data-table/Pagination';

interface FieldCatalogProps {
    data: FieldCatalogItem[];
    loading: boolean;
    total: number;
    paginationState: any;
    handlePageChange: (page: number) => void;
    handlePageSizeChange: (pageSize: number) => void;
    onFieldClick?: (field: FieldCatalogItem) => void;
}

export default function FieldCatalog({
    data,
    loading,
    total,
    paginationState,
    handlePageChange,
    handlePageSizeChange,
    onFieldClick
}: FieldCatalogProps) {
    return (
        <div className="space-y-4">
            {/* 卡片列表 */}
            <div className="space-y-3 min-h-[400px] relative transition-opacity duration-200" style={{ opacity: loading && data.length > 0 ? 0.6 : 1 }}>
                {/* 顶部加载进度条 (仅在已有数据重新加载时显示) */}
                {loading && data.length > 0 && (
                    <div className="absolute top-0 left-0 right-0 h-1 bg-indigo-100 overflow-hidden rounded-t-lg z-20">
                        <div className="h-full bg-indigo-500 animate-[loading_1.5s_ease-in-out_infinite]" style={{ width: '30%' }}></div>
                    </div>
                )}

                {/* 首次加载的大 Spinner */}
                {loading && data.length === 0 && (
                    <div className="absolute inset-0 flex justify-center items-start pt-20 z-10">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                )}

                {data.length === 0 && !loading ? (
                    <div className="py-20 text-center text-gray-400">
                        {total === 0 ? '暂无数据' : '未找到匹配的字段'}
                    </div>
                ) : (
                    data.map((item, idx) => (
                        <FieldCatalogCard
                            key={`${item.canonical_name}-${item.table_id || idx}`}
                            field={item}
                            onClick={() => onFieldClick?.(item)}
                        />
                    ))
                )}
            </div>

            {/* 分页控件 */}
            {total > 0 && (
                <Pagination
                    pagination={paginationState}
                    onPageChange={handlePageChange}
                    onPageSizeChange={handlePageSizeChange}
                />
            )}
        </div>
    );
}
