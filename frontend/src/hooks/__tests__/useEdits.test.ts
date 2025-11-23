/**
 * Tests for useEdits hook and store
 */

import { renderHook, act } from '@testing-library/react';
import { useEdits, useEditsStore } from '../useEdits';
import type { CellEdit } from '../useEdits';

describe('useEdits', () => {
    beforeEach(() => {
        // Reset store before each test
        act(() => {
            useEditsStore.getState().edits.clear();
            useEditsStore.getState().sessionEdits.clear();
        });
    });

    describe('addEdit', () => {
        it('should add edit to store', () => {
            const { result } = renderHook(() => useEdits('sess_123'));

            const edit: CellEdit = {
                sessionId: 'sess_123',
                rowId: '100',
                column: 'amount',
                oldValue: 50,
                newValue: 100,
                clientTs: new Date().toISOString(),
                isValid: true,
                validationMessages: [],
            };

            act(() => {
                result.current.addEdit(edit);
            });

            expect(result.current.editCount).toBe(1);
            expect(result.current.edits).toHaveLength(1);
            expect(result.current.edits[0]).toEqual(edit);
        });

        it('should track multiple edits', () => {
            const { result } = renderHook(() => useEdits('sess_456'));

            act(() => {
                result.current.addEdit({
                    sessionId: 'sess_456',
                    rowId: '100',
                    column: 'amount',
                    oldValue: 50,
                    newValue: 100,
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });

                result.current.addEdit({
                    sessionId: 'sess_456',
                    rowId: '101',
                    column: 'status',
                    oldValue: 'pending',
                    newValue: 'approved',
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });
            });

            expect(result.current.editCount).toBe(2);
            expect(result.current.edits).toHaveLength(2);
        });

        it('should overwrite edit for same cell', () => {
            const { result } = renderHook(() => useEdits('sess_789'));

            act(() => {
                result.current.addEdit({
                    sessionId: 'sess_789',
                    rowId: '100',
                    column: 'amount',
                    oldValue: 50,
                    newValue: 100,
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });

                result.current.addEdit({
                    sessionId: 'sess_789',
                    rowId: '100',
                    column: 'amount',
                    oldValue: 50,
                    newValue: 150,
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });
            });

            expect(result.current.editCount).toBe(1);
            expect(result.current.edits[0].newValue).toBe(150);
        });
    });

    describe('removeEdit', () => {
        it('should remove specific edit', () => {
            const { result } = renderHook(() => useEdits('sess_remove'));

            act(() => {
                result.current.addEdit({
                    sessionId: 'sess_remove',
                    rowId: '100',
                    column: 'amount',
                    oldValue: 50,
                    newValue: 100,
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });

                result.current.addEdit({
                    sessionId: 'sess_remove',
                    rowId: '100',
                    column: 'status',
                    oldValue: 'pending',
                    newValue: 'approved',
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });
            });

            expect(result.current.editCount).toBe(2);

            act(() => {
                result.current.removeEdit('100', 'amount');
            });

            expect(result.current.editCount).toBe(1);
            expect(result.current.edits[0].column).toBe('status');
        });
    });

    describe('clearSession', () => {
        it('should clear all edits for session', () => {
            const { result } = renderHook(() => useEdits('sess_clear'));

            act(() => {
                result.current.addEdit({
                    sessionId: 'sess_clear',
                    rowId: '100',
                    column: 'amount',
                    oldValue: 50,
                    newValue: 100,
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });

                result.current.addEdit({
                    sessionId: 'sess_clear',
                    rowId: '101',
                    column: 'amount',
                    oldValue: 75,
                    newValue: 125,
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });
            });

            expect(result.current.editCount).toBe(2);

            act(() => {
                result.current.clearSession();
            });

            expect(result.current.editCount).toBe(0);
            expect(result.current.edits).toHaveLength(0);
        });
    });

    describe('getEdit', () => {
        it('should retrieve specific edit', () => {
            const { result } = renderHook(() => useEdits('sess_get'));

            const edit: CellEdit = {
                sessionId: 'sess_get',
                rowId: '100',
                column: 'amount',
                oldValue: 50,
                newValue: 100,
                clientTs: new Date().toISOString(),
                isValid: true,
                validationMessages: [],
            };

            act(() => {
                result.current.addEdit(edit);
            });

            const retrieved = result.current.getEdit('100', 'amount');
            expect(retrieved).toEqual(edit);

            const notFound = result.current.getEdit('999', 'amount');
            expect(notFound).toBeUndefined();
        });
    });

    describe('getRowEdits', () => {
        it('should get all edits for a row', () => {
            const { result } = renderHook(() => useEdits('sess_row'));

            act(() => {
                result.current.addEdit({
                    sessionId: 'sess_row',
                    rowId: '100',
                    column: 'amount',
                    oldValue: 50,
                    newValue: 100,
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });

                result.current.addEdit({
                    sessionId: 'sess_row',
                    rowId: '100',
                    column: 'status',
                    oldValue: 'pending',
                    newValue: 'approved',
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });

                result.current.addEdit({
                    sessionId: 'sess_row',
                    rowId: '101',
                    column: 'amount',
                    oldValue: 75,
                    newValue: 125,
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });
            });

            const row100Edits = result.current.getRowEdits('100');
            expect(row100Edits).toHaveLength(2);
            expect(row100Edits.every(e => e.rowId === '100')).toBe(true);

            const row101Edits = result.current.getRowEdits('101');
            expect(row101Edits).toHaveLength(1);
        });
    });

    describe('hasEdit', () => {
        it('should check if edit exists', () => {
            const { result } = renderHook(() => useEdits('sess_has'));

            act(() => {
                result.current.addEdit({
                    sessionId: 'sess_has',
                    rowId: '100',
                    column: 'amount',
                    oldValue: 50,
                    newValue: 100,
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });
            });

            expect(result.current.hasEdit('100', 'amount')).toBe(true);
            expect(result.current.hasEdit('100', 'status')).toBe(false);
            expect(result.current.hasEdit('999', 'amount')).toBe(false);
        });
    });

    describe('invalidEdits', () => {
        it('should filter invalid edits', () => {
            const { result } = renderHook(() => useEdits('sess_invalid'));

            act(() => {
                result.current.addEdit({
                    sessionId: 'sess_invalid',
                    rowId: '100',
                    column: 'amount',
                    oldValue: 50,
                    newValue: 100,
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });

                result.current.addEdit({
                    sessionId: 'sess_invalid',
                    rowId: '101',
                    column: 'amount',
                    oldValue: 50,
                    newValue: -10,
                    clientTs: new Date().toISOString(),
                    isValid: false,
                    validationMessages: ['Value must be positive'],
                    severity: 'error',
                });

                result.current.addEdit({
                    sessionId: 'sess_invalid',
                    rowId: '102',
                    column: 'amount',
                    oldValue: 50,
                    newValue: -20,
                    clientTs: new Date().toISOString(),
                    isValid: false,
                    validationMessages: ['Value must be positive'],
                    severity: 'fatal',
                });
            });

            expect(result.current.invalidEdits).toHaveLength(2);
            expect(result.current.invalidEdits.every(e => !e.isValid)).toBe(true);
        });
    });

    describe('null session handling', () => {
        it('should handle null session gracefully', () => {
            const { result } = renderHook(() => useEdits(null));

            expect(result.current.edits).toEqual([]);
            expect(result.current.editCount).toBe(0);
            expect(result.current.invalidEdits).toEqual([]);

            // These should not throw
            act(() => {
                result.current.addEdit({
                    sessionId: 'any',
                    rowId: '100',
                    column: 'amount',
                    oldValue: 50,
                    newValue: 100,
                    clientTs: new Date().toISOString(),
                    isValid: true,
                    validationMessages: [],
                });
            });

            expect(result.current.editCount).toBe(0);
        });
    });
});
