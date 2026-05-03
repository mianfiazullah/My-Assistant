import React from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

interface CustomDatePickerProps {
  selected: string | null;
  onChange: (date: string) => void;
  placeholder?: string;
  className?: string;
  maxDate?: Date;
  disabled?: boolean;
}

export const CustomDatePicker: React.FC<CustomDatePickerProps> = ({
  selected,
  onChange,
  placeholder = "Select date",
  className,
  maxDate,
  disabled
}) => {
  const dateValue = selected ? new Date(selected) : null;

  return (
    <div className="relative w-full">
      <DatePicker
        selected={dateValue && !isNaN(dateValue.getTime()) ? dateValue : null}
        onChange={(date: Date | null) => {
          if (date) {
            // Format to YYYY-MM-DD to maintain consistency with existing state
            const formattedDate = date.toISOString().split('T')[0];
            onChange(formattedDate);
          } else {
            onChange('');
          }
        }}
        placeholderText={placeholder}
        maxDate={maxDate}
        disabled={disabled}
        dateFormat="yyyy-MM-dd"
        className={cn(
          "w-full bg-white border border-neutral-200 rounded-xl py-2.5 px-3 pl-10 focus:outline-none focus:border-indigo-500 transition-all text-sm",
          disabled && "opacity-50 cursor-not-allowed bg-neutral-50",
          className
        )}
        wrapperClassName="w-full"
      />
      <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 pointer-events-none" />
    </div>
  );
};
