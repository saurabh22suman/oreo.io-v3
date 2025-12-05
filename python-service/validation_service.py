"""
Validation Service for Oreo.io

Implements the Validation Flow State Machine as specified in 
Validation_flow_state_machine.spec.md

This service:
- Executes Great Expectations validation suites
- Manages validation state transitions
- Provides cell, row, session, and merge-level validation
- Integrates with Delta Lake for data access
"""

import json
import logging
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime
import os

try:
    import duckdb
    import pyarrow as pa
except ImportError:
    duckdb = None
    pa = None

# Import centralized DuckDB connection pool
try:
    from duckdb_pool import get_connection as get_duckdb_connection
except ImportError:
    def get_duckdb_connection():
        con = duckdb.connect()
        con.execute("INSTALL delta; LOAD delta;")
        return con

from validation_models import (
    ValidationState,
    ValidationSeverity,
    ValidationCounts,
    ValidationMessage,
    ValidationResult,
    CellValidationResult,
    SessionValidationResult,
    ChangeRequestValidationResult,
    MergeValidationResult,
    ValidationStateMachine,
    SessionValidationState,
    ChangeRequestValidationState,
    MergeState,
)

logger = logging.getLogger("validation_service")


class ValidationService:
    """
    Core validation service implementing the state machine logic.
    """

    def __init__(self, delta_root: str = "/data/delta"):
        self.delta_root = delta_root
        self.expectation_suites: Dict[int, Any] = {}  # Cache by dataset_id

    def _get_dataset_path(self, project_id: int, dataset_id: int, table_type: str = "main") -> str:
        """Get path to Delta table"""
        base = os.path.join(
            self.delta_root,
            "projects",
            str(project_id),
            "datasets",
            str(dataset_id)
        )
        return os.path.join(base, table_type)

    def _load_expectation_suite(self, dataset_id: int) -> Optional[Dict[str, Any]]:
        """
        Load Great Expectations suite for a dataset.
        
        For now, returns a simple rule-based suite.
        TODO: Load from GE configuration files or database.
        """
        if dataset_id in self.expectation_suites:
            return self.expectation_suites[dataset_id]

        # Default simple suite - replace with GE suite loader
        suite = {
            "expectation_suite_name": f"dataset_{dataset_id}_suite",
            "expectations": []
        }

        self.expectation_suites[dataset_id] = suite
        return suite

    def _execute_expectations(
        self,
        data: pa.Table,
        expectations: List[Dict[str, Any]],
        context: Optional[Dict[str, Any]] = None
    ) -> List[ValidationMessage]:
        """
        Execute Great Expectations on data.
        
        This is a simplified implementation. In production, use GE's
        CheckpointConfig and run validation properly.
        
        Args:
            data: PyArrow table to validate
            expectations: List of expectation configs
            context: Additional validation context (e.g., row_id, column)
            
        Returns:
            List of validation messages
        """
        messages = []

        # Simple rule-based validation for demonstration
        # TODO: Replace with actual GE execution
        
        for expectation in expectations:
            exp_type = expectation.get("expectation_type")
            
            # Example: expect_column_values_to_not_be_null
            if exp_type == "expect_column_values_to_not_be_null":
                column = expectation.get("kwargs", {}).get("column")
                if column and column in data.column_names:
                    null_count = pa.compute.sum(pa.compute.is_null(data[column])).as_py()
                    if null_count > 0:
                        messages.append(ValidationMessage(
                            column=column,
                            severity=ValidationSeverity.ERROR,
                            message=f"Column '{column}' contains {null_count} null values",
                            rule_name=expectation.get("meta", {}).get("rule_name", "not_null"),
                            expectation_type=exp_type
                        ))

            # Example: expect_column_values_to_be_in_set
            elif exp_type == "expect_column_values_to_be_in_set":
                column = expectation.get("kwargs", {}).get("column")
                value_set = expectation.get("kwargs", {}).get("value_set", [])
                if column and column in data.column_names:
                    unique_vals = set(data[column].to_pylist())
                    invalid_vals = unique_vals - set(value_set)
                    if invalid_vals:
                        messages.append(ValidationMessage(
                            column=column,
                            severity=ValidationSeverity.WARNING,
                            message=f"Column '{column}' has unexpected values: {invalid_vals}",
                            rule_name=expectation.get("meta", {}).get("rule_name", "allowed_values"),
                            expectation_type=exp_type
                        ))

        return messages

    def validate_cell(
        self,
        project_id: int,
        dataset_id: int,
        row_id: str,
        column: str,
        new_value: Any
    ) -> CellValidationResult:
        """
        Validate a single cell edit.
        
        Implements cell-level validation from the state machine.
        """
        try:
            # Load expectations for this dataset
            suite = self._load_expectation_suite(dataset_id)
            
            # Filter expectations to this specific column
            column_expectations = [
                e for e in suite.get("expectations", [])
                if e.get("kwargs", {}).get("column") == column
            ]

            # Create a minimal Arrow table with just this cell
            # For proper validation, we may need the full row context
            if pa is None:
                raise RuntimeError("PyArrow required for validation")

            table = pa.table({column: [new_value]})

            # Execute expectations
            messages = self._execute_expectations(table, column_expectations, {
                "row_id": row_id,
                "column": column
            })

            # Determine result
            if not messages:
                return CellValidationResult(
                    valid=True,
                    severity=ValidationSeverity.INFO,
                    messages=[],
                    row_id=row_id,
                    column=column
                )

            # Find highest severity
            max_severity = ValidationSeverity.INFO
            for msg in messages:
                if msg.severity == ValidationSeverity.FATAL:
                    max_severity = ValidationSeverity.FATAL
                    break
                elif msg.severity == ValidationSeverity.ERROR:
                    max_severity = ValidationSeverity.ERROR
                elif msg.severity == ValidationSeverity.WARNING and max_severity == ValidationSeverity.INFO:
                    max_severity = ValidationSeverity.WARNING

            valid = max_severity not in [ValidationSeverity.ERROR, ValidationSeverity.FATAL]

            return CellValidationResult(
                valid=valid,
                severity=max_severity,
                messages=[msg.message for msg in messages],
                row_id=row_id,
                column=column
            )

        except Exception as e:
            logger.error(f"Cell validation error: {e}")
            return CellValidationResult(
                valid=False,
                severity=ValidationSeverity.FATAL,
                messages=[f"Validation error: {str(e)}"],
                row_id=row_id,
                column=column
            )

    def validate_session(
        self,
        project_id: int,
        dataset_id: int,
        session_id: str
    ) -> SessionValidationResult:
        """
        Validate an entire live edit session.
        
        Implements session-level validation from the state machine.
        """
        try:
            if duckdb is None:
                raise RuntimeError("DuckDB required for session validation")

            # Load session edits from Delta
            edits_path = self._get_dataset_path(project_id, dataset_id, f"live_edit/{session_id}/edits.delta")
            
            if not os.path.exists(edits_path):
                raise ValueError(f"Session {session_id} not found")

            # Load base data and edits
            main_path = self._get_dataset_path(project_id, dataset_id, "main")

            con = get_duckdb_connection()

            # Create synthetic dataframe with edits applied
            # This is a simplified approach - in production, properly merge edits
            edits_df = con.execute(f"SELECT * FROM delta_scan('{edits_path}')").fetch_arrow_table()
            edited_rows_count = len(edits_df)

            # For now, validate the main table (TODO: apply edits first)
            main_df = con.execute(f"SELECT * FROM delta_scan('{main_path}')").fetch_arrow_table()

            # Load expectations
            suite = self._load_expectation_suite(dataset_id)

            # Execute expectations on synthetic dataframe
            messages = self._execute_expectations(main_df, suite.get("expectations", []))

            # Count by severity
            counts = ValidationCounts()
            for msg in messages:
                if msg.severity == ValidationSeverity.INFO:
                    counts.info += 1
                elif msg.severity == ValidationSeverity.WARNING:
                    counts.warning += 1
                elif msg.severity == ValidationSeverity.ERROR:
                    counts.error += 1
                elif msg.severity == ValidationSeverity.FATAL:
                    counts.fatal += 1

            # Determine state
            state_machine = ValidationStateMachine()
            current_state = ValidationState.IN_PROGRESS
            final_state = state_machine.transition(current_state, counts)

            validation_result = ValidationResult(
                state=final_state,
                counts=counts,
                messages=messages,
                can_proceed=not counts.has_blocking_errors(),
                validation_suite_version="1.0",
                run_id=str(uuid.uuid4())
            )

            # Map to session state
            if final_state == ValidationState.PASSED:
                session_state = SessionValidationState.SESSION_VALID
            elif final_state == ValidationState.PARTIAL_PASS:
                session_state = SessionValidationState.SESSION_VALID  # Can create CR with warnings
            else:
                session_state = SessionValidationState.SESSION_INVALID

            can_create_cr = final_state != ValidationState.FAILED

            return SessionValidationResult(
                session_id=session_id,
                state=session_state,
                validation_result=validation_result,
                edited_rows_count=edited_rows_count,
                can_create_cr=can_create_cr
            )

        except Exception as e:
            logger.error(f"Session validation error: {e}")
            return SessionValidationResult(
                session_id=session_id,
                state=SessionValidationState.SESSION_INVALID,
                validation_result=ValidationResult(
                    state=ValidationState.FAILED,
                    counts=ValidationCounts(fatal=1),
                    messages=[ValidationMessage(
                        severity=ValidationSeverity.FATAL,
                        message=f"Validation error: {str(e)}"
                    )],
                    can_proceed=False
                ),
                edited_rows_count=0,
                can_create_cr=False
            )

    def validate_change_request(
        self,
        project_id: int,
        dataset_id: int,
        change_request_id: int
    ) -> ChangeRequestValidationResult:
        """
        Validate a change request before approval.
        
        Implements CR validation from the state machine.
        """
        try:
            if duckdb is None:
                raise RuntimeError("DuckDB required for CR validation")

            # Load staging data for this CR
            staging_path = self._get_dataset_path(project_id, dataset_id, f"staging/{change_request_id}")

            if not os.path.exists(staging_path):
                raise ValueError(f"Change request {change_request_id} staging not found")

            con = get_duckdb_connection()

            staging_df = con.execute(f"SELECT * FROM delta_scan('{staging_path}')").fetch_arrow_table()

            # Load expectations
            suite = self._load_expectation_suite(dataset_id)

            # Execute validation on staging data
            messages = self._execute_expectations(staging_df, suite.get("expectations", []))

            # Count by severity
            counts = ValidationCounts()
            for msg in messages:
                if msg.severity == ValidationSeverity.INFO:
                    counts.info += 1
                elif msg.severity == ValidationSeverity.WARNING:
                    counts.warning += 1
                elif msg.severity == ValidationSeverity.ERROR:
                    counts.error += 1
                elif msg.severity == ValidationSeverity.FATAL:
                    counts.fatal += 1

            # Determine state
            state_machine = ValidationStateMachine()
            current_state = ValidationState.IN_PROGRESS
            final_state = state_machine.transition(current_state, counts)

            validation_result = ValidationResult(
                state=final_state,
                counts=counts,
                messages=messages,
                can_proceed=not counts.has_blocking_errors(),
                validation_suite_version="1.0",
                run_id=str(uuid.uuid4())
            )

            # Map to CR state
            if final_state == ValidationState.PASSED:
                cr_state = ChangeRequestValidationState.CR_VALID
            elif final_state == ValidationState.PARTIAL_PASS:
                cr_state = ChangeRequestValidationState.CR_VALID  # Valid but with warnings
            else:
                cr_state = ChangeRequestValidationState.CR_INVALID

            can_approve = final_state != ValidationState.FAILED
            requires_override = final_state == ValidationState.PARTIAL_PASS

            return ChangeRequestValidationResult(
                change_request_id=change_request_id,
                state=cr_state,
                validation_result=validation_result,
                can_approve=can_approve,
                requires_override=requires_override
            )

        except Exception as e:
            logger.error(f"CR validation error: {e}")
            return ChangeRequestValidationResult(
                change_request_id=change_request_id,
                state=ChangeRequestValidationState.CR_INVALID,
                validation_result=ValidationResult(
                    state=ValidationState.FAILED,
                    counts=ValidationCounts(fatal=1),
                    messages=[ValidationMessage(
                        severity=ValidationSeverity.FATAL,
                        message=f"Validation error: {str(e)}"
                    )],
                    can_proceed=False
                ),
                can_approve=False,
                requires_override=False
            )

    def validate_before_merge(
        self,
        project_id: int,
        dataset_id: int,
        change_request_id: int
    ) -> MergeValidationResult:
        """
        Final validation before merge execution.
        
        Implements approval-stage validation from the state machine.
        """
        try:
            if duckdb is None:
                raise RuntimeError("DuckDB required for merge validation")

            # This would load both main and staging and validate the merged projection
            # For now, re-validate the staging
            cr_result = self.validate_change_request(project_id, dataset_id, change_request_id)

            # Determine merge state
            if cr_result.validation_result.state == ValidationState.PASSED:
                merge_state = MergeState.MERGE_ALLOWED
            elif cr_result.validation_result.state == ValidationState.PARTIAL_PASS:
                # Requires override
                merge_state = MergeState.MERGE_ALLOWED  # But flag for approver
            else:
                merge_state = MergeState.MERGE_FAILED

            return MergeValidationResult(
                change_request_id=change_request_id,
                merge_state=merge_state,
                validation_result=cr_result.validation_result,
                conflict_detected=False,
                conflict_details=None
            )

        except Exception as e:
            logger.error(f"Merge validation error: {e}")
            return MergeValidationResult(
                change_request_id=change_request_id,
                merge_state=MergeState.MERGE_FAILED,
                validation_result=ValidationResult(
                    state=ValidationState.FAILED,
                    counts=ValidationCounts(fatal=1),
                    messages=[ValidationMessage(
                        severity=ValidationSeverity.FATAL,
                        message=f"Validation error: {str(e)}"
                    )],
                    can_proceed=False
                ),
                conflict_detected=False
            )

    def save_validation_result(
        self,
        project_id: int,
        dataset_id: int,
        validation_result: ValidationResult
    ) -> str:
        """
        Save validation result to audit folder.
        
        Implements storage requirement from spec section 11.C
        """
        try:
            audit_path = os.path.join(
                self.delta_root,
                "projects",
                str(project_id),
                "datasets",
                str(dataset_id),
                "audit",
                "validation_runs"
            )

            os.makedirs(audit_path, exist_ok=True)

            run_id = validation_result.run_id or str(uuid.uuid4())
            run_folder = os.path.join(audit_path, run_id)
            os.makedirs(run_folder, exist_ok=True)

            # Save summary
            summary_path = os.path.join(run_folder, "summary.json")
            with open(summary_path, "w") as f:
                json.dump({
                    "run_id": run_id,
                    "state": validation_result.state,
                    "counts": validation_result.counts.dict(),
                    "can_proceed": validation_result.can_proceed,
                    "timestamp": validation_result.timestamp.isoformat(),
                    "suite_version": validation_result.validation_suite_version
                }, f, indent=2)

            # Save full details
            full_path = os.path.join(run_folder, "full.json")
            with open(full_path, "w") as f:
                json.dump(validation_result.dict(), f, indent=2, default=str)

            logger.info(json.dumps({
                "event": "validation_result_saved",
                "project_id": project_id,
                "dataset_id": dataset_id,
                "run_id": run_id,
                "state": validation_result.state
            }))

            return run_id

        except Exception as e:
            logger.error(f"Failed to save validation result: {e}")
            raise
