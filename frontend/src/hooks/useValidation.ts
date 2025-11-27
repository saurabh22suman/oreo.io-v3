/**
 * useValidation Hook
 * 
 * Manages validation state and provides validation utilities.
 */

import { useMemo } from 'react';
import type { CellEdit } from './useEdits';

export interface ValidationSummary {
    totalEdits: number;
    validEdits: number;
    invalidEdits: number;
    infoCount: number;
    warningCount: number;
    errorCount: number;
    fatalCount: number;
    canSubmit: boolean;
    requiresReview: boolean;
}

export interface ValidationMessage {
    rowId: string;
    column: string;
    severity: 'info' | 'warning' | 'error' | 'fatal';
    message: string;
}

export function useValidation(edits: CellEdit[]) {
    /**
     * Compute validation summary from edits
     */
    const summary = useMemo((): ValidationSummary => {
        let info = 0;
        let warning = 0;
        let error = 0;
        let fatal = 0;

        const validEdits = edits.filter(e => e.isValid);
        const invalidEdits = edits.filter(e => !e.isValid);

        edits.forEach(edit => {
            switch (edit.severity) {
                case 'info':
                    info++;
                    break;
                case 'warning':
                    warning++;
                    break;
                case 'error':
                    error++;
                    break;
                case 'fatal':
                    fatal++;
                    break;
            }
        });

        return {
            totalEdits: edits.length,
            validEdits: validEdits.length,
            invalidEdits: invalidEdits.length,
            infoCount: info,
            warningCount: warning,
            errorCount: error,
            fatalCount: fatal,
            canSubmit: fatal === 0 && error === 0,
            requiresReview: warning > 0,
        };
    }, [edits]);

    /**
     * Get all validation messages grouped by severity
     */
    const messages = useMemo((): ValidationMessage[] => {
        return edits
            .filter(edit => edit.validationMessages.length > 0)
            .flatMap(edit =>
                edit.validationMessages.map(message => ({
                    rowId: edit.rowId,
                    column: edit.column,
                    severity: edit.severity || 'info',
                    message,
                }))
            );
    }, [edits]);

    /**
     * Group messages by severity
     */
    const messagesBySeverity = useMemo(() => {
        return {
            info: messages.filter(m => m.severity === 'info'),
            warning: messages.filter(m => m.severity === 'warning'),
            error: messages.filter(m => m.severity === 'error'),
            fatal: messages.filter(m => m.severity === 'fatal'),
        };
    }, [messages]);

    /**
     * Get validation color class for severity
     */
    const getSeverityColor = (severity: 'info' | 'warning' | 'error' | 'fatal'): string => {
        switch (severity) {
            case 'info':
                return 'text-blue-600 bg-blue-50 border-blue-200';
            case 'warning':
                return 'text-yellow-600 bg-yellow-50 border-yellow-200';
            case 'error':
                return 'text-red-600 bg-red-50 border-red-200';
            case 'fatal':
                return 'text-red-800 bg-red-100 border-red-300';
            default:
                return 'text-gray-600 bg-gray-50 border-gray-200';
        }
    };

    /**
     * Get validation icon for severity
     */
    const getSeverityIcon = (severity: 'info' | 'warning' | 'error' | 'fatal'): string => {
        switch (severity) {
            case 'info':
                return 'ℹ️';
            case 'warning':
                return '⚠️';
            case 'error':
                return '❌';
            case 'fatal':
                return '🛑';
            default:
                return '•';
        }
    };

    /**
     * Validate a single value against rules
     */
    const validateValue = (
        value: any,
        rules: Array<{ type: string; value?: any; values?: any[] }>
    ): { valid: boolean; messages: string[] } => {
        const messages: string[] = [];

        for (const rule of rules) {
            switch (rule.type) {
                case 'min':
                    if (typeof value === 'number' && value < rule.value) {
                        messages.push(`Value must be >= ${rule.value}`);
                    }
                    break;

                case 'max':
                    if (typeof value === 'number' && value > rule.value) {
                        messages.push(`Value must be <= ${rule.value}`);
                    }
                    break;

                case 'allowed_values':
                    if (rule.values && !rule.values.includes(value)) {
                        messages.push(`Value must be one of: ${rule.values.join(', ')}`);
                    }
                    break;

                case 'regex':
                    if (rule.value && !new RegExp(rule.value).test(String(value))) {
                        messages.push('Value format is invalid');
                    }
                    break;

                case 'required':
                    if (value === null || value === undefined || value === '') {
                        messages.push('This field is required');
                    }
                    break;
            }
        }

        return {
            valid: messages.length === 0,
            messages,
        };
    };

    return {
        summary,
        messages,
        messagesBySeverity,
        getSeverityColor,
        getSeverityIcon,
        validateValue,
    };
}
