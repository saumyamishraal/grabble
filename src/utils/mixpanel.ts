import mixpanel from 'mixpanel-browser';

// Track Error event
export const trackError = (
  errorType: string,
  errorMessage: string,
  errorCode?: string,
  pageUrl?: string
) => {
  mixpanel.track('Error', {
    error_type: errorType,
    error_message: errorMessage,
    error_code: errorCode || '',
    page_url: pageUrl || window.location.href,
  });
};

// Track Page View event
export const trackPageView = (pageTitle?: string) => {
  mixpanel.track('Page View', {
    page_url: window.location.href,
    page_title: pageTitle || document.title,
  });
};

// Track game-specific events
export const trackGameStarted = (gameMode: 'local' | 'multiplayer', numPlayers: number) => {
  mixpanel.track('Conversion', {
    'Conversion Type': 'Game Started',
    game_mode: gameMode,
    num_players: numPlayers,
  });
};

export const trackWordSubmitted = (wordCount: number, totalScore: number) => {
  mixpanel.track('Conversion', {
    'Conversion Type': 'Word Submitted',
    word_count: wordCount,
    total_score: totalScore,
  });
};

export const trackRoomCreated = (roomCode: string) => {
  mixpanel.track('Page View', {
    page_url: window.location.href,
    page_title: 'Room Created',
    room_code: roomCode,
  });
};

export const trackRoomJoined = (roomCode: string) => {
  mixpanel.track('Page View', {
    page_url: window.location.href,
    page_title: 'Room Joined',
    room_code: roomCode,
  });
};

