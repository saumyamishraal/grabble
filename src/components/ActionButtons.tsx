import React from 'react';

interface ActionButtonsProps {
  canSubmit: boolean;
  onSubmit: () => void;
  onSwap: () => void;
  canSwap: boolean;
  recognizedWords: string[];
  hasWordSelected: boolean;
  onClearSelection?: () => void;
  selectedTilesCount?: number;
  // Hint props
  onHint?: () => void;
  hintLevel?: number;
  canHint?: boolean;
  hintMessage?: string;
}

const ActionButtons: React.FC<ActionButtonsProps> = ({
  canSubmit,
  onSubmit,
  onSwap,
  canSwap,
  recognizedWords,
  hasWordSelected,
  onClearSelection,
  selectedTilesCount = 0,
  onHint,
  hintLevel = 0,
  canHint = true,
  hintMessage
}) => {
  const getHintButtonText = () => {
    if (hintLevel === 0) return '💡 Hint';
    if (hintLevel >= 4) return '💡 Full Solution';
    return `💡 Hint (${hintLevel}/4)`;
  };

  return (
    <div className="action-buttons">
      {recognizedWords.length > 0 && (
        <div className="recognized-words">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label>Selected Words:</label>
            {onClearSelection && (
              <button
                className="btn-clear-selection"
                onClick={onClearSelection}
                title="Clear selection"
                type="button"
              >
                Clear
              </button>
            )}
          </div>
          <div className="words-display">
            {recognizedWords.join(', ').toUpperCase()}
          </div>
        </div>
      )}

      {/* Hint message display */}
      {hintMessage && (
        <div className="hint-message">
          {hintMessage}
        </div>
      )}

      <div className="action-buttons-row">
        <button
          className="btn btn-primary"
          onClick={onSubmit}
          disabled={!canSubmit || !hasWordSelected}
        >
          Submit Move
        </button>
        <button
          className="btn btn-secondary"
          onClick={onSwap}
          disabled={!canSwap}
          title={canSwap ? `Swap ${selectedTilesCount} selected tile${selectedTilesCount !== 1 ? 's' : ''}` : 'Select tiles to swap'}
        >
          Swap Tiles {selectedTilesCount > 0 ? `(${selectedTilesCount})` : ''}
        </button>
        {onHint && (
          <button
            className={`btn btn-hint ${hintLevel > 0 ? 'hint-active' : ''}`}
            onClick={onHint}
            disabled={!canHint}
            title={hintLevel === 0 ? 'Get a hint' : `Click for more detail (level ${hintLevel + 1})`}
          >
            {getHintButtonText()}
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionButtons;
