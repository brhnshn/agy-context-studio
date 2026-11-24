import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { CheckIcon, ChevronDownIcon } from '../utils/icons.js';

export interface CustomSelectOption {
  value: string;
  label: string;
  meta?: string;
}

interface CustomSelectProps {
  id?: string;
  ariaLabel: string;
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  mono?: boolean;
  align?: 'left' | 'right';
}

export function CustomSelect({
  id,
  ariaLabel,
  value,
  options,
  onChange,
  mono = false,
  align = 'left'
}: CustomSelectProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(() =>
    Math.max(0, options.findIndex((opt) => opt.value === value))
  );
  const rootRef = useRef<HTMLDivElement | null>(null);
  const generatedId = useId();
  const listboxId = `${id ?? generatedId}-listbox`;

  useEffect(() => {
    if (!open) {
      return;
    }
    const idx = options.findIndex((opt) => opt.value === value);
    if (idx >= 0) {
      setActiveIndex(idx);
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open, options, value]);

  const selected = options.find((opt) => opt.value === value) ?? options[0];

  const handleSelect = (nextValue: string) => {
    onChange(nextValue);
    setOpen(false);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (options.length === 0) {
      return;
    }
    if (event.key === 'Escape') {
      if (open) {
        event.preventDefault();
        setOpen(false);
      }
      return;
    }
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setActiveIndex((prev) => (prev + 1) % options.length);
      }
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) {
        setOpen(true);
      } else {
        setActiveIndex((prev) => (prev - 1 + options.length) % options.length);
      }
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      if (open) {
        event.preventDefault();
        const opt = options[activeIndex];
        if (opt) {
          handleSelect(opt.value);
        }
      }
    }
  };

  return (
    <div ref={rootRef} className="cs-cselect">
      <button
        id={id}
        type="button"
        className={`cs-cselect-trigger ${mono ? 'is-mono' : ''} ${open ? 'is-open' : ''}`}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen((prev) => !prev)}
        onKeyDown={handleKeyDown}
      >
        <span className="cs-cselect-value">{selected?.label ?? '-'}</span>
        <ChevronDownIcon className="cs-cselect-chevron" />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={`cs-cselect-menu ${align === 'right' ? 'is-right' : 'is-left'}`}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isActive = idx === activeIndex;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                className={`cs-cselect-option ${mono ? 'is-mono' : ''} ${isSelected ? 'is-selected' : ''} ${isActive ? 'is-active' : ''}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => handleSelect(option.value)}
              >
                <span className="cs-cselect-check">
                  {isSelected && <CheckIcon />}
                </span>
                <span className="cs-cselect-opt-label">{option.label}</span>
                {option.meta && <span className="cs-cselect-opt-meta">{option.meta}</span>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
