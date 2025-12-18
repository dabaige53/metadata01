import React from 'react';
import { ArrowRight } from 'lucide-react';

export interface CardField {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  highlight?: boolean;
  truncate?: boolean;
  mono?: boolean;
}

export interface CardBadge {
  text: string;
  color: 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'gray' | 'indigo';
}

export interface CardTag {
  label: string;
  color: 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'gray' | 'yellow';
  icon?: React.ReactNode;
}

export interface BaseCardProps {
  // 卡片头部
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: CardBadge;

  // 卡片主体 - 关键字段网格
  fields: CardField[];

  // 卡片底部 - 标签
  tags?: CardTag[];

  // 交互
  onClick?: () => void;
  onHover?: () => void;

  // 样式
  className?: string;
}

const badgeColors = {
  green: 'bg-green-50 text-green-700',
  blue: 'bg-blue-50 text-blue-700',
  purple: 'bg-purple-50 text-purple-700',
  red: 'bg-red-50 text-red-700',
  orange: 'bg-orange-50 text-orange-700',
  gray: 'bg-gray-50 text-gray-700',
  indigo: 'bg-indigo-50 text-indigo-700',
};

const tagColors = {
  green: 'bg-green-100 text-green-700',
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  red: 'bg-red-100 text-red-700',
  orange: 'bg-orange-100 text-orange-700',
  gray: 'bg-gray-100 text-gray-700',
  yellow: 'bg-yellow-100 text-yellow-700',
};

export default function BaseCard({
  icon,
  title,
  subtitle,
  badge,
  fields,
  tags,
  onClick,
  onHover,
  className = '',
}: BaseCardProps) {
  return (
    <div
      onClick={onClick}
      onMouseEnter={onHover}
      className={`bg-white p-5 rounded-xl border border-gray-200 shadow-sm hover:shadow-md hover:border-indigo-200 transition-all ${
        onClick ? 'cursor-pointer' : ''
      } group ${className}`}
    >
      {/* 卡片头部 */}
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 flex-shrink-0">
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 text-sm truncate" title={title}>
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-gray-500 truncate mt-0.5" title={subtitle}>
                {subtitle}
              </p>
            )}
          </div>
        </div>
        {badge && (
          <div
            className={`px-2 py-0.5 rounded text-[10px] font-medium flex-shrink-0 ml-2 ${
              badgeColors[badge.color]
            }`}
          >
            {badge.text}
          </div>
        )}
      </div>

      {/* 卡片主体 - 字段网格 */}
      <div className="space-y-2.5 mb-4">
        {fields.map((field, index) => (
          <div key={index} className="flex items-start gap-2">
            {field.icon && (
              <div className="text-gray-400 flex-shrink-0 mt-0.5">{field.icon}</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[10px] text-gray-500 uppercase tracking-wide mb-0.5">
                {field.label}
              </div>
              <div
                className={`text-xs ${
                  field.highlight
                    ? 'text-orange-600 font-semibold'
                    : 'text-gray-700'
                } ${field.truncate ? 'truncate' : ''} ${
                  field.mono ? 'font-mono' : ''
                }`}
                title={typeof field.value === 'string' ? field.value : undefined}
              >
                {field.value || '-'}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 卡片底部 - 标签和操作 */}
      {tags && tags.length > 0 && (
        <div className="border-t border-gray-100 pt-3 flex flex-wrap gap-1.5">
          {tags.map((tag, index) => (
            <div
              key={index}
              className={`px-2 py-0.5 rounded text-[10px] font-medium flex items-center gap-1 ${
                tagColors[tag.color]
              }`}
            >
              {tag.icon}
              {tag.label}
            </div>
          ))}
        </div>
      )}

      {/* 点击箭头指示器 */}
      {onClick && (
        <div className="border-t border-gray-100 pt-3 mt-3 flex justify-end">
          <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-indigo-500 transition-colors" />
        </div>
      )}
    </div>
  );
}
