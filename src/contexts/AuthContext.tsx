/**
 * Auth Context for Google Sign-In
 * Provides user state and sign-in/sign-out functions throughout the app
 */

import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { auth, googleProvider, signInWithPopup, firebaseSignOut, onAuthStateChanged, User } from '../firebase';

interface AuthContextType {
    user: User | null;
    loading: boolean;
    signIn: () => Promise<void>;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    // Listen to auth state changes
    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            setLoading(false);
            if (currentUser) {
                console.log('🔐 Signed in as:', currentUser.displayName);
            } else {
                console.log('🔓 Not signed in');
            }
        });

        return () => unsubscribe();
    }, []);

    const signIn = async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            console.log('✅ Sign in successful:', result.user.displayName);
        } catch (error: any) {
            console.error('❌ Sign in error:', error.message);
            throw error;
        }
    };

    const signOut = async () => {
        try {
            await firebaseSignOut(auth);
            console.log('👋 Signed out');
        } catch (error: any) {
            console.error('❌ Sign out error:', error.message);
            throw error;
        }
    };

    const value: AuthContextType = {
        user,
        loading,
        signIn,
        signOut,
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom hook to use auth context
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export default AuthContext;
