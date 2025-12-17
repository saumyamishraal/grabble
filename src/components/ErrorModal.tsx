import React from 'react';

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
        <h2 style={{ color: '#d32f2f', marginBottom: '1rem' }}>Error</h2>
        <p style={{ marginBottom: '1.5rem', color: '#333' }}>{message}</p>
        <button
          className="btn btn-primary"
          onClick={onClose}
          style={{ width: '100%' }}
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default ErrorModal;

