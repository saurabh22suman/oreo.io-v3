/**
 * PreviewModal Component
 * 
 * Modal for previewing changes before submitting a change request.
 */

import React from 'react';
import type { PreviewSummary } from '../../api/liveEditAPI';

interface PreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    preview: PreviewSummary | null;
    onConfirm: () => void;
    isLoading?: boolean;
}

export const PreviewModal: React.FC<PreviewModalProps> = ({
    isOpen,
    onClose,
    preview,
    onConfirm,
    isLoading = false,
}) => {
    if (!isOpen || !preview) return null;

    const { rows_changed, cells_changed, diffs, validation_summary } = preview;

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="flex min-h-full items-center justify-center p-4">
                <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
                    {/* Header */}
                    <div className="px-6 py-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                            <h2 className="text-xl font-semibold text-gray-900">
                                Preview Changes
                            </h2>
                            <button
                                onClick={onClose}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto px-6 py-4">
                        {/* Summary Stats */}
                        <div className="grid grid-cols-3 gap-4 mb-6">
                            <div className="bg-blue-50 rounded-lg p-4">
                                <div className="text-sm text-blue-600 font-medium">Rows Changed</div>
                                <div className="text-2xl font-bold text-blue-900 mt-1">{rows_changed}</div>
                            </div>

                            <div className="bg-purple-50 rounded-lg p-4">
                                <div className="text-sm text-purple-600 font-medium">Cells Changed</div>
                                <div className="text-2xl font-bold text-purple-900 mt-1">{cells_changed}</div>
                            </div>

                            <div className="bg-green-50 rounded-lg p-4">
                                <div className="text-sm text-green-600 font-medium">Validation</div>
                                <div className="text-2xl font-bold text-green-900 mt-1">
                                    {validation_summary.valid}/{cells_changed}
                                </div>
                                {validation_summary.warnings > 0 && (
                                    <div className="text-xs text-yellow-600 mt-1">
                                        {validation_summary.warnings} warnings
                                    </div>
                                )}
                                {validation_summary.errors > 0 && (
                                    <div className="text-xs text-red-600 mt-1">
                                        {validation_summary.errors} errors
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Diffs Table */}
                        <div className="mb-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-3">Changes</h3>

                            {diffs.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    No changes to preview
                                </div>
                            ) : (
                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Row ID
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Column
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    Old Value
                                                </th>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                    New Value
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {diffs.map((diff, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-4 py-3 text-sm text-gray-900 font-mono">
                                                        {diff.row_id}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                        {diff.column}
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-500">
                                                        <span className="bg-red-50 px-2 py-1 rounded">
                                                            {JSON.stringify(diff.old)}
                                                        </span>
                                                    </td>
                                                    <td className="px-4 py-3 text-sm text-gray-900">
                                                        <span className="bg-green-50 px-2 py-1 rounded font-medium">
                                                            {JSON.stringify(diff.new)}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                            <div className="text-sm text-gray-600">
                                Review changes before submitting
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50"
                                >
                                    Back to Editing
                                </button>

                                <button
                                    onClick={onConfirm}
                                    disabled={isLoading || validation_summary.errors > 0}
                                    className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 font-medium"
                                    title={
                                        validation_summary.errors > 0
                                            ? 'Fix validation errors before submitting'
                                            : 'Submit change request'
                                    }
                                >
                                    {isLoading ? 'Submitting...' : 'Confirm & Submit'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
