# How to Run Grabble React UI

## Development Mode

1. **Navigate to the React UI directory**:
   ```bash
   cd react-ui
   ```

2. **Install dependencies** (first time only):
   ```bash
   npm install
   ```

3. **Add dictionary file** (optional):
   - Create `public/dictionary.txt` with one word per line
   - If missing, it will use a fallback dictionary

4. **Start the development server**:
   ```bash
   npm start
   ```
   This will:
   - Start a dev server at http://localhost:3000
   - Automatically reload when you make changes
   - Show helpful error messages

## Production Build

1. **Build the app**:
   ```bash
   npm run build
   ```

2. **Serve the build**:
   ```bash
   npx serve -s build
   ```
   Or use any static file server

## Why React?

React makes the UI much easier to work with:
- **Components**: Each UI piece is a separate component
- **State Management**: React hooks handle state automatically
- **Re-rendering**: UI updates automatically when state changes
- **Type Safety**: Full TypeScript support
- **Developer Experience**: Hot reload, error messages, etc.

## File Structure

- `src/App.tsx` - Main app component with game logic
- `src/components/` - All UI components
- `src/game-engine/` - Core game logic (shared)
- `public/dictionary.txt` - Word dictionary file

## Next Steps

- Modify components in `src/components/` to change the UI
- Update `src/App.tsx` to change game flow
- Add new features easily with React components

