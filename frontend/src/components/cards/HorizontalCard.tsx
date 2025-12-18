import React from 'react';

export interface HorizontalCardProps {
  // 第一行：主标题和徽章
  icon: React.ReactNode;
  title: string;
  badges?: Array<{
    text: string;
    color: 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'gray' | 'indigo';
  }>;

  // 第二行：详情信息（键值对）
  details: Array<{
    label: string;
    value: React.ReactNode;
    highlight?: boolean;
  }>;

  // 第三行：标签
  tags?: Array<{
    icon?: React.ReactNode;
    label: string;
    color: 'green' | 'blue' | 'purple' | 'red' | 'orange' | 'gray' | 'yellow';
  }>;

  // 交互
  onClick?: () => void;
}

const badgeColors = {
  green: 'bg-green-100 text-green-700 border-green-200',
  blue: 'bg-blue-100 text-blue-700 border-blue-200',
  purple: 'bg-purple-100 text-purple-700 border-purple-200',
  red: 'bg-red-100 text-red-700 border-red-200',
  orange: 'bg-orange-100 text-orange-700 border-orange-200',
  gray: 'bg-gray-100 text-gray-700 border-gray-200',
  indigo: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

const tagColors = {
  green: 'bg-green-50 text-green-700',
  blue: 'bg-blue-50 text-blue-700',
  purple: 'bg-purple-50 text-purple-700',
  red: 'bg-red-50 text-red-700',
  orange: 'bg-orange-50 text-orange-700',
  gray: 'bg-gray-50 text-gray-600',
  yellow: 'bg-yellow-50 text-yellow-700',
};

export default function HorizontalCard({
  icon,
  title,
  badges,
  details,
  tags,
  onClick,
}: HorizontalCardProps) {
  return (
    <div
      onClick={onClick}
      className={`bg-white p-4 rounded-lg border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all ${
        onClick ? 'cursor-pointer' : ''
      }`}
    >
      {/* 第一行：图标 + 标题 + 徽章 */}
      <div className="flex items-center gap-3 mb-2">
        <div className="text-indigo-600 flex-shrink-0">{icon}</div>
        <h3 className="font-semibold text-gray-800 text-sm">{title}</h3>
        {badges && badges.length > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            {badges.map((badge, idx) => (
              <span
                key={idx}
                className={`px-2 py-0.5 rounded text-xs font-medium border ${
                  badgeColors[badge.color]
                }`}
              >
                {badge.text}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* 第二行：详情信息 */}
      <div className="flex items-center gap-4 text-xs text-gray-600 mb-2 flex-wrap">
        {details.map((detail, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <span className="text-gray-500">{detail.label}:</span>
            <span
              className={
                detail.highlight
                  ? 'font-semibold text-orange-600'
                  : 'font-medium text-gray-700'
              }
            >
              {detail.value}
            </span>
          </div>
        ))}
      </div>

      {/* 第三行：标签 */}
      {tags && tags.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {tags.map((tag, idx) => (
            <span
              key={idx}
              className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${
                tagColors[tag.color]
              }`}
            >
              {tag.icon}
              {tag.label}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
