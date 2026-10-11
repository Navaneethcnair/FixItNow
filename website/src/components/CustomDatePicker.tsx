'use client';

import React, { useState, useRef, useEffect } from 'react';
import { CalendarIcon } from './Icons';
import styles from './CustomDatePicker.module.css';

interface CustomDatePickerProps {
  value: string; // 'YYYY-MM-DD'
  onChange: (date: string) => void;
  minDate?: string; // 'YYYY-MM-DD'
  placeholder?: string;
  label?: string;
  className?: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEK_DAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

export default function CustomDatePicker({
  value,
  onChange,
  minDate,
  placeholder = 'Select Date',
  label,
  className = '',
}: CustomDatePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial view month/year
  const initialDate = value ? new Date(value + 'T00:00:00') : new Date();
  const [currentMonth, setCurrentMonth] = useState(initialDate.getMonth());
  const [currentYear, setCurrentYear] = useState(initialDate.getFullYear());

  // Close popover on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear((y) => y - 1);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear((y) => y + 1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // Date calculation
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth, 1).getDay();

  const todayStr = new Date().toISOString().split('T')[0];
  const minDateStr = minDate || todayStr;

  const formatDateLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T00:00:00');
    if (isNaN(d.getTime())) return dateStr;
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
  };

  const setPreset = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const resultStr = `${yyyy}-${mm}-${dd}`;
    onChange(resultStr);
    setCurrentMonth(d.getMonth());
    setCurrentYear(d.getFullYear());
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`${styles.container} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}

      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Pick a date"
      >
        <div className={styles.valueWrap}>
          {value ? (
            <span>{formatDateLabel(value)}</span>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>
        <div className={styles.iconBadge}>
          <CalendarIcon size={16} />
        </div>
      </button>

      {isOpen && (
        <div className={styles.popover}>
          {/* Quick Presets */}
          <div className={styles.presetsRow}>
            <button
              type="button"
              className={`${styles.presetBtn} ${value === todayStr ? styles.presetActive : ''}`}
              onClick={() => setPreset(0)}
            >
              Today
            </button>
            <button
              type="button"
              className={`${styles.presetBtn} ${value === new Date(Date.now() + 86400000).toISOString().split('T')[0] ? styles.presetActive : ''}`}
              onClick={() => setPreset(1)}
            >
              Tomorrow
            </button>
            <button
              type="button"
              className={`${styles.presetBtn} ${value === new Date(Date.now() + 172800000).toISOString().split('T')[0] ? styles.presetActive : ''}`}
              onClick={() => setPreset(2)}
            >
              In 2 Days
            </button>
          </div>

          {/* Month Header Navigation */}
          <div className={styles.calendarHeader}>
            <button type="button" className={styles.navBtn} onClick={handlePrevMonth} aria-label="Previous Month">
              ‹
            </button>
            <span className={styles.monthLabel}>
              {MONTH_NAMES[currentMonth]} {currentYear}
            </span>
            <button type="button" className={styles.navBtn} onClick={handleNextMonth} aria-label="Next Month">
              ›
            </button>
          </div>

          {/* Week Days Header */}
          <div className={styles.weekHeader}>
            {WEEK_DAYS.map((wd) => (
              <span key={wd} className={styles.weekDay}>{wd}</span>
            ))}
          </div>

          {/* Days Grid */}
          <div className={styles.daysGrid}>
            {/* Empty slots before first day */}
            {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
              <div key={`empty-${idx}`} />
            ))}

            {/* Month Day Cells */}
            {Array.from({ length: daysInMonth }).map((_, idx) => {
              const dayNum = idx + 1;
              const mmStr = String(currentMonth + 1).padStart(2, '0');
              const ddStr = String(dayNum).padStart(2, '0');
              const dateStr = `${currentYear}-${mmStr}-${ddStr}`;

              const isSelected = value === dateStr;
              const isToday = todayStr === dateStr;
              const isDisabled = dateStr < minDateStr;

              return (
                <button
                  key={dateStr}
                  type="button"
                  disabled={isDisabled}
                  className={`${styles.dayCell} ${isSelected ? styles.daySelected : ''} ${
                    isToday ? styles.dayToday : ''
                  } ${isDisabled ? styles.dayDisabled : ''}`}
                  onClick={() => {
                    onChange(dateStr);
                    setIsOpen(false);
                  }}
                >
                  {dayNum}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
