import React from 'react';
import { UI_MESSAGES } from '../constants/messages';

interface ErrorModalProps {
  isOpen: boolean;
  message: string;
  onClose: () => void;
}

const ErrorModal: React.FC<ErrorModalProps> = ({ isOpen, message, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="modal show" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2 style={{ color: '#d32f2f', marginBottom: '1rem' }}>{UI_MESSAGES.errors.error}</h2>
        <p style={{ marginBottom: '1.5rem', color: '#333' }}>{message}</p>
        <button
          className="btn btn-primary"
          onClick={onClose}
          style={{ width: '100%' }}
        >
          {UI_MESSAGES.buttons.ok}
        </button>
      </div>
    </div>
  );
};

export default ErrorModal;

