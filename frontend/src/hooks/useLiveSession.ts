/**
 * useLiveSession Hook
 * 
 * Manages live edit session state and operations.
 * Provides all necessary methods for session lifecycle.
 */

import { useState, useCallback, useEffect } from 'react';
import { liveEditAPI, type StartSessionResponse, type EditPayload, type PreviewSummary } from '../api/liveEditAPI';

export interface LiveSessionState {
    sessionId: string | null;
    isActive: boolean;
    editableColumns: string[];
    rulesMap: Record<string, any[]>;
    expiresAt: string | null;
    editCount: number;
    isLoading: boolean;
    error: string | null;
}

export interface UseLiveSessionReturn {
    // State
    session: LiveSessionState;

    // Actions
    startSession: (mode?: 'full_table' | 'row_selection', rows?: number[]) => Promise<void>;
    endSession: () => Promise<void>;
    saveEdit: (edit: EditPayload) => Promise<boolean>;
    batchSave: (edits: EditPayload[]) => Promise<void>;
    preview: () => Promise<PreviewSummary | null>;
    submitCR: (title: string, description?: string, approvers?: string[]) => Promise<string | null>;

    // Helpers
    isColumnEditable: (column: string) => boolean;
    getColumnRules: (column: string) => any[];
    reset: () => void;
}

