/**
 * useHighScore Hook
 * Manages high scores with local storage for anonymous users
 * and Firebase sync for signed-in users
 */

import { useState, useEffect, useCallback } from 'react';
import { database, ref, get, set, dbPaths } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

const LOCAL_STORAGE_KEY = 'grabble-high-score';

export const useHighScore = () => {
    const { user } = useAuth();
    const [highScore, setHighScore] = useState<number>(0);
    const [loading, setLoading] = useState(true);

    // Load high score from appropriate source
    useEffect(() => {
        const loadHighScore = async () => {
            setLoading(true);

            // Get local storage score
            const localScore = parseInt(localStorage.getItem(LOCAL_STORAGE_KEY) || '0', 10);

            if (user) {
                // User is signed in - sync with Firebase
                try {
                    const scoreRef = ref(database, dbPaths.userHighScore(user.uid));
                    const snapshot = await get(scoreRef);
                    const cloudScore = snapshot.exists() ? snapshot.val() : 0;

                    // Use the higher of local or cloud score
                    const bestScore = Math.max(localScore, cloudScore);

                    // If local has higher score, sync to cloud
                    if (localScore > cloudScore) {
                        await set(scoreRef, localScore);
                        console.log('📤 Synced local high score to cloud:', localScore);
                    }

                    setHighScore(bestScore);
                    console.log('☁️ Loaded high score:', bestScore, '(local:', localScore, 'cloud:', cloudScore, ')');
                } catch (error) {
                    console.error('Failed to load cloud high score:', error);
                    setHighScore(localScore);
                }
            } else {
                // Anonymous user - use local storage
                setHighScore(localScore);
                console.log('💾 Loaded local high score:', localScore);
            }

            setLoading(false);
        };

        loadHighScore();
    }, [user]);

    // Update high score if new score is better
    const updateHighScore = useCallback(async (newScore: number): Promise<boolean> => {
        if (newScore <= highScore) {
            return false;
        }

        // Update local storage
        localStorage.setItem(LOCAL_STORAGE_KEY, newScore.toString());
        setHighScore(newScore);

        // Sync to cloud if signed in
        if (user) {
            try {
                const scoreRef = ref(database, dbPaths.userHighScore(user.uid));
                await set(scoreRef, newScore);
                console.log('📤 New high score synced to cloud:', newScore);
            } catch (error) {
                console.error('Failed to sync high score to cloud:', error);
            }
        } else {
            console.log('💾 New high score saved locally:', newScore);
        }

        return true;
    }, [highScore, user]);

    // Get high score (for read-only access)
    const getHighScore = useCallback((): number => {
        return highScore;
    }, [highScore]);

    return {
        highScore,
        loading,
        updateHighScore,
        getHighScore,
    };
};

export default useHighScore;
