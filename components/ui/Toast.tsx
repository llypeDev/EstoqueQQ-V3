import React, { useEffect } from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';
import { ToastMessage } from '../../types';

interface ToastProps {
  toasts: ToastMessage[];
  removeToast: (id: number) => void;
}

const Toast: React.FC<ToastProps> = ({ toasts, removeToast }) => {
  return (
    <div className="fixed top-4 left-0 right-0 z-[100] flex flex-col items-center gap-2 pointer-events-none px-4">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`
            pointer-events-auto flex items-center p-4 rounded-xl shadow-lg border w-full max-w-sm animate-fade-in
            ${toast.type === 'success' ? 'bg-white border-green-200 text-green-700' : ''}
            ${toast.type === 'error' ? 'bg-white border-red-200 text-red-700' : ''}
            ${toast.type === 'info' ? 'bg-white border-blue-200 text-blue-700' : ''}
          `}
        >
          <div className="mr-3">
            {toast.type === 'success' && <CheckCircle size={20} />}
            {toast.type === 'error' && <AlertCircle size={20} />}
            {toast.type === 'info' && <Info size={20} />}
          </div>
          <p className="flex-1 text-sm font-medium">{toast.text}</p>
          <button onClick={() => removeToast(toast.id)} className="ml-2 opacity-50 hover:opacity-100">
            <X size={16} />
          </button>
        </div>
      ))}
    </div>
  );
};

export default Toast;