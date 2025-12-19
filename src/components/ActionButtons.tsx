import React from 'react';
import { UI_MESSAGES } from '../constants/messages';

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
    if (hintLevel === 0) return UI_MESSAGES.buttons.hint;
    if (hintLevel >= 4) return UI_MESSAGES.buttons.hintFullSolution;
    return UI_MESSAGES.buttons.hintWithLevel(hintLevel);
  };

  return (
    <div className="action-buttons">
      {recognizedWords.length > 0 && (
        <div className="recognized-words">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <label>{UI_MESSAGES.actions.selectedWords}</label>
            {onClearSelection && (
              <button
                className="btn-clear-selection"
                onClick={onClearSelection}
                title={UI_MESSAGES.buttons.clearSelection}
                type="button"
              >
                {UI_MESSAGES.buttons.clear}
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
          {UI_MESSAGES.buttons.submitMove}
        </button>
        <button
          className="btn btn-secondary"
          onClick={onSwap}
          disabled={!canSwap}
          title={UI_MESSAGES.buttons.swapTilesTooltip(selectedTilesCount)}
        >
          {UI_MESSAGES.buttons.swapTilesWithCount(selectedTilesCount)}
        </button>
        {onHint && (
          <button
            className={`btn btn-hint ${hintLevel > 0 ? 'hint-active' : ''}`}
            onClick={onHint}
            disabled={!canHint}
            title={UI_MESSAGES.buttons.hintTooltip(hintLevel)}
          >
            {getHintButtonText()}
          </button>
        )}
      </div>
    </div>
  );
};

export default ActionButtons;
