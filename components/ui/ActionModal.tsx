import React from 'react';
import { X } from 'lucide-react';

interface ActionModalProps {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidthClass?: string;
  bodyClassName?: string;
  closeOnBackdrop?: boolean;
}

const ActionModal: React.FC<ActionModalProps> = ({
  title,
  subtitle,
  onClose,
  children,
  footer,
  maxWidthClass = 'max-w-md',
  bodyClassName = 'p-5 max-h-[72vh] overflow-y-auto',
  closeOnBackdrop = true
}) => {
  const handleBackdropMouseDown = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!closeOnBackdrop) return;
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-slate-900/55 backdrop-blur-[2px] z-[70] flex items-center justify-center p-4 animate-fade-in"
      onMouseDown={handleBackdropMouseDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`w-full ${maxWidthClass} rounded-2xl border border-slate-100 bg-white shadow-2xl overflow-hidden animate-slide-up`}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-100 bg-white flex items-start justify-between gap-3">
          <div>
            <h3 className="text-lg font-extrabold text-slate-800 leading-tight">{title}</h3>
            {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-700 flex items-center justify-center transition"
            aria-label="Fechar modal"
          >
            <X size={18} />
          </button>
        </div>

        <div className={bodyClassName}>{children}</div>

        {footer && <div className="px-5 py-4 border-t border-slate-100 bg-slate-50/70">{footer}</div>}
      </div>
    </div>
  );
};

export default ActionModal;
