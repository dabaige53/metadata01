import React from 'react';
import { Loader2 } from 'lucide-react';
import MetricCatalogCard, { MetricCatalogItem } from '../cards/MetricCatalogCard';
import Pagination from '../data-table/Pagination';

interface MetricCatalogProps {
    data: MetricCatalogItem[];
    loading: boolean;
    total: number;
    paginationState: any;
    handlePageChange: (page: number) => void;
    handlePageSizeChange: (pageSize: number) => void;
    onMetricClick?: (metric: MetricCatalogItem) => void;
}

export default function MetricCatalog({
    data,
    loading,
    total,
    paginationState,
    handlePageChange,
    handlePageSizeChange,
    onMetricClick
}: MetricCatalogProps) {
    return (
        <div className="space-y-4">
            {/* 卡片列表 */}
            <div className="space-y-3 min-h-[400px] relative">
                {loading && (
                    <div className="absolute inset-0 bg-white/50 backdrop-blur-[1px] flex justify-center items-start pt-20 z-10 transition-all">
                        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
                    </div>
                )}

                {data.length === 0 && !loading ? (
                    <div className="py-20 text-center text-gray-400">
                        {total === 0 ? '暂无数据' : '未找到匹配的指标'}
                    </div>
                ) : (
                    data.map((item, idx) => (
                        <MetricCatalogCard
                            key={`${item.name}-${item.formula_hash || idx}`}
                            metric={item}
                            onClick={() => onMetricClick?.(item)}
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
