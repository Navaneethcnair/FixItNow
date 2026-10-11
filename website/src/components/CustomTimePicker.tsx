'use client';

import React, { useState, useRef, useEffect } from 'react';
import { ClockIcon } from './Icons';
import styles from './CustomTimePicker.module.css';

interface CustomTimePickerProps {
  value: string; // 'HH:MM' (24-hour format)
  onChange: (time: string) => void;
  placeholder?: string;
  label?: string;
  className?: string;
}

export default function CustomTimePicker({
  value,
  onChange,
  placeholder = 'Select Preferred Time',
  label,
  className = '',
}: CustomTimePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<'hours' | 'minutes'>('hours');
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse initial 24h time into hours (0-23) and minutes (0-59)
  const parseTime = (timeStr: string) => {
    if (!timeStr) return { hour24: 9, minute: 0, period: 'AM' as const, hour12: 9 };
    const [h, m] = timeStr.split(':').map(Number);
    const hour24 = isNaN(h) ? 9 : h;
    const minute = isNaN(m) ? 0 : m;
    const period: 'AM' | 'PM' = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
    return { hour24, minute, period, hour12 };
  };

  const { hour24, minute, period, hour12 } = parseTime(value);

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

  const get24Hour = (h12: number, p: 'AM' | 'PM') => {
    if (h12 === 12) return p === 'AM' ? 0 : 12;
    return p === 'PM' ? h12 + 12 : h12;
  };

  const isHourDisabled = (h12: number, p: 'AM' | 'PM') => {
    const h24AM = get24Hour(h12, 'AM');
    const h24PM = get24Hour(h12, 'PM');
    const amValid = h24AM >= 8 && h24AM <= 20;
    const pmValid = h24PM >= 8 && h24PM <= 20;
    return !amValid && !pmValid;
  };

  const updateTime = (h12: number, min: number, p: 'AM' | 'PM') => {
    let targetP = p;
    let h24 = get24Hour(h12, p);

    // Auto-switch to PM if selecting 12, 1..7 while in AM mode
    if (p === 'AM' && (h12 === 12 || h12 < 8)) {
      targetP = 'PM';
      h24 = get24Hour(h12, 'PM');
    }

    // Clamp strictly to 8 AM (08:00) – 8 PM (20:00)
    if (h24 < 8) {
      h24 = 8;
      min = 0;
    } else if (h24 > 20 || (h24 === 20 && min > 0)) {
      h24 = 20;
      min = 0;
    }

    const hStr = String(h24).padStart(2, '0');
    const mStr = String(min).padStart(2, '0');
    onChange(`${hStr}:${mStr}`);
  };

  const handleHourSelect = (h12: number) => {
    let targetP = period;
    if (period === 'AM' && (h12 === 12 || h12 < 8)) {
      targetP = 'PM';
    }
    updateTime(h12, minute, targetP);
    setPickerMode('minutes');
  };

  const handleMinuteSelect = (min: number) => {
    updateTime(hour12, min, period);
  };

  const formatDisplay12 = (valStr: string) => {
    if (!valStr) return '';
    const { hour12, minute, period } = parseTime(valStr);
    const mStr = String(minute).padStart(2, '0');
    return `${String(hour12).padStart(2, '0')}:${mStr} ${period}`;
  };

  // Clock Hand Angles
  const hourHandDeg = (hour12 % 12) * 30 + (minute / 60) * 30;
  const minuteHandDeg = minute * 6;

  // Radial positions for 12 nodes (Radius = 72px)
  const hourNodes = Array.from({ length: 12 }, (_, i) => {
    const num = i === 0 ? 12 : i;
    const angleRad = ((num * 30 - 90) * Math.PI) / 180;
    const radius = 72;
    const x = 100 + radius * Math.cos(angleRad);
    const y = 100 + radius * Math.sin(angleRad);
    return { num, displayStr: String(num), x, y };
  });

  const minuteNodes = Array.from({ length: 12 }, (_, i) => {
    const minVal = i * 5;
    const posNum = i === 0 ? 12 : i;
    const angleRad = ((posNum * 30 - 90) * Math.PI) / 180;
    const radius = 72;
    const x = 100 + radius * Math.cos(angleRad);
    const y = 100 + radius * Math.sin(angleRad);
    return { minVal, displayStr: String(minVal).padStart(2, '0'), x, y };
  });

  const quickPresets = [
    { label: '🌅 08:00 AM', val: '08:00' },
    { label: '☀️ 11:00 AM', val: '11:00' },
    { label: '🌆 03:00 PM', val: '15:00' },
    { label: '🌙 07:00 PM', val: '19:00' },
    { label: '🌙 08:00 PM', val: '20:00' },
  ];

  return (
    <div ref={containerRef} className={`${styles.container} ${className}`}>
      {label && <label className={styles.label}>{label}</label>}

      <button
        type="button"
        className={`${styles.trigger} ${isOpen ? styles.triggerOpen : ''}`}
        onClick={() => setIsOpen(!isOpen)}
        aria-label="Pick a time"
      >
        <div className={styles.valueWrap}>
          {value ? (
            <span>{formatDisplay12(value)}</span>
          ) : (
            <span className={styles.placeholder}>{placeholder}</span>
          )}
        </div>
        <div className={styles.iconBadge}>
          <ClockIcon size={16} />
        </div>
      </button>

      {isOpen && (
        <div className={styles.popover}>
          {/* Digital Readout Header (Click Hour or Minute to switch modes!) */}
          <div className={styles.headerDisplay}>
            <div className={styles.digitalTime}>
              <span
                className={`${styles.timeUnit} ${pickerMode === 'hours' ? styles.timeUnitActive : ''}`}
                onClick={() => setPickerMode('hours')}
                title="Click to change hour"
              >
                {String(hour12).padStart(2, '0')}
              </span>
              <span className={styles.timeColon}>:</span>
              <span
                className={`${styles.timeUnit} ${pickerMode === 'minutes' ? styles.timeUnitActive : ''}`}
                onClick={() => setPickerMode('minutes')}
                title="Click to change minutes"
              >
                {String(minute).padStart(2, '0')}
              </span>
            </div>

            <div className={styles.ampmToggle}>
              <button
                type="button"
                className={`${styles.ampmBtn} ${period === 'AM' ? styles.ampmActive : ''}`}
                onClick={() => updateTime(hour12, minute, 'AM')}
              >
                AM
              </button>
              <button
                type="button"
                className={`${styles.ampmBtn} ${period === 'PM' ? styles.ampmActive : ''}`}
                onClick={() => updateTime(hour12, minute, 'PM')}
              >
                PM
              </button>
            </div>
          </div>

          {/* Service Hours Banner */}
          <div style={{ fontSize: '11px', fontWeight: 800, color: 'var(--primary)', marginBottom: '8px', textAlign: 'center', background: 'var(--primary-bg)', padding: '4px 8px', borderRadius: '999px' }}>
            ⏰ Slots Available: 8:00 AM – 8:00 PM
          </div>

          {/* Analog Clock Dial */}
          <div className={styles.clockDial}>
            <div className={styles.centerPin} />

            {/* Rotating Hour Hand */}
            <div
              className={styles.handHour}
              style={{ transform: `rotate(${hourHandDeg}deg)` }}
            />

            {/* Rotating Minute Hand */}
            <div
              className={styles.handMinute}
              style={{ transform: `rotate(${minuteHandDeg}deg)` }}
            />

            {/* Render Nodes depending on Mode */}
            {pickerMode === 'hours'
              ? hourNodes.map(({ num, displayStr, x, y }) => {
                  const isSelected = hour12 === num;
                  const disabled = isHourDisabled(num, period);
                  return (
                    <button
                      key={`h-${num}`}
                      type="button"
                      disabled={disabled}
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        opacity: disabled ? 0.3 : 1,
                        cursor: disabled ? 'not-allowed' : 'pointer'
                      }}
                      className={`${styles.clockNumber} ${isSelected ? styles.clockNumberActive : ''}`}
                      onClick={() => handleHourSelect(num)}
                    >
                      {displayStr}
                    </button>
                  );
                })
              : minuteNodes.map(({ minVal, displayStr, x, y }) => {
                  const isSelected = Math.abs(minute - minVal) < 3;
                  const disabled = hour24 === 20 && minVal > 0;
                  return (
                    <button
                      key={`m-${minVal}`}
                      type="button"
                      disabled={disabled}
                      style={{
                        left: `${x}px`,
                        top: `${y}px`,
                        opacity: disabled ? 0.3 : 1,
                        cursor: disabled ? 'not-allowed' : 'pointer'
                      }}
                      className={`${styles.clockNumber} ${isSelected ? styles.clockNumberActive : ''}`}
                      onClick={() => handleMinuteSelect(minVal)}
                    >
                      {displayStr}
                    </button>
                  );
                })}
          </div>

          {/* Minute Quick Buttons */}
          <div style={{ display: 'flex', gap: '6px', width: '100%', marginBottom: '10px' }}>
            {[0, 15, 30, 45].map((m) => {
              const disabled = hour24 === 20 && m > 0;
              return (
                <button
                  key={m}
                  type="button"
                  disabled={disabled}
                  style={{ opacity: disabled ? 0.4 : 1 }}
                  className={`${styles.presetPill} ${minute === m ? styles.presetActive : ''}`}
                  onClick={() => handleMinuteSelect(m)}
                >
                  :{String(m).padStart(2, '0')}
                </button>
              );
            })}
          </div>

          {/* Quick Presets Row */}
          <div className={styles.presetsRow}>
            {quickPresets.map((preset) => (
              <button
                key={preset.val}
                type="button"
                className={`${styles.presetPill} ${value === preset.val ? styles.presetActive : ''}`}
                onClick={() => {
                  onChange(preset.val);
                  setIsOpen(false);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
