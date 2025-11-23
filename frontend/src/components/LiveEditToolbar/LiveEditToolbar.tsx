/**
 * LiveEditToolbar Component
 * 
 * Toolbar for live edit operations with session controls and statistics.
 */

import React from 'react';
import type { UseLiveSessionReturn } from '../../hooks/useLiveSession';
import type { ValidationSummary } from '../../hooks/useValidation';

interface LiveEditToolbarProps {
    liveSession: UseLiveSessionReturn;
    validation: ValidationSummary;
    onPreview: () => void;
    onSubmit: () => void;
    datasetName?: string;
}

export const LiveEditToolbar: React.FC<LiveEditToolbarProps> = ({
    liveSession,
    validation,
    onPreview,
    onSubmit,
    datasetName = 'Dataset',
}) => {
    const { session, startSession, endSession } = liveSession;
    const { isActive, editCount, isLoading, expiresAt } = session;

    // Format expiry time
    const expiryText = React.useMemo(() => {
        if (!expiresAt) return '';

        const expiry = new Date(expiresAt);
        const now = new Date();
        const diff = expiry.getTime() - now.getTime();

        if (diff <= 0) return 'Expired';

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

        return `${hours}h ${minutes}m remaining`;
    }, [expiresAt]);

    return (
        <div className="bg-white border-b border-gray-200 px-6 py-3">
            <div className="flex items-center justify-between">
                {/* Left: Session info */}
                <div className="flex items-center gap-4">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {datasetName}
                    </h2>

                    {isActive ? (
                        <>
                            <div className="flex items-center gap-2">
                                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                                <span className="text-sm text-gray-600">
                                    Live Edit Active
                                </span>
                            </div>

                            <div className="text-sm text-gray-500">
                                {editCount} {editCount === 1 ? 'edit' : 'edits'}
                            </div>

                            {expiryText && (
                                <div className="text-sm text-gray-500">
                                    ⏱ {expiryText}
                                </div>
                            )}
                        </>
                    ) : (
                        <button
                            onClick={() => startSession()}
                            disabled={isLoading}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
                        >
                            {isLoading ? 'Starting...' : 'Start Editing'}
                        </button>
                    )}
                </div>

                {/* Right: Actions */}
                {isActive && (
                    <div className="flex items-center gap-3">
                        {/* Validation Summary */}
                        <div className="flex items-center gap-3 px-4 py-2 bg-gray-50 rounded-md">
                            {validation.infoCount > 0 && (
                                <div className="flex items-center gap-1">
                                    <span className="text-blue-600">ℹ️</span>
                                    <span className="text-sm text-gray-700">{validation.infoCount}</span>
                                </div>
                            )}

                            {validation.warningCount > 0 && (
                                <div className="flex items-center gap-1">
                                    <span className="text-yellow-600">⚠️</span>
                                    <span className="text-sm text-gray-700">{validation.warningCount}</span>
                                </div>
                            )}

                            {validation.errorCount > 0 && (
                                <div className="flex items-center gap-1">
                                    <span className="text-red-600">❌</span>
                                    <span className="text-sm text-gray-700">{validation.errorCount}</span>
                                </div>
                            )}

                            {validation.fatalCount > 0 && (
                                <div className="flex items-center gap-1">
                                    <span className="text-red-800">🛑</span>
                                    <span className="text-sm text-gray-700">{validation.fatalCount}</span>
                                </div>
                            )}

                            {editCount === 0 && (
                                <span className="text-sm text-gray-500">No edits yet</span>
                            )}
                        </div>

                        {/* Preview Button */}
                        <button
                            onClick={onPreview}
                            disabled={editCount === 0}
                            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 text-sm font-medium"
                        >
                            Preview
                        </button>

                        {/* Submit Button */}
                        <button
                            onClick={onSubmit}
                            disabled={!validation.canSubmit || editCount === 0}
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 text-sm font-medium"
                            title={
                                !validation.canSubmit
                                    ? 'Fix validation errors before submitting'
                                    : editCount === 0
                                        ? 'No edits to submit'
                                        : 'Submit change request'
                            }
                        >
                            Submit CR
                        </button>

                        {/* Cancel Button */}
                        <button
                            onClick={() => {
                                if (confirm('Discard all edits and end session?')) {
                                    endSession();
                                }
                            }}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm font-medium"
                        >
                            Cancel
                        </button>
                    </div>
                )}
            </div>

            {/* Warning banner for validation issues */}
            {isActive && validation.requiresReview && validation.warningCount > 0 && (
                <div className="mt-3 px-4 py-2 bg-yellow-50 border border-yellow-200 rounded-md">
                    <div className="flex items-start gap-2">
                        <span className="text-yellow-600">⚠️</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-yellow-800">
                                Warning: This change request has {validation.warningCount} {validation.warningCount === 1 ? 'warning' : 'warnings'}
                            </p>
                            <p className="text-sm text-yellow-700 mt-1">
                                These will require reviewer attention during approval.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Error banner blocking submission */}
            {isActive && !validation.canSubmit && editCount > 0 && (
                <div className="mt-3 px-4 py-2 bg-red-50 border border-red-200 rounded-md">
                    <div className="flex items-start gap-2">
                        <span className="text-red-600">❌</span>
                        <div className="flex-1">
                            <p className="text-sm font-medium text-red-800">
                                Cannot submit: {validation.errorCount + validation.fatalCount} validation {validation.errorCount + validation.fatalCount === 1 ? 'error' : 'errors'}
                            </p>
                            <p className="text-sm text-red-700 mt-1">
                                Fix all errors before you can submit this change request.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
