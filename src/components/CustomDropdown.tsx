import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

export interface DropdownOption<T> {
  value: T;
  label: string;
  desc?: string;
}

interface CustomDropdownProps<T> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
  width?: string;
}

export function CustomDropdown<T extends string | number>({
  options,
  value,
  onChange,
  className = '',
  width = 'w-64',
}: CustomDropdownProps<T>) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (val: T) => {
    onChange(val);
    setIsOpen(false);
  };

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Trigger Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center justify-between gap-2.5 px-3 py-1.5 bg-[#141418] hover:bg-[#1c1c22] border border-[#27272e] hover:border-zinc-500 rounded-lg text-xs font-medium text-zinc-100 transition shadow-sm focus:outline-none focus:border-emerald-500"
      >
        <span className="truncate">{selectedOption?.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-zinc-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-emerald-400' : ''
          }`}
        />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div
          className={`absolute right-0 mt-1.5 ${width} bg-[#111114] border border-[#27272e] rounded-xl shadow-2xl p-1 z-50 animate-in fade-in zoom-in-95 duration-100`}
        >
          <div className="space-y-0.5">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={String(option.value)}
                  type="button"
                  onClick={() => handleSelect(option.value)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition text-left ${
                    isSelected
                      ? 'bg-emerald-600/15 text-emerald-300 font-semibold border border-emerald-500/30'
                      : 'text-zinc-300 hover:text-white hover:bg-zinc-800/60'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{option.label}</span>
                    {option.desc && (
                      <span className="text-[11px] text-zinc-500 mt-0.5">
                        {option.desc}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0 ml-2" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
