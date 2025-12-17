import React, { useState, useEffect } from 'react';

interface BlankTileModalProps {
  isOpen: boolean;
  position: { x: number; y: number } | null;
  currentLetter: string;
  onConfirm: (letter: string) => void;
  onCancel: () => void;
}

const BlankTileModal: React.FC<BlankTileModalProps> = ({ 
  isOpen, 
  position,
  currentLetter,
  onConfirm, 
  onCancel 
}) => {
  const [letter, setLetter] = useState(currentLetter || '');

  useEffect(() => {
    if (isOpen) {
      setLetter(currentLetter || '');
    }
  }, [isOpen, currentLetter]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const upperLetter = letter.toUpperCase().trim();
    if (upperLetter.length === 1 && /[A-Z]/.test(upperLetter)) {
      onConfirm(upperLetter);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSubmit(e);
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="modal show" onClick={onCancel}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>Enter Letter for Blank Tile</h2>
        <p style={{ marginBottom: '1rem', color: '#666' }}>
          What letter should this blank tile represent?
        </p>
        
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Letter:</label>
            <input
              type="text"
              value={letter}
              onChange={(e) => {
                const val = e.target.value.toUpperCase().trim();
                if (val.length <= 1 && /^[A-Z]?$/.test(val)) {
                  setLetter(val);
                }
              }}
              onKeyDown={handleKeyDown}
              autoFocus
              maxLength={1}
              style={{ 
                fontSize: '2rem', 
                textAlign: 'center',
                textTransform: 'uppercase',
                fontWeight: 'bold'
              }}
              required
            />
          </div>
          
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={!letter || letter.length !== 1 || !/[A-Z]/.test(letter)}
              style={{ flex: 1 }}
            >
              Confirm
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BlankTileModal;

