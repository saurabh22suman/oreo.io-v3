/**
 * useEdits Hook
 * 
 * Manages local edits store for optimistic UI updates.
 * Uses Zustand for efficient state management.
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

export interface CellEdit {
    sessionId: string;
    rowId: string;
    column: string;
    oldValue: any;
    newValue: any;
    clientTs: string;
    isValid: boolean;
    validationMessages: string[];
    severity?: 'info' | 'warning' | 'error' | 'fatal';
}

interface EditsState {
    // State
    edits: Map<string, CellEdit>; // key: sessionId:rowId:column
    sessionEdits: Map<string, Set<string>>; // sessionId -> Set<editKeys>

    // Actions
    addEdit: (edit: CellEdit) => void;
    removeEdit: (sessionId: string, rowId: string, column: string) => void;
    clearSession: (sessionId: string) => void;
    getEdit: (sessionId: string, rowId: string, column: string) => CellEdit | undefined;
    getRowEdits: (sessionId: string, rowId: string) => CellEdit[];
    getSessionEdits: (sessionId: string) => CellEdit[];
    hasEdit: (sessionId: string, rowId: string, column: string) => boolean;
    getEditCount: (sessionId: string) => number;
    getInvalidEdits: (sessionId: string) => CellEdit[];
}

const makeKey = (sessionId: string, rowId: string, column: string) =>
    `${sessionId}:${rowId}:${column}`;

export const useEditsStore = create<EditsState>()(
    devtools(
        (set, get) => ({
            edits: new Map(),
            sessionEdits: new Map(),

            addEdit: (edit: CellEdit) => {
                const key = makeKey(edit.sessionId, edit.rowId, edit.column);

                set((state) => {
                    const newEdits = new Map(state.edits);
                    newEdits.set(key, edit);

                    const newSessionEdits = new Map(state.sessionEdits);
                    const sessionSet = newSessionEdits.get(edit.sessionId) || new Set();
                    sessionSet.add(key);
                    newSessionEdits.set(edit.sessionId, sessionSet);

                    return {
                        edits: newEdits,
                        sessionEdits: newSessionEdits,
                    };
                });
            },

            removeEdit: (sessionId: string, rowId: string, column: string) => {
                const key = makeKey(sessionId, rowId, column);

                set((state) => {
                    const newEdits = new Map(state.edits);
                    newEdits.delete(key);

                    const newSessionEdits = new Map(state.sessionEdits);
                    const sessionSet = newSessionEdits.get(sessionId);
                    if (sessionSet) {
                        sessionSet.delete(key);
                        if (sessionSet.size === 0) {
                            newSessionEdits.delete(sessionId);
                        }
                    }

                    return {
                        edits: newEdits,
                        sessionEdits: newSessionEdits,
                    };
                });
            },

            clearSession: (sessionId: string) => {
                set((state) => {
                    const sessionSet = state.sessionEdits.get(sessionId);
                    if (!sessionSet) return state;

                    const newEdits = new Map(state.edits);
                    sessionSet.forEach(key => newEdits.delete(key));

                    const newSessionEdits = new Map(state.sessionEdits);
                    newSessionEdits.delete(sessionId);

                    return {
                        edits: newEdits,
                        sessionEdits: newSessionEdits,
                    };
                });
            },

            getEdit: (sessionId: string, rowId: string, column: string) => {
                const key = makeKey(sessionId, rowId, column);
                return get().edits.get(key);
            },

            getRowEdits: (sessionId: string, rowId: string) => {
                const state = get();
                const edits: CellEdit[] = [];

                state.edits.forEach((edit, key) => {
                    if (edit.sessionId === sessionId && edit.rowId === rowId) {
                        edits.push(edit);
                    }
                });

                return edits;
            },

            getSessionEdits: (sessionId: string) => {
                const state = get();
                const sessionSet = state.sessionEdits.get(sessionId);
                if (!sessionSet) return [];

                const edits: CellEdit[] = [];
                sessionSet.forEach(key => {
                    const edit = state.edits.get(key);
                    if (edit) edits.push(edit);
                });

                return edits;
            },

            hasEdit: (sessionId: string, rowId: string, column: string) => {
                const key = makeKey(sessionId, rowId, column);
                return get().edits.has(key);
            },

            getEditCount: (sessionId: string) => {
                const sessionSet = get().sessionEdits.get(sessionId);
                return sessionSet ? sessionSet.size : 0;
            },

            getInvalidEdits: (sessionId: string) => {
                return get().getSessionEdits(sessionId).filter(edit => !edit.isValid);
            },
        }),
        { name: 'EditsStore' }
    )
);

/**
 * Hook for accessing edits store
 */
export function useEdits(sessionId: string | null) {
    const store = useEditsStore();

    if (!sessionId) {
        return {
            edits: [],
            editCount: 0,
            invalidEdits: [],
            addEdit: () => { },
            removeEdit: () => { },
            clearSession: () => { },
            getEdit: () => undefined,
            getRowEdits: () => [],
            hasEdit: () => false,
        };
    }

    return {
        edits: store.getSessionEdits(sessionId),
        editCount: store.getEditCount(sessionId),
        invalidEdits: store.getInvalidEdits(sessionId),
        addEdit: store.addEdit,
        removeEdit: (rowId: string, column: string) => store.removeEdit(sessionId, rowId, column),
        clearSession: () => store.clearSession(sessionId),
        getEdit: (rowId: string, column: string) => store.getEdit(sessionId, rowId, column),
        getRowEdits: (rowId: string) => store.getRowEdits(sessionId, rowId),
        hasEdit: (rowId: string, column: string) => store.hasEdit(sessionId, rowId, column),
    };
}
