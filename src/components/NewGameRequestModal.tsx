import React, { useEffect, useState } from 'react';
import { UI_MESSAGES } from '../constants/messages';

interface NewGameRequestModalProps {
  isOpen: boolean;
  mode: 'request_sent' | 'request_received' | 'declined' | null;
  requesterName?: string;
  declinedPlayerName?: string;
  onAccept?: () => void;
  onDecline?: () => void;
  onClose?: () => void;
}

const NewGameRequestModal: React.FC<NewGameRequestModalProps> = ({
  isOpen,
  mode,
  requesterName,
  declinedPlayerName,
  onAccept,
  onDecline,
  onClose
}) => {
  const [autoCloseTimer, setAutoCloseTimer] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (mode === 'declined' && isOpen) {
      // Auto-close declined notification after 3 seconds
      const timer = setTimeout(() => {
        if (onClose) onClose();
      }, 3000);
      setAutoCloseTimer(timer);
      return () => {
        if (timer) clearTimeout(timer);
      };
    } else {
      if (autoCloseTimer) {
        clearTimeout(autoCloseTimer);
        setAutoCloseTimer(null);
      }
    }
  }, [mode, isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className="modal show" onClick={mode === 'declined' ? onClose : undefined}>
      <div className="modal-content new-game-request-modal" onClick={(e) => e.stopPropagation()}>
        {mode === 'request_sent' && (
          <>
            <h2>{UI_MESSAGES.newGameRequest.requestSent}</h2>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
              {UI_MESSAGES.newGameRequest.waitingForAcceptance}
            </p>
            <button className="btn btn-secondary" onClick={onClose}>
              {UI_MESSAGES.buttons.close}
            </button>
          </>
        )}

        {mode === 'request_received' && (
          <>
            <h2>{UI_MESSAGES.newGameRequest.title}</h2>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
              {UI_MESSAGES.newGameRequest.requestMessage(requesterName || '')}
            </p>
            <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
              <button className="btn btn-primary" onClick={onAccept}>
                {UI_MESSAGES.buttons.accept}
              </button>
              <button className="btn btn-secondary" onClick={onDecline}>
                {UI_MESSAGES.buttons.decline}
              </button>
            </div>
          </>
        )}

        {mode === 'declined' && (
          <>
            <h2 style={{ color: '#d32f2f' }}>{UI_MESSAGES.newGameRequest.requestDeclined}</h2>
            <p style={{ marginBottom: '1.5rem', color: '#666' }}>
              {UI_MESSAGES.newGameRequest.declinedMessage(declinedPlayerName || '')}
            </p>
            <button className="btn btn-primary" onClick={onClose}>
              {UI_MESSAGES.buttons.ok}
            </button>
          </>
        )}
      </div>
    </div>
  );
};

export default NewGameRequestModal;

