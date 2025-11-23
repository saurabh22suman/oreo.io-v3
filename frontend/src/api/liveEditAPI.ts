/**
 * Live Edit API Client
 * 
 * Type-safe API client for Live Edit operations.
 * Auto-generated from live_edit_api.spec.md
 */

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export interface StartSessionRequest {
    user_id: string;
    mode: 'row_selection' | 'full_table';
    rows?: number[];
}

export interface StartSessionResponse {
    session_id: string;
    staging_path: string;
    editable_columns: string[];
    rules_map: Record<string, Array<{ type: string; value?: any; values?: any[] }>>;
    sample_rows: any[];
    expires_at: string;
}

export interface EditPayload {
    row_id: string;
    column: string;
    new_value: any;
    client_ts?: string;
}

export interface EditResponse {
    status: 'ok' | 'error';
    validation: ValidationResult;
    edit_id?: string;
}

export interface ValidationResult {
    valid: boolean;
    severity?: 'info' | 'warning' | 'error' | 'fatal';
    messages: string[];
    expectation_id?: string;
}

export interface GridDataRequest {
    page?: number;
    limit?: number;
    session_id?: string;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
}

export interface GridDataResponse {
    meta: {
        page: number;
        limit: number;
        total: number;
    };
    columns: Array<{
        name: string;
        type: string;
        editable: boolean;
        nullable?: boolean;
        rules?: any[];
    }>;
    rows: Array<{
        row_id: string;
        cells: Record<string, any>;
        edited: boolean;
        validation_issues?: string[];
    }>;
}

export interface PreviewSummary {
    session_id: string;
    rows_changed: number;
    cells_changed: number;
    diffs: Array<{
        row_id: string;
        column: string;
        old: any;
        new: any;
    }>;
    validation_summary: {
        valid: number;
        warnings: number;
        errors: number;
    };
}

export interface ChangeRequestRequest {
    session_id: string;
    title: string;
    description?: string;
    approvers: string[];
    notify?: boolean;
}

export interface ChangeRequestResponse {
    change_request_id: string;
    status: string;
}

/**
 * Live Edit API Client Class
 */
export class LiveEditAPI {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE_URL) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
            credentials: 'include', // Include cookies for auth
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({
                error: { message: response.statusText }
            }));
            throw new Error(error.error?.message || `HTTP ${response.status}`);
        }

        return response.json();
    }

    /**
     * Start a new live edit session
     */
    async startSession(
        datasetId: string,
        request: StartSessionRequest
    ): Promise<StartSessionResponse> {
        return this.request<StartSessionResponse>(
            `/api/v1/datasets/${datasetId}/live_sessions`,
            {
                method: 'POST',
                body: JSON.stringify(request),
            }
        );
    }

    /**
     * Get grid data with optional session overlay
     */
    async getGridData(
        datasetId: string,
        params: GridDataRequest = {}
    ): Promise<GridDataResponse> {
        const queryParams = new URLSearchParams();
        if (params.page) queryParams.set('page', params.page.toString());
        if (params.limit) queryParams.set('limit', params.limit.toString());
        if (params.session_id) queryParams.set('session_id', params.session_id);
        if (params.sort_by) queryParams.set('sort_by', params.sort_by);
        if (params.sort_order) queryParams.set('sort_order', params.sort_order);

        const query = queryParams.toString();
        const endpoint = `/api/v1/datasets/${datasetId}/data${query ? `?${query}` : ''}`;

        return this.request<GridDataResponse>(endpoint);
    }

    /**
     * Save a single cell edit
     */
    async saveEdit(
        datasetId: string,
        sessionId: string,
        edit: EditPayload
    ): Promise<EditResponse> {
        return this.request<EditResponse>(
            `/api/v1/datasets/${datasetId}/live_sessions/${sessionId}/edits`,
            {
                method: 'POST',
                body: JSON.stringify(edit),
            }
        );
    }

    /**
     * Save multiple edits in batch
     */
    async batchSaveEdits(
        datasetId: string,
        sessionId: string,
        edits: EditPayload[]
    ): Promise<{ results: Array<{ edit_id?: string; valid: boolean; messages: string[] }> }> {
        return this.request(
            `/api/v1/datasets/${datasetId}/live_sessions/${sessionId}/edits/batch`,
            {
                method: 'POST',
                body: JSON.stringify({ edits }),
            }
        );
    }

    /**
     * Generate preview summary
     */
    async preview(
        datasetId: string,
        sessionId: string
    ): Promise<PreviewSummary> {
        return this.request<PreviewSummary>(
            `/api/v1/datasets/${datasetId}/live_sessions/${sessionId}/preview`,
            {
                method: 'POST',
            }
        );
    }

    /**
     * Submit change request
     */
    async submitChangeRequest(
        datasetId: string,
        request: ChangeRequestRequest
    ): Promise<ChangeRequestResponse> {
        return this.request<ChangeRequestResponse>(
            `/api/v1/datasets/${datasetId}/change_requests`,
            {
                method: 'POST',
                body: JSON.stringify(request),
            }
        );
    }

    /**
     * Abort a live edit session
     */
    async abortSession(
        datasetId: string,
        sessionId: string
    ): Promise<{ ok: boolean }> {
        return this.request(
            `/api/v1/datasets/${datasetId}/live_sessions/${sessionId}`,
            {
                method: 'DELETE',
            }
        );
    }

    /**
     * Get session details
     */
    async getSession(
        datasetId: string,
        sessionId: string
    ): Promise<any> {
        return this.request(
            `/api/v1/datasets/${datasetId}/live_sessions/${sessionId}`
        );
    }

    /**
     * Get all edits for a session
     */
    async getSessionEdits(
        datasetId: string,
        sessionId: string
    ): Promise<any[]> {
        return this.request(
            `/api/v1/datasets/${datasetId}/live_sessions/${sessionId}/edits`
        );
    }
}

// Export singleton instance
export const liveEditAPI = new LiveEditAPI();
