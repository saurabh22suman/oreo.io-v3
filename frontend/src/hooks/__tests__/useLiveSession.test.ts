/**
 * Tests for useLiveSession hook
 */

import { renderHook, act, waitFor } from '@testing-library/react';
import { useLiveSession } from '../useLiveSession';
import { liveEditAPI } from '../../api/liveEditAPI';

// Mock the API
jest.mock('../../api/liveEditAPI');

const mockAPI = liveEditAPI as jest.Mocked<typeof liveEditAPI>;

describe('useLiveSession', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        localStorage.clear();
    });

    describe('startSession', () => {
        it('should start a session successfully', async () => {
            const mockResponse = {
                session_id: 'sess_123',
                staging_path: '/path/to/staging',
                editable_columns: ['amount', 'status'],
                rules_map: {
                    amount: [{ type: 'min', value: 0 }],
                },
                sample_rows: [],
                expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            };

            mockAPI.startSession.mockResolvedValue(mockResponse);

            const { result } = renderHook(() => useLiveSession('dataset_1', 'user_1'));

            expect(result.current.session.isActive).toBe(false);

            await act(async () => {
                await result.current.startSession();
            });

            expect(mockAPI.startSession).toHaveBeenCalledWith('dataset_1', {
                user_id: 'user_1',
                mode: 'full_table',
                rows: [],
            });

            expect(result.current.session.isActive).toBe(true);
            expect(result.current.session.sessionId).toBe('sess_123');
            expect(result.current.session.editableColumns).toEqual(['amount', 'status']);
        });

        it('should handle start session error', async () => {
            mockAPI.startSession.mockRejectedValue(new Error('Network error'));

            const { result } = renderHook(() => useLiveSession('dataset_1', 'user_1'));

            await act(async () => {
                await expect(result.current.startSession()).rejects.toThrow('Network error');
            });

            expect(result.current.session.isActive).toBe(false);
            expect(result.current.session.error).toBe('Network error');
        });

        it('should store session ID in localStorage', async () => {
            const mockResponse = {
                session_id: 'sess_456',
                staging_path: '/path',
                editable_columns: [],
                rules_map: {},
                sample_rows: [],
                expires_at: new Date().toISOString(),
            };

            mockAPI.startSession.mockResolvedValue(mockResponse);

            const { result } = renderHook(() => useLiveSession('dataset_1', 'user_1'));

            await act(async () => {
                await result.current.startSession();
            });

            expect(localStorage.getItem('live_session_dataset_1')).toBe('sess_456');
        });
    });

    describe('endSession', () => {
        it('should end session successfully', async () => {
            const mockStartResponse = {
                session_id: 'sess_789',
                staging_path: '/path',
                editable_columns: [],
                rules_map: {},
                sample_rows: [],
                expires_at: new Date().toISOString(),
            };

            mockAPI.startSession.mockResolvedValue(mockStartResponse);
            mockAPI.abortSession.mockResolvedValue({ ok: true });

            const { result } = renderHook(() => useLiveSession('dataset_1', 'user_1'));

            await act(async () => {
                await result.current.startSession();
            });

            expect(result.current.session.isActive).toBe(true);

            await act(async () => {
                await result.current.endSession();
            });

            expect(mockAPI.abortSession).toHaveBeenCalledWith('dataset_1', 'sess_789');
            expect(result.current.session.isActive).toBe(false);
            expect(result.current.session.sessionId).toBe(null);
            expect(localStorage.getItem('live_session_dataset_1')).toBe(null);
        });
    });

    describe('saveEdit', () => {
        it('should save edit successfully', async () => {
            const mockStartResponse = {
                session_id: 'sess_abc',
                staging_path: '/path',
                editable_columns: ['amount'],
                rules_map: {},
                sample_rows: [],
                expires_at: new Date().toISOString(),
            };

            const mockEditResponse = {
                status: 'ok' as const,
                validation: { valid: true, messages: [] },
                edit_id: 'edit_123',
            };

            mockAPI.startSession.mockResolvedValue(mockStartResponse);
            mockAPI.saveEdit.mockResolvedValue(mockEditResponse);

            const { result } = renderHook(() => useLiveSession('dataset_1', 'user_1'));

            await act(async () => {
                await result.current.startSession();
            });

            let success: boolean = false;
            await act(async () => {
                success = await result.current.saveEdit({
                    row_id: '123',
                    column: 'amount',
                    new_value: 100,
                });
            });

            expect(success).toBe(true);
            expect(result.current.session.editCount).toBe(1);
        });

        it('should handle validation failure', async () => {
            const mockStartResponse = {
                session_id: 'sess_def',
                staging_path: '/path',
                editable_columns: ['amount'],
                rules_map: {},
                sample_rows: [],
                expires_at: new Date().toISOString(),
            };

            const mockEditResponse = {
                status: 'error' as const,
                validation: {
                    valid: false,
                    messages: ['Value must be positive'],
                    severity: 'error' as const,
                },
            };

            mockAPI.startSession.mockResolvedValue(mockStartResponse);
            mockAPI.saveEdit.mockResolvedValue(mockEditResponse);

            const { result } = renderHook(() => useLiveSession('dataset_1', 'user_1'));

            await act(async () => {
                await result.current.startSession();
            });

            let success: boolean = true;
            await act(async () => {
                success = await result.current.saveEdit({
                    row_id: '123',
                    column: 'amount',
                    new_value: -100,
                });
            });

            expect(success).toBe(false);
            expect(result.current.session.editCount).toBe(0);
        });
    });

    describe('isColumnEditable', () => {
        it('should return true for editable columns', async () => {
            const mockResponse = {
                session_id: 'sess_test',
                staging_path: '/path',
                editable_columns: ['amount', 'status'],
                rules_map: {},
                sample_rows: [],
                expires_at: new Date().toISOString(),
            };

            mockAPI.startSession.mockResolvedValue(mockResponse);

            const { result } = renderHook(() => useLiveSession('dataset_1', 'user_1'));

            await act(async () => {
                await result.current.startSession();
            });

            expect(result.current.isColumnEditable('amount')).toBe(true);
            expect(result.current.isColumnEditable('status')).toBe(true);
            expect(result.current.isColumnEditable('id')).toBe(false);
        });
    });

    describe('preview', () => {
        it('should generate preview successfully', async () => {
            const mockStartResponse = {
                session_id: 'sess_preview',
                staging_path: '/path',
                editable_columns: [],
                rules_map: {},
                sample_rows: [],
                expires_at: new Date().toISOString(),
            };

            const mockPreviewResponse = {
                session_id: 'sess_preview',
                rows_changed: 5,
                cells_changed: 10,
                diffs: [],
                validation_summary: {
                    valid: 10,
                    warnings: 0,
                    errors: 0,
                },
            };

            mockAPI.startSession.mockResolvedValue(mockStartResponse);
            mockAPI.preview.mockResolvedValue(mockPreviewResponse);

            const { result } = renderHook(() => useLiveSession('dataset_1', 'user_1'));

            await act(async () => {
                await result.current.startSession();
            });

            let preview: any = null;
            await act(async () => {
                preview = await result.current.preview();
            });

            expect(preview).toEqual(mockPreviewResponse);
            expect(mockAPI.preview).toHaveBeenCalledWith('dataset_1', 'sess_preview');
        });
    });

    describe('submitCR', () => {
        it('should submit change request successfully', async () => {
            const mockStartResponse = {
                session_id: 'sess_cr',
                staging_path: '/path',
                editable_columns: [],
                rules_map: {},
                sample_rows: [],
                expires_at: new Date().toISOString(),
            };

            const mockCRResponse = {
                change_request_id: 'cr_123',
                status: 'pending_review',
            };

            mockAPI.startSession.mockResolvedValue(mockStartResponse);
            mockAPI.submitChangeRequest.mockResolvedValue(mockCRResponse);

            const { result } = renderHook(() => useLiveSession('dataset_1', 'user_1'));

            await act(async () => {
                await result.current.startSession();
            });

            let crId: string | null = null;
            await act(async () => {
                crId = await result.current.submitCR('Test CR', 'Description', ['user_2']);
            });

            expect(crId).toBe('cr_123');
            expect(result.current.session.isActive).toBe(false);
            expect(mockAPI.submitChangeRequest).toHaveBeenCalledWith('dataset_1', {
                session_id: 'sess_cr',
                title: 'Test CR',
                description: 'Description',
                approvers: ['user_2'],
                notify: true,
            });
        });
    });
});
