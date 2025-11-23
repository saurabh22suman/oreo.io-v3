/**
 * Tests for useValidation hook
 */

import { renderHook } from '@testing-library/react';
import { useValidation } from '../useValidation';
import type { CellEdit } from '../useEdits';

describe('useValidation', () => {
    const createEdit = (overrides: Partial<CellEdit> = {}): CellEdit => ({
        sessionId: 'test',
        rowId: '100',
        column: 'amount',
        oldValue: 0,
        newValue: 100,
        clientTs: new Date().toISOString(),
        isValid: true,
        validationMessages: [],
        ...overrides,
    });

    describe('summary', () => {
        it('should compute summary for valid edits', () => {
            const edits: CellEdit[] = [
                createEdit({ isValid: true }),
                createEdit({ isValid: true, rowId: '101' }),
                createEdit({ isValid: true, rowId: '102' }),
            ];

            const { result } = renderHook(() => useValidation(edits));

            expect(result.current.summary.totalEdits).toBe(3);
            expect(result.current.summary.validEdits).toBe(3);
            expect(result.current.summary.invalidEdits).toBe(0);
            expect(result.current.summary.canSubmit).toBe(true);
            expect(result.current.summary.requiresReview).toBe(false);
        });

        it('should compute summary with warnings', () => {
            const edits: CellEdit[] = [
                createEdit({ isValid: true }),
                createEdit({
                    isValid: true,
                    severity: 'warning',
                    validationMessages: ['High value'],
                    rowId: '101',
                }),
                createEdit({
                    isValid: true,
                    severity: 'warning',
                    validationMessages: ['Unusual pattern'],
                    rowId: '102',
                }),
            ];

            const { result } = renderHook(() => useValidation(edits));

            expect(result.current.summary.warningCount).toBe(2);
            expect(result.current.summary.canSubmit).toBe(true);
            expect(result.current.summary.requiresReview).toBe(true);
        });

        it('should compute summary with errors', () => {
            const edits: CellEdit[] = [
                createEdit({ isValid: true }),
                createEdit({
                    isValid: false,
                    severity: 'error',
                    validationMessages: ['Invalid format'],
                    rowId: '101',
                }),
            ];

            const { result } = renderHook(() => useValidation(edits));

            expect(result.current.summary.errorCount).toBe(1);
            expect(result.current.summary.canSubmit).toBe(false);
            expect(result.current.summary.validEdits).toBe(1);
            expect(result.current.summary.invalidEdits).toBe(1);
        });

        it('should compute summary with fatal errors', () => {
            const edits: CellEdit[] = [
                createEdit({
                    isValid: false,
                    severity: 'fatal',
                    validationMessages: ['Critical error'],
                }),
            ];

            const { result } = renderHook(() => useValidation(edits));

            expect(result.current.summary.fatalCount).toBe(1);
            expect(result.current.summary.canSubmit).toBe(false);
        });

        it('should compute mixed severities', () => {
            const edits: CellEdit[] = [
                createEdit({ severity: 'info', validationMessages: ['Info'], rowId: '100' }),
                createEdit({ severity: 'warning', validationMessages: ['Warn'], rowId: '101' }),
                createEdit({ severity: 'error', isValid: false, validationMessages: ['Error'], rowId: '102' }),
                createEdit({ severity: 'fatal', isValid: false, validationMessages: ['Fatal'], rowId: '103' }),
            ];

            const { result } = renderHook(() => useValidation(edits));

            expect(result.current.summary.infoCount).toBe(1);
            expect(result.current.summary.warningCount).toBe(1);
            expect(result.current.summary.errorCount).toBe(1);
            expect(result.current.summary.fatalCount).toBe(1);
            expect(result.current.summary.canSubmit).toBe(false);
            expect(result.current.summary.requiresReview).toBe(true);
        });
    });

    describe('messages', () => {
        it('should extract validation messages', () => {
            const edits: CellEdit[] = [
                createEdit({
                    validationMessages: ['Message 1'],
                    severity: 'warning',
                }),
                createEdit({
                    validationMessages: ['Message 2', 'Message 3'],
                    severity: 'error',
                    rowId: '101',
                    column: 'status',
                }),
            ];

            const { result } = renderHook(() => useValidation(edits));

            expect(result.current.messages).toHaveLength(3);
            expect(result.current.messages[0].message).toBe('Message 1');
            expect(result.current.messages[1].message).toBe('Message 2');
            expect(result.current.messages[2].message).toBe('Message 3');
        });

        it('should filter out edits without messages', () => {
            const edits: CellEdit[] = [
                createEdit({ validationMessages: [] }),
                createEdit({ validationMessages: ['Has message'], rowId: '101' }),
            ];

            const { result } = renderHook(() => useValidation(edits));

            expect(result.current.messages).toHaveLength(1);
        });
    });

    describe('messagesBySeverity', () => {
        it('should group messages by severity', () => {
            const edits: CellEdit[] = [
                createEdit({ severity: 'info', validationMessages: ['Info 1'], rowId: '100' }),
                createEdit({ severity: 'info', validationMessages: ['Info 2'], rowId: '101' }),
                createEdit({ severity: 'warning', validationMessages: ['Warn 1'], rowId: '102' }),
                createEdit({ severity: 'error', validationMessages: ['Error 1'], rowId: '103' }),
                createEdit({ severity: 'fatal', validationMessages: ['Fatal 1'], rowId: '104' }),
            ];

            const { result } = renderHook(() => useValidation(edits));

            expect(result.current.messagesBySeverity.info).toHaveLength(2);
            expect(result.current.messagesBySeverity.warning).toHaveLength(1);
            expect(result.current.messagesBySeverity.error).toHaveLength(1);
            expect(result.current.messagesBySeverity.fatal).toHaveLength(1);
        });
    });

    describe('getSeverityColor', () => {
        it('should return correct color classes', () => {
            const { result } = renderHook(() => useValidation([]));

            expect(result.current.getSeverityColor('info')).toContain('blue');
            expect(result.current.getSeverityColor('warning')).toContain('yellow');
            expect(result.current.getSeverityColor('error')).toContain('red');
            expect(result.current.getSeverityColor('fatal')).toContain('red');
        });
    });

    describe('getSeverityIcon', () => {
        it('should return correct icons', () => {
            const { result } = renderHook(() => useValidation([]));

            expect(result.current.getSeverityIcon('info')).toBe('ℹ️');
            expect(result.current.getSeverityIcon('warning')).toBe('⚠️');
            expect(result.current.getSeverityIcon('error')).toBe('❌');
            expect(result.current.getSeverityIcon('fatal')).toBe('🛑');
        });
    });

    describe('validateValue', () => {
        it('should validate min rule', () => {
            const { result } = renderHook(() => useValidation([]));

            const rules = [{ type: 'min', value: 0 }];

            const valid = result.current.validateValue(10, rules);
            expect(valid.valid).toBe(true);

            const invalid = result.current.validateValue(-5, rules);
            expect(invalid.valid).toBe(false);
            expect(invalid.messages[0]).toContain('>=');
        });

        it('should validate max rule', () => {
            const { result } = renderHook(() => useValidation([]));

            const rules = [{ type: 'max', value: 100 }];

            const valid = result.current.validateValue(50, rules);
            expect(valid.valid).toBe(true);

            const invalid = result.current.validateValue(150, rules);
            expect(invalid.valid).toBe(false);
            expect(invalid.messages[0]).toContain('<=');
        });

        it('should validate allowed_values rule', () => {
            const { result } = renderHook(() => useValidation([]));

            const rules = [{ type: 'allowed_values', values: ['pending', 'approved', 'rejected'] }];

            const valid = result.current.validateValue('approved', rules);
            expect(valid.valid).toBe(true);

            const invalid = result.current.validateValue('invalid', rules);
            expect(invalid.valid).toBe(false);
            expect(invalid.messages[0]).toContain('must be one of');
        });

        it('should validate regex rule', () => {
            const { result } = renderHook(() => useValidation([]));

            const rules = [{ type: 'regex', value: '^[A-Z]{3}$' }];

            const valid = result.current.validateValue('ABC', rules);
            expect(valid.valid).toBe(true);

            const invalid = result.current.validateValue('abc', rules);
            expect(invalid.valid).toBe(false);
        });

        it('should validate required rule', () => {
            const { result } = renderHook(() => useValidation([]));

            const rules = [{ type: 'required' }];

            expect(result.current.validateValue('value', rules).valid).toBe(true);
            expect(result.current.validateValue('', rules).valid).toBe(false);
            expect(result.current.validateValue(null, rules).valid).toBe(false);
            expect(result.current.validateValue(undefined, rules).valid).toBe(false);
        });

        it('should validate multiple rules', () => {
            const { result } = renderHook(() => useValidation([]));

            const rules = [
                { type: 'required' },
                { type: 'min', value: 0 },
                { type: 'max', value: 100 },
            ];

            const valid = result.current.validateValue(50, rules);
            expect(valid.valid).toBe(true);

            const invalid = result.current.validateValue(-10, rules);
            expect(invalid.valid).toBe(false);
            expect(invalid.messages).toHaveLength(1);
        });
    });

    describe('empty edits', () => {
        it('should handle empty edits array', () => {
            const { result } = renderHook(() => useValidation([]));

            expect(result.current.summary.totalEdits).toBe(0);
            expect(result.current.summary.canSubmit).toBe(true);
            expect(result.current.messages).toHaveLength(0);
        });
    });
});