export function useLiveSession(
    datasetId: string,
    userId: string = 'user_001' // TODO: Get from auth context
): UseLiveSessionReturn {
    const [session, setSession] = useState<LiveSessionState>({
        sessionId: null,
        isActive: false,
        editableColumns: [],
        rulesMap: {},
        expiresAt: null,
        editCount: 0,
        isLoading: false,
        error: null,
    });

    /**
     * Start a new live edit session
     */
    const startSession = useCallback(async (
        mode: 'full_table' | 'row_selection' = 'full_table',
        rows: number[] = []
    ) => {
        setSession(prev => ({ ...prev, isLoading: true, error: null }));

        try {
            const response = await liveEditAPI.startSession(datasetId, {
                user_id: userId,
                mode,
                rows,
            });

            setSession({
                sessionId: response.session_id,
                isActive: true,
                editableColumns: response.editable_columns,
                rulesMap: response.rules_map,
                expiresAt: response.expires_at,
                editCount: 0,
                isLoading: false,
                error: null,
            });

            // Store session ID in localStorage for recovery
            localStorage.setItem(`live_session_${datasetId}`, response.session_id);

            console.log('[LiveSession] Started:', response.session_id);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to start session';
            setSession(prev => ({ ...prev, isLoading: false, error: message }));
            throw error;
        }
    }, [datasetId, userId]);

    /**
     * End the current session
     */
    const endSession = useCallback(async () => {
        if (!session.sessionId) return;

        setSession(prev => ({ ...prev, isLoading: true }));

        try {
            await liveEditAPI.abortSession(datasetId, session.sessionId);

            // Clear localStorage
            localStorage.removeItem(`live_session_${datasetId}`);

            setSession({
                sessionId: null,
                isActive: false,
                editableColumns: [],
                rulesMap: {},
                expiresAt: null,
                editCount: 0,
                isLoading: false,
                error: null,
            });

            console.log('[LiveSession] Ended');
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to end session';
            setSession(prev => ({ ...prev, isLoading: false, error: message }));
            throw error;
        }
    }, [datasetId, session.sessionId]);

    /**
     * Save a single cell edit
     */
    const saveEdit = useCallback(async (edit: EditPayload): Promise<boolean> => {
        if (!session.sessionId) {
            console.error('[LiveSession] No active session');
            return false;
        }

        try {
            const response = await liveEditAPI.saveEdit(datasetId, session.sessionId, {
                ...edit,
                client_ts: new Date().toISOString(),
            });

            if (response.status === 'ok') {
                setSession(prev => ({
                    ...prev,
                    editCount: prev.editCount + 1,
                }));
                return true;
            } else {
                // Validation failed
                console.warn('[LiveSession] Edit validation failed:', response.validation);
                return false;
            }
        } catch (error) {
            console.error('[LiveSession] Save edit failed:', error);
            return false;
        }
    }, [datasetId, session.sessionId]);

    /**
     * Save multiple edits in batch
     */
    const batchSave = useCallback(async (edits: EditPayload[]) => {
        if (!session.sessionId) {
            console.error('[LiveSession] No active session');
            return;
        }

        try {
            const response = await liveEditAPI.batchSaveEdits(datasetId, session.sessionId, edits);

            const successCount = response.results.filter(r => r.valid).length;

            setSession(prev => ({
                ...prev,
                editCount: prev.editCount + successCount,
            }));

            console.log(`[LiveSession] Batch saved ${successCount}/${edits.length} edits`);
        } catch (error) {
            console.error('[LiveSession] Batch save failed:', error);
            throw error;
        }
    }, [datasetId, session.sessionId]);

    /**
     * Generate preview summary
     */
    const preview = useCallback(async (): Promise<PreviewSummary | null> => {
        if (!session.sessionId) {
            console.error('[LiveSession] No active session');
            return null;
        }

        try {
            const previewData = await liveEditAPI.preview(datasetId, session.sessionId);
            console.log('[LiveSession] Preview generated:', previewData);
            return previewData;
        } catch (error) {
            console.error('[LiveSession] Preview failed:', error);
            return null;
        }
    }, [datasetId, session.sessionId]);

    /**
     * Submit change request
     */
    const submitCR = useCallback(async (
        title: string,
        description: string = '',
        approvers: string[] = []
    ): Promise<string | null> => {
        if (!session.sessionId) {
            console.error('[LiveSession] No active session');
            return null;
        }

        try {
            const response = await liveEditAPI.submitChangeRequest(datasetId, {
                session_id: session.sessionId,
                title,
                description,
                approvers,
                notify: true,
            });

            console.log('[LiveSession] CR submitted:', response.change_request_id);

            // Mark session as submitted
            setSession(prev => ({
                ...prev,
                isActive: false,
            }));

            return response.change_request_id;
        } catch (error) {
            console.error('[LiveSession] Submit CR failed:', error);
            return null;
        }
    }, [datasetId, session.sessionId]);

    /**
     * Check if a column is editable
     */
    const isColumnEditable = useCallback((column: string): boolean => {
        return session.editableColumns.includes(column);
    }, [session.editableColumns]);

    /**
     * Get rules for a column
     */
    const getColumnRules = useCallback((column: string): any[] => {
        return session.rulesMap[column] || [];
    }, [session.rulesMap]);

    /**
     * Reset session state
     */
    const reset = useCallback(() => {
        setSession({
            sessionId: null,
            isActive: false,
            editableColumns: [],
            rulesMap: {},
            expiresAt: null,
            editCount: 0,
            isLoading: false,
            error: null,
        });
    }, []);

    /**
     * Auto-recover session from localStorage on mount
     */
    useEffect(() => {
        const savedSessionId = localStorage.getItem(`live_session_${datasetId}`);
        if (savedSessionId) {
            console.log('[LiveSession] Found saved session, attempting recovery:', savedSessionId);
            // TODO: Fetch session details from API to restore state
        }
    }, [datasetId]);

    /**
     * Show warning before session expires
     */
    useEffect(() => {
        if (!session.expiresAt) return;

        const expiryTime = new Date(session.expiresAt).getTime();
        const now = Date.now();
        const timeUntilExpiry = expiryTime - now;

        // Warn 5 minutes before expiry
        const warningTime = timeUntilExpiry - (5 * 60 * 1000);

        if (warningTime > 0) {
            const timer = setTimeout(() => {
                console.warn('[LiveSession] Session will expire in 5 minutes!');
                // TODO: Show toast notification
            }, warningTime);

            return () => clearTimeout(timer);
        }
    }, [session.expiresAt]);

    return {
        session,
        startSession,
        endSession,
        saveEdit,
        batchSave,
        preview,
        submitCR,
        isColumnEditable,
        getColumnRules,
        reset,
    };
}
