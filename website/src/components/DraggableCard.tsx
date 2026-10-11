'use client';

import React, { useState } from 'react';
import styles from './DraggableCard.module.css';

interface DraggableCardProps {
  id: string;
  index: number;
  totalCards: number;
  onMove: (fromIndex: number, toIndex: number) => void;
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export default function DraggableCard({
  index,
  totalCards,
  onMove,
  children,
  className = '',
  style,
}: DraggableCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('text/plain', index.toString());
    e.dataTransfer.effectAllowed = 'move';
    setIsDragging(true);
  };

  const handleDragEnd = () => {
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const fromIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
    if (!isNaN(fromIndex) && fromIndex !== index) {
      onMove(fromIndex, index);
    }
  };

  return (
    <div
      className={`${styles.cardWrapper} ${isDragging ? styles.isDragging : ''} ${className}`}
      style={style}
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* 6-Dot Drag Handle Button matching exact user spec */}
      <div className={styles.dragHandleWrap}>
        <button
          type="button"
          className={styles.dragHandleBtn}
          title="Drag or click to re-order cards"
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu((prev) => !prev);
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="9" cy="5" r="1.7" />
            <circle cx="15" cy="5" r="1.7" />
            <circle cx="9" cy="12" r="1.7" />
            <circle cx="15" cy="12" r="1.7" />
            <circle cx="9" cy="19" r="1.7" />
            <circle cx="15" cy="19" r="1.7" />
          </svg>
        </button>

        {showMenu && (
          <div className={styles.reorderMenu} onClick={(e) => e.stopPropagation()}>
            <div className={styles.menuTitle}>Reorder Card</div>
            <button
              type="button"
              disabled={index === 0}
              onClick={() => {
                onMove(index, index - 1);
                setShowMenu(false);
              }}
            >
              <span>⬆️ / ⬅️</span> Move Up / Left
            </button>
            <button
              type="button"
              disabled={index === totalCards - 1}
              onClick={() => {
                onMove(index, index + 1);
                setShowMenu(false);
              }}
            >
              <span>⬇️ / ➡️</span> Move Down / Right
            </button>
          </div>
        )}
      </div>

      {children}
    </div>
  );
}
