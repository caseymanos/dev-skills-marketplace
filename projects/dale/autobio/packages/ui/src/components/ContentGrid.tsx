'use client';

import React, { useState } from 'react';
import { clsx } from 'clsx';
import { ThumbsUp, ThumbsDown, FileText, Image, Film, Music, Check, BookOpen, ChevronDown } from 'lucide-react';

export interface ContentItem {
  id: string;
  content_type: 'text' | 'image' | 'video' | 'audio';
  extracted_text?: string;
  thumbnail_url?: string;
  metadata?: {
    extracted_date?: string;
    people?: string[];
    places?: string[];
    emotional_tone?: string;
  };
  analysis?: {
    narrative_value: number;
    emotional_impact: number;
  };
  is_selected: boolean;
  user_rating?: number;
  chapter_id?: string;
}

export interface Chapter {
  id: string;
  title: string;
  sort_order: number;
}

export interface ContentGridProps {
  items: ContentItem[];
  chapters?: Chapter[];
  onSelect?: (id: string, selected: boolean) => void;
  onRate?: (id: string, rating: number) => void;
  onChapterAssign?: (contentId: string, chapterId: string | null) => void;
  onItemClick?: (item: ContentItem) => void;
  className?: string;
}

export function ContentGrid({
  items,
  chapters = [],
  onSelect,
  onRate,
  onChapterAssign,
  onItemClick,
  className,
}: ContentGridProps) {
  const [selectedItems, setSelectedItems] = useState<Set<string>>(
    new Set(items.filter((i) => i.is_selected).map((i) => i.id))
  );
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);

  const handleChapterSelect = (contentId: string, chapterId: string | null, e: React.MouseEvent) => {
    e.stopPropagation();
    onChapterAssign?.(contentId, chapterId);
    setOpenDropdownId(null);
  };

  const toggleDropdown = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenDropdownId(openDropdownId === id ? null : id);
  };

  const getChapterName = (chapterId?: string) => {
    if (!chapterId) return null;
    const chapter = chapters.find(c => c.id === chapterId);
    return chapter?.title;
  };

  const handleSelect = (id: string) => {
    const newSelected = new Set(selectedItems);
    if (newSelected.has(id)) {
      newSelected.delete(id);
      onSelect?.(id, false);
    } else {
      newSelected.add(id);
      onSelect?.(id, true);
    }
    setSelectedItems(newSelected);
  };

  const handleRate = (id: string, rating: number, e: React.MouseEvent) => {
    e.stopPropagation();
    onRate?.(id, rating);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'text':
        return <FileText className="w-8 h-8" />;
      case 'image':
        return <Image className="w-8 h-8" />;
      case 'video':
        return <Film className="w-8 h-8" />;
      case 'audio':
        return <Music className="w-8 h-8" />;
      default:
        return <FileText className="w-8 h-8" />;
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 8) return 'text-green-600';
    if (score >= 6) return 'text-yellow-600';
    if (score >= 4) return 'text-orange-600';
    return 'text-gray-400';
  };

  return (
    <div
      className={clsx(
        'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4',
        className
      )}
    >
      {items.map((item) => {
        const isSelected = selectedItems.has(item.id);
        const narrativeScore = item.analysis?.narrative_value || 0;

        return (
          <div
            key={item.id}
            onClick={() => onItemClick?.(item)}
            className={clsx(
              'relative group bg-white rounded-xl border-2 overflow-hidden cursor-pointer transition-all',
              isSelected
                ? 'border-blue-500 ring-2 ring-blue-200'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            {/* Selection checkbox */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleSelect(item.id);
              }}
              className={clsx(
                'absolute top-2 left-2 z-10 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors',
                isSelected
                  ? 'bg-blue-500 border-blue-500 text-white'
                  : 'bg-white/80 border-gray-300 text-transparent hover:border-blue-400'
              )}
            >
              <Check className="w-4 h-4" />
            </button>

            {/* Score badge */}
            {narrativeScore > 0 && (
              <div
                className={clsx(
                  'absolute top-2 right-2 z-10 px-2 py-1 bg-white/90 rounded-full text-xs font-medium',
                  getScoreColor(narrativeScore)
                )}
              >
                {narrativeScore}/10
              </div>
            )}

            {/* Content preview */}
            <div className="aspect-square bg-gray-100 flex items-center justify-center">
              {item.content_type === 'image' && item.thumbnail_url ? (
                <img
                  src={item.thumbnail_url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-gray-400">
                  {getTypeIcon(item.content_type)}
                </div>
              )}
            </div>

            {/* Text preview */}
            {item.extracted_text && (
              <div className="p-2 bg-white">
                <p className="text-xs text-gray-600 line-clamp-2">
                  {item.extracted_text}
                </p>
              </div>
            )}

            {/* Rating buttons */}
            <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
              <div className="flex justify-center gap-2">
                <button
                  onClick={(e) => handleRate(item.id, 1, e)}
                  className={clsx(
                    'p-2 rounded-full transition-colors',
                    item.user_rating === 1
                      ? 'bg-green-500 text-white'
                      : 'bg-white/80 text-gray-600 hover:bg-green-100'
                  )}
                >
                  <ThumbsUp className="w-4 h-4" />
                </button>
                <button
                  onClick={(e) => handleRate(item.id, -1, e)}
                  className={clsx(
                    'p-2 rounded-full transition-colors',
                    item.user_rating === -1
                      ? 'bg-red-500 text-white'
                      : 'bg-white/80 text-gray-600 hover:bg-red-100'
                  )}
                >
                  <ThumbsDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Metadata */}
            {item.metadata?.extracted_date && (
              <div className="px-2 py-1 bg-gray-50 border-t border-gray-100">
                <span className="text-xs text-gray-500">
                  {item.metadata.extracted_date}
                </span>
              </div>
            )}

            {/* Chapter Assignment - only show when selected and chapters exist */}
            {isSelected && chapters.length > 0 && (
              <div className="px-2 py-2 bg-amber-50 border-t border-amber-100">
                <div className="relative">
                  <button
                    onClick={(e) => toggleDropdown(item.id, e)}
                    className={clsx(
                      'w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-xs font-medium transition-colors',
                      item.chapter_id
                        ? 'bg-amber-100 text-amber-800 hover:bg-amber-200'
                        : 'bg-white text-gray-600 hover:bg-gray-100 border border-gray-200'
                    )}
                  >
                    <span className="flex items-center gap-1.5 truncate">
                      <BookOpen className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        {getChapterName(item.chapter_id) || 'Assign to chapter...'}
                      </span>
                    </span>
                    <ChevronDown className={clsx(
                      'w-3 h-3 flex-shrink-0 transition-transform',
                      openDropdownId === item.id && 'rotate-180'
                    )} />
                  </button>

                  {/* Dropdown menu */}
                  {openDropdownId === item.id && (
                    <div className="absolute bottom-full left-0 right-0 mb-1 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-20 max-h-48 overflow-y-auto">
                      <button
                        onClick={(e) => handleChapterSelect(item.id, null, e)}
                        className={clsx(
                          'w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors',
                          !item.chapter_id ? 'text-gray-400' : 'text-gray-600'
                        )}
                      >
                        No chapter (unassigned)
                      </button>
                      {chapters.map((chapter, idx) => (
                        <button
                          key={chapter.id}
                          onClick={(e) => handleChapterSelect(item.id, chapter.id, e)}
                          className={clsx(
                            'w-full text-left px-3 py-2 text-xs hover:bg-amber-50 transition-colors',
                            item.chapter_id === chapter.id
                              ? 'bg-amber-100 text-amber-800 font-medium'
                              : 'text-gray-700'
                          )}
                        >
                          <span className="text-gray-400 mr-1.5">{idx + 1}.</span>
                          {chapter.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
